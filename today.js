const APP_TIME_ZONE = 'Europe/Lisbon';
const DATE_KEY_LOCALE = 'en-CA';
const DISPLAY_LOCALE = 'pt-PT';
const STATIC_DATA_DIR = 'data';
const BOOKING_SUFFIX = /\s+booking$/i;
const ENTRY_LABEL = 'Entrada';
const EXIT_LABEL = 'Saída';
const TOMORROW_DAY_OFFSET = 1;
const CONFIG_MESSAGES_PATH = 'airbnb-messages.json';
const LINK_TARGET_BLANK = '_blank';
const LINK_REL_EXTERNAL = 'noopener noreferrer';
const DATE_KEY_FORMATTER = new Intl.DateTimeFormat(DATE_KEY_LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: APP_TIME_ZONE
});
const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: APP_TIME_ZONE
});

function dateKey(date = new Date()) {
  const parts = Object.fromEntries(
    DATE_KEY_FORMATTER.formatToParts(date).map(({ type, value }) => [type, value])
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateLabel(date = new Date()) {
  return DATE_LABEL_FORMATTER.format(date);
}

function dateFromKey(targetDateKey) {
  const [year, month, day] = targetDateKey.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day));
}

function nextDateKey(targetDateKey) {
  const date = dateFromKey(targetDateKey);
  date.setUTCDate(date.getUTCDate() + TOMORROW_DAY_OFFSET);

  return date.toISOString().slice(0, targetDateKey.length);
}

function canonicalName(name) {
  return String(name || '').replace(BOOKING_SUFFIX, '').trim();
}

const RAFAEL_PROPERTIES = new Set([
  'Antero A7',
  'Pardais 205',
  'Portimao G137',
  'Portimao J138',
  'Silchoro 404',
  'Silchoro 1205'
]);

// Check if property belongs to Albufeira or Portimao (Rafael).
function isRafaelProperty(name) {
  return RAFAEL_PROPERTIES.has(canonicalName(name));
}

// Resolve Airbnb message URL for a property name.
// Example: messageUrlFor('Pardais 205', map) => 'https://airbnb.com/...'
function messageUrlFor(name, messageMap = {}) {
  const clean = canonicalName(name);

  return messageMap[clean] || messageMap[name] || '';
}

function eventDateKey(rawDate) {
  if (!rawDate || typeof rawDate.value !== 'string') {
    return null;
  }

  if (rawDate.type === 'date') {
    return rawDate.value;
  }

  const parsed = new Date(rawDate.value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return dateKey(parsed);
}

function hasCheckout(events, targetDateKey) {
  if (!Array.isArray(events)) {
    return false;
  }

  return events.some((event) => eventDateKey(event?.end) === targetDateKey);
}

function activitiesForDate(events, targetDateKey) {
  if (!Array.isArray(events)) {
    return [];
  }

  const activities = new Set();
  for (const event of events) {
    if (eventDateKey(event?.start) === targetDateKey) {
      activities.add(ENTRY_LABEL);
    }

    if (eventDateKey(event?.end) === targetDateKey) {
      activities.add(EXIT_LABEL);
    }
  }

  return [ENTRY_LABEL, EXIT_LABEL].filter((label) => activities.has(label));
}

function assetUrl(relativePath) {
  const appRoot = document.documentElement.dataset.appRoot || '.';
  const normalizedRoot = appRoot.endsWith('/') ? appRoot : `${appRoot}/`;
  const appRootUrl = new URL(normalizedRoot, window.location.href);

  return new URL(relativePath, appRootUrl).toString();
}

async function fetchJson(relativePath, cacheKey) {
  const response = await fetch(`${assetUrl(relativePath)}?_cb=${cacheKey}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

// Fetch Airbnb messages configuration.
async function fetchMessages(cacheKey) {
  try {
    return await fetchJson(CONFIG_MESSAGES_PATH, cacheKey);
  } catch {
    return {};
  }
}

function countLabel(stays) {
  const labels = stays.flatMap((stay) => stay.activities);
  const entries = labels.filter((label) => label === ENTRY_LABEL).length;
  const exits = labels.filter((label) => label === EXIT_LABEL).length;
  const parts = [];

  if (entries > 0) {
    parts.push(`${entries} ${entries === 1 ? 'entrada' : 'entradas'}`);
  }

  if (exits > 0) {
    parts.push(`${exits} ${exits === 1 ? 'saída' : 'saídas'}`);
  }

  return parts.join(' · ');
}

// Render title as link if messageUrl exists, otherwise plain text.
function renderTitle(stay) {
  if (!stay?.messageUrl) {
    const title = document.createElement('span');
    title.className = 'today-item-name';
    title.textContent = stay?.name || '';

    return title;
  }

  const link = document.createElement('a');
  link.className = 'today-item-name today-item-name-link';
  link.href = stay.messageUrl;
  link.target = LINK_TARGET_BLANK;
  link.rel = LINK_REL_EXTERNAL;
  link.textContent = stay.name;
  link.title = 'Abrir mensagens Airbnb';
  link.setAttribute('aria-label', `${stay.name}, abrir mensagens Airbnb numa nova aba`);

  return link;
}

function renderDay(prefix, stays) {
  const list = document.getElementById(`${prefix}List`);
  const emptyState = document.getElementById(`${prefix}EmptyState`);
  const count = document.getElementById(`${prefix}Count`);

  list.innerHTML = '';
  for (const stay of stays) {
    const item = document.createElement('li');
    item.className = 'today-item';

    const name = renderTitle(stay);
    item.appendChild(name);

    const activities = document.createElement('span');
    activities.className = 'today-item-activities';
    activities.textContent = stay.activities.join(' · ');
    item.appendChild(activities);

    list.appendChild(item);
  }

  list.hidden = stays.length === 0;
  emptyState.hidden = stays.length > 0;
  count.textContent = countLabel(stays);
}

function mergeResults(results) {
  const stays = new Map();

  // Multiple booking feeds for one property produce one combined entry.
  for (const result of results) {
    if (result.error) {
      continue;
    }

    if (!stays.has(result.name)) {
      stays.set(result.name, {
        name: result.name,
        today: new Set(),
        tomorrow: new Set()
      });
    }

    const stay = stays.get(result.name);
    result.today.forEach((label) => stay.today.add(label));
    result.tomorrow.forEach((label) => stay.tomorrow.add(label));
  }

  return [...stays.values()];
}

function showErrors(errorCount) {
  const banner = document.getElementById('errorBanner');
  banner.hidden = errorCount === 0;

  if (errorCount > 0) {
    banner.textContent = 'Não foi possível verificar alguns calendários.';
  }
}

// Format stays for a specific day key.
function formatDayStays(stays, dayKey, messageMap) {
  return stays
    .filter((stay) => stay[dayKey].size > 0)
    .map((stay) => ({
      activities: [...stay[dayKey]],
      messageUrl: messageUrlFor(stay.name, messageMap),
      name: stay.name
    }));
}

async function loadToday(todayDateKey = dateKey()) {
  const cacheKey = Date.now();
  const tomorrowDateKey = nextDateKey(todayDateKey);
  const [calendars, messageMap] = await Promise.all([
    fetchJson(`${STATIC_DATA_DIR}/calendars.json`, cacheKey),
    fetchMessages(cacheKey)
  ]);
  const results = await Promise.all(calendars.map(async (calendar) => {
    try {
      const events = await fetchJson(`${STATIC_DATA_DIR}/${calendar.sourcePath}`, cacheKey);

      return {
        error: false,
        name: canonicalName(calendar.name),
        today: activitiesForDate(events, todayDateKey),
        tomorrow: activitiesForDate(events, tomorrowDateKey)
      };
    } catch {
      return { error: true, name: '', today: [], tomorrow: [] };
    }
  }));

  const stays = mergeResults(results);
  const mainStays = stays.filter((stay) => !isRafaelProperty(stay.name));
  const rafaelStays = stays.filter((stay) => isRafaelProperty(stay.name));

  renderDay('today', formatDayStays(mainStays, 'today', messageMap));
  renderDay('tomorrow', formatDayStays(mainStays, 'tomorrow', messageMap));
  renderDay('rafaelToday', formatDayStays(rafaelStays, 'today', messageMap));
  renderDay('rafaelTomorrow', formatDayStays(rafaelStays, 'tomorrow', messageMap));
  showErrors(results.filter((result) => result.error).length);
}

async function initToday() {
  const todayDateKey = dateKey();
  const tomorrowDateKey = nextDateKey(todayDateKey);
  document.getElementById('todayDate').textContent = dateLabel(dateFromKey(todayDateKey));
  document.getElementById('tomorrowDate').textContent = dateLabel(dateFromKey(tomorrowDateKey));

  try {
    await loadToday(todayDateKey);
  } catch {
    const banner = document.getElementById('errorBanner');
    banner.hidden = false;
    banner.textContent = 'Não foi possível carregar as entradas e saídas.';

    const lists = [
      'todayList',
      'tomorrowList',
      'todayEmptyState',
      'tomorrowEmptyState',
      'rafaelTodayList',
      'rafaelTomorrowList',
      'rafaelTodayEmptyState',
      'rafaelTomorrowEmptyState'
    ];
    for (const id of lists) {
      const el = document.getElementById(id);
      if (el) {
        el.hidden = true;
      }
    }

    const counts = ['todayCount', 'tomorrowCount', 'rafaelTodayCount', 'rafaelTomorrowCount'];
    for (const id of counts) {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = '';
      }
    }
  } finally {
    document.getElementById('loadingMsg').hidden = true;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', initToday);
}

if (typeof module !== 'undefined') {
  module.exports = {
    activitiesForDate,
    canonicalName,
    dateKey,
    hasCheckout,
    isRafaelProperty,
    messageUrlFor,
    nextDateKey,
    renderTitle
  };
}
