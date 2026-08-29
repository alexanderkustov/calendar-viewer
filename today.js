const APP_TIME_ZONE = 'Europe/Lisbon';
const DATE_KEY_LOCALE = 'en-CA';
const DISPLAY_LOCALE = 'pt-PT';
const STATIC_DATA_DIR = 'data';
const BOOKING_SUFFIX = /\s+booking$/i;
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

function canonicalName(name) {
  return String(name || '').replace(BOOKING_SUFFIX, '').trim();
}

function endDateKey(rawEnd) {
  if (!rawEnd || typeof rawEnd.value !== 'string') {
    return null;
  }

  if (rawEnd.type === 'date') {
    return rawEnd.value;
  }

  const parsed = new Date(rawEnd.value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return dateKey(parsed);
}

function hasCheckout(events, targetDateKey) {
  if (!Array.isArray(events)) {
    return false;
  }

  return events.some((event) => endDateKey(event?.end) === targetDateKey);
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

function renderExits(names) {
  const list = document.getElementById('todayList');
  const emptyState = document.getElementById('emptyState');
  const count = document.getElementById('todayCount');

  list.innerHTML = '';
  for (const name of names) {
    const item = document.createElement('li');
    item.className = 'today-item';
    item.textContent = name;
    list.appendChild(item);
  }

  list.hidden = names.length === 0;
  emptyState.hidden = names.length > 0;
  count.textContent = `${names.length} ${names.length === 1 ? 'saída' : 'saídas'}`;
}

function showErrors(errorCount) {
  const banner = document.getElementById('errorBanner');
  banner.hidden = errorCount === 0;

  if (errorCount > 0) {
    banner.textContent = 'Não foi possível verificar alguns calendários.';
  }
}

async function loadToday() {
  const cacheKey = Date.now();
  const targetDateKey = dateKey();
  const calendars = await fetchJson(`${STATIC_DATA_DIR}/calendars.json`, cacheKey);
  const results = await Promise.all(calendars.map(async (calendar) => {
    try {
      const events = await fetchJson(`${STATIC_DATA_DIR}/${calendar.sourcePath}`, cacheKey);

      return {
        error: false,
        exitsToday: hasCheckout(events, targetDateKey),
        name: canonicalName(calendar.name)
      };
    } catch {
      return { error: true, exitsToday: false, name: '' };
    }
  }));

  // Multiple booking feeds for one property produce one list entry.
  const names = [];
  const seen = new Set();
  for (const result of results) {
    if (result.error || !result.exitsToday || seen.has(result.name)) {
      continue;
    }

    seen.add(result.name);
    names.push(result.name);
  }

  renderExits(names);
  showErrors(results.filter((result) => result.error).length);
}

async function initToday() {
  document.getElementById('todayDate').textContent = dateLabel();

  try {
    await loadToday();
  } catch {
    const banner = document.getElementById('errorBanner');
    banner.hidden = false;
    banner.textContent = 'Não foi possível carregar as saídas.';
    document.getElementById('todayList').hidden = true;
    document.getElementById('emptyState').hidden = true;
    document.getElementById('todayCount').textContent = '';
  } finally {
    document.getElementById('loadingMsg').hidden = true;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', initToday);
}

if (typeof module !== 'undefined') {
  module.exports = { canonicalName, dateKey, hasCheckout };
}
