const COLORS = ['#23689D', '#00666B', '#1A558A', '#7130A5', '#0D6B35', '#934800', '#A33D29', '#0D675E', '#264653', '#745C00'];
const LOCALE = 'pt-PT';
const MAX_DAYS_AHEAD = 180;
const INITIAL_VISIBLE_MONTHS = 2;
const LOAD_MORE_MONTHS = 1;
const SNAPSHOT_STALE_AFTER_MS = 75 * 60 * 1000;
const AUTO_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const STATIC_DATA_DIR = 'data';
const APP_ROOT = document.documentElement.dataset.appRoot || '.';
const APP_ROOT_URL = new URL(APP_ROOT.endsWith('/') ? APP_ROOT : `${APP_ROOT}/`, window.location.href);
const PAGE_LOCATION_ID = window.__CALENDAR_VIEWER_LOCATION__ || null;
const LOCATION_ROUTES = [
  { id: 'albufeira', label: 'Albufeira', slug: '', tabGroup: 'main' },
  { id: 'portimao', label: 'Portimão', slug: 'portimao', tabGroup: 'main' },
  { id: 'mama-1', label: 'Mama 1', slug: 'mama/1', tabGroup: 'mama' },
  { id: 'mama-2', label: 'Mama 2', slug: 'mama/2', tabGroup: 'mama' },
  { id: 'aljezur', label: 'Aljezur', slug: 'aljezur', tabGroup: 'mama' }
];

const CALENDAR_CATEGORIES = [
  {
    name: 'Albufeira',
    calendars: [
      {
        name: "Pardais 205",
        location: 'albufeira',
        sources: [0],
        messageUrl: 'https://www.airbnb.co.uk/hosting/messages/2575905205?inbox_type=hosting&stay_listing_ids=1611613204985424515&trip_stages=CURRENTLY_HOSTING'
      },
      {
        name: "Silchoro 1205",
        location: 'albufeira',
        sources: [1],
        messageUrl: 'https://www.airbnb.co.uk/hosting/messages/2553072782?inbox_type=hosting&stay_listing_ids=830105480167579378&trip_stages=CURRENTLY_HOSTING'
      },
      {
        name: "Silchoro 404",
        location: 'albufeira',
        sources: [15]
      },
      {
        name: "Antero A7",
        location: 'albufeira',
        sources: [2, 3],
        messageUrl: 'https://www.airbnb.co.uk/hosting/messages/2615151375?inbox_type=hosting&stay_listing_ids=914217783547257427&trip_stages=CURRENTLY_HOSTING'
      }
    ]
  },
  {
    name: 'Portimao',
    calendars: [
      { name: "Portimao J138", location: 'portimao', sources: [4], messageUrl: 'https://www.airbnb.co.uk/hosting/messages/2609168651?inbox_type=hosting&stay_listing_ids=1635428772732094156&trip_stages=CURRENTLY_HOSTING' },
      { name: "Portimao G137", location: 'portimao', sources: [5], messageUrl: 'https://www.airbnb.co.uk/hosting/messages/2532292472?inbox_type=hosting&stay_listing_ids=1635425171512419857&trip_stages=CURRENTLY_HOSTING' }
    ]
  },
  {
    name: 'Mama 1',
    calendars: [
      { name: "Raul 1", location: 'mama-1', sources: [6] },
      { name: "Raul Brandao 3", location: 'mama-1', sources: [7] },
      { name: "Onda Verde", location: 'mama-1', sources: [10] },
      { name: "Balaia 404", location: 'mama-1', sources: [8] },
      { name: "Vila Magna 503", location: 'mama-1', sources: [16] },
      { name: "Vila Magna 106", location: 'mama-1', sources: [17] },
      { name: "Paraiso 336", location: 'mama-1', sources: [13], messageUrl: 'https://www.airbnb.co.uk/hosting/messages/2633130633?inbox_type=hosting&stay_listing_ids=1578004322904051113&trip_stages=CURRENTLY_HOSTING' }
    ]
  },
  {
    name: 'Mama 2',
    calendars: [
      { name: "Pescadores", location: 'mama-2', sources: [12], messageUrl: 'https://www.airbnb.co.uk/hosting/messages/2622567070?inbox_type=hosting&stay_listing_ids=794191503164393359&trip_stages=CURRENTLY_HOSTING' },
      { name: "Balaia 405", location: 'mama-2', sources: [9], messageUrl: 'https://www.airbnb.co.uk/hosting/messages/2514855243?inbox_type=hosting&stay_listing_ids=885874220580116381&trip_stages=CURRENTLY_HOSTING' },
      { name: "Eulalia Casa Blanca", location: 'mama-2', sources: [14], messageUrl: 'https://www.airbnb.co.uk/hosting/messages/?inbox_type=hosting&stay_listing_ids=1227650987862879407&trip_stages=CURRENTLY_HOSTING' }
    ]
  },
  {
    name: 'Aljezur',
    calendars: [
      { name: "Aljezur", location: 'aljezur', sources: [11], messageUrl: 'https://www.airbnb.co.uk/hosting/messages/2573815201?inbox_type=hosting&stay_listing_ids=40546691&trip_stages=CURRENTLY_HOSTING' }
    ]
  }
];

const CALENDARS_META = CALENDAR_CATEGORIES.flatMap(({ name: category, calendars }) =>
  calendars.map((calendar) => ({ ...calendar, category }))
);

let calData = new Array(CALENDARS_META.length).fill(null);
let calStatus = new Array(CALENDARS_META.length).fill('idle');
let visible = new Array(CALENDARS_META.length).fill(true); // toggle state
let activeLocation = LOCATION_ROUTES[0]?.id || null;
let visibleMonths = INITIAL_VISIBLE_MONTHS;
let autoRefreshTimerId = null;

// ─── Helpers ────────────────────────────────────────────────────────────────

function startOfDay(d) { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function fmtFull(d) { return d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtShort(d) { return d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' }); }
function fmtDayOnly(d) { return d.getDate(); }
function formatTimestamp(d) {
  return d.toLocaleString(LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}
function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }
function bookingNights(ev) { return Math.max(1, Math.round((startOfDay(ev.end) - startOfDay(ev.start)) / 86400000)); }
function nightsLabel(nights) { return `${nights} noite${nights !== 1 ? 's' : ''}`; }
function bookingTitle(ev) {
  const summary = (ev.summary || '').trim();
  if (!summary) return nightsLabel(bookingNights(ev));
  if (/\b(reserv(?:ed|ation)?|reserva(?:da)?|booking)\b/i.test(summary)) return nightsLabel(bookingNights(ev));
  return summary;
}
function formatMonthTitle(year, month) {
  return `${MONTH_TITLES_SHORT[month]}${String(year).slice(-2)}`;
}
function formatMonthAccessibleTitle(year, month) {
  const label = new Date(year, month, 1).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
  return label.charAt(0).toLocaleUpperCase(LOCALE) + label.slice(1);
}
function remainingCheckoutDatesForMonth(ci, year, month, from = startOfDay(new Date())) {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);
  const rangeStart = from > monthStart ? from : monthStart;
  const events = calData[ci] || [];
  const seen = new Set();
  const dates = [];
  for (const ev of events) {
    const checkout = startOfDay(ev.end);
    if (checkout < rangeStart || checkout >= monthEnd) continue;
    const key = checkout.getTime();
    if (seen.has(key)) continue;
    seen.add(key);
    dates.push(checkout);
  }
  dates.sort((a, b) => a - b);
  return dates;
}
function calcRangeEnd(today, monthWindow) {
  const monthWindowEnd = new Date(today.getFullYear(), today.getMonth() + monthWindow, 0);
  const hardLimit = addDays(today, MAX_DAYS_AHEAD);
  return new Date(Math.min(monthWindowEnd, hardLimit));
}
function colorForCalendar(index) {
  return COLORS[index % COLORS.length];
}

const WEEKDAYS_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MONTH_TITLES_SHORT = ['Jan.', 'Fev.', 'Mar.', 'Abr.', 'Mai.', 'Jun.', 'Jul.', 'Ago.', 'Set.', 'Out.', 'Nov.', 'Dez.'];

function calendarsForLocation(locationId = activeLocation) {
  return CALENDARS_META
    .map((meta, idx) => ({ meta, idx }))
    .filter(({ meta }) => meta.location === locationId);
}

function assetUrl(relativePath) {
  return new URL(relativePath, APP_ROOT_URL).toString();
}

function locationUrl(locationId) {
  const location = LOCATION_ROUTES.find((entry) => entry.id === locationId);
  if (!location) return APP_ROOT_URL.toString();
  return new URL(location.slug ? `${location.slug}/` : '', APP_ROOT_URL).toString();
}

function visibleCalendarsForLocation(locationId = activeLocation) {
  return calendarsForLocation(locationId).filter(({ idx }) => visible[idx]);
}

function activeLocationLabel() {
  return LOCATION_ROUTES.find((location) => location.id === activeLocation)?.label || activeLocation;
}

function tabsForLocation(locationId = activeLocation) {
  const activeRoute = LOCATION_ROUTES.find((location) => location.id === locationId);
  if (!activeRoute) return [];
  return LOCATION_ROUTES.filter((location) => location.tabGroup === activeRoute.tabGroup);
}

function activeLocationShowsTabs() {
  return tabsForLocation().length > 1;
}

function remainingCheckoutLabelForMonth(idx, year, month) {
  if (calStatus[idx] === 'loading') return 'Saídas: a carregar…';
  if (calStatus[idx] === 'unavailable') return 'Fonte por configurar';
  if (calStatus[idx] === 'error') return 'Saídas indisponíveis';

  const remainingDates = remainingCheckoutDatesForMonth(idx, year, month);
  if (!remainingDates.length) return 'Sem saídas este mês';
  return `Saídas: ${remainingDates.map((date) => fmtDayOnly(date)).join(', ')}`;
}

function buildPropertyTitleNode(meta) {
  if (!meta?.messageUrl) {
    const title = document.createElement('span');
    title.className = 'cal-header-name';
    title.textContent = meta?.name || '';
    return title;
  }

  const link = document.createElement('a');
  link.className = 'cal-header-name cal-header-name-link';
  link.href = meta.messageUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = meta.name;
  link.title = 'Abrir mensagens Airbnb';
  link.setAttribute('aria-label', `${meta.name}, abrir mensagens Airbnb numa nova aba`);
  return link;
}

// ─── Occupancy calc ──────────────────────────────────────────────────────────
// Returns booked days within [from, to) for a given calendar

function bookedDaysInRange(ci, from, to) {
  const events = calData[ci] || [];
  let booked = 0;
  let cursor = new Date(from);
  while (cursor < to) {
    const next = addDays(cursor, 1);
    const isBooked = events.some(ev => startOfDay(ev.start) <= cursor && startOfDay(ev.end) > cursor);
    if (isBooked) booked++;
    cursor = next;
  }
  return booked;
}

function occupancyForMonth(ci, year, month) {
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 1);
  const totalDays = Math.round((to - from) / 86400000);
  const booked = bookedDaysInRange(ci, from, to);
  return Math.round((booked / totalDays) * 100);
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

// Password logic removed

function showPasswordModal() {
  // Password modal removed
}

function hidePasswordModal() {
  // Password modal removed
}

function submitPassword() {
  // Password modal removed
}

window.addEventListener('DOMContentLoaded', () => {
  const initialLocation = LOCATION_ROUTES.some((location) => location.id === PAGE_LOCATION_ID)
    ? PAGE_LOCATION_ID
    : LOCATION_ROUTES[0]?.id || null;
  if (initialLocation) {
    activeLocation = initialLocation;
  }
  renderControls();
  document.getElementById('loadMoreBtn')?.addEventListener('click', loadMoreMonths);
  loadAll();
  startAutoRefresh();

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) {
      hideTip(true);
      return;
    }

    if (event.target.closest('.booking-seg')) {
      return;
    }

    hideTip(true);
  });
  window.addEventListener('resize', () => hideTip(true));
  window.addEventListener('scroll', () => hideTip(true), true);
});

/**
 * Returns whether the generated snapshot is older than the expected refresh
 * window.
 * @param {Date|null} generatedAt
 * @param {Date} [now=new Date()]
 * @returns {boolean}
 */
function isSnapshotStale(generatedAt, now = new Date()) {
  if (!(generatedAt instanceof Date) || Number.isNaN(generatedAt.getTime())) {
    return true;
  }

  return now.getTime() - generatedAt.getTime() > SNAPSHOT_STALE_AFTER_MS;
}

/**
 * Fetches JSON from the provided URL.
 * @param {string} url
 * @returns {Promise<any>}
 */
async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Converts a serialized snapshot date value into a browser Date instance.
 * @param {{ type?: string, value?: string }} rawDate
 * @returns {Date|null}
 */
function parseSnapshotDate(rawDate) {
  if (!rawDate || typeof rawDate.value !== 'string') {
    return null;
  }

  if (rawDate.type === 'date') {
    const [year, month, day] = rawDate.value.split('-').map(Number);
    if (!year || !month || !day) {
      return null;
    }
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(rawDate.value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function hydrateSnapshotEvents(snapshotEvents) {
  if (!Array.isArray(snapshotEvents)) {
    throw new Error('Not a valid calendar snapshot');
  }

  return snapshotEvents
    .map((event) => {
      const start = parseSnapshotDate(event?.start);
      const end = parseSnapshotDate(event?.end);
      if (!(start instanceof Date) || Number.isNaN(start.getTime())) return null;
      if (!(end instanceof Date) || Number.isNaN(end.getTime())) return null;
      return {
        summary: typeof event?.summary === 'string' ? event.summary : '',
        start,
        end
      };
    })
    .filter(Boolean);
}

/**
 * Loads a source calendar from the generated JSON snapshot.
 * @param {number} sourceId
 * @returns {Promise<Array<{summary: string, start: Date, end: Date}>>}
 */
async function loadSourceCalendar(sourceId) {
  const cb = Date.now();
  const snapshot = await fetchJson(assetUrl(`${STATIC_DATA_DIR}/calendar-${sourceId}.json?_cb=${cb}`));
  return hydrateSnapshotEvents(snapshot);
}

async function loadAll() {
  hideTip(true);
  setStatus('loading');
  const syncManifest = await fetchSyncManifest();
  const lastSyncAt = syncManifest?.generatedAt || null;
  const snapshotIsStale = isSnapshotStale(lastSyncAt);
  const activeCalendars = calendarsForLocation(activeLocation);
  calData = new Array(CALENDARS_META.length).fill(null);
  calStatus = new Array(CALENDARS_META.length).fill('idle');
  activeCalendars.forEach(({ idx }) => {
    calStatus[idx] = 'loading';
  });
  document.getElementById('errorBanner').hidden = true;
  renderControls();
  const errors = [];

  await Promise.all(activeCalendars.map(async ({ meta, idx }) => {
    try {
      if (!meta.sources.length) {
        calData[idx] = [];
        setCalStatus(idx, 'unavailable');
        return;
      }

      const allEvents = [];
      for (const sourceId of meta.sources) {
        allEvents.push(...await loadSourceCalendar(sourceId));
      }
      calData[idx] = allEvents;
      setCalStatus(idx, 'loaded');
    } catch (e) {
      errors.push(`${meta.name}: ${e.message}`);
      calData[idx] = [];
      setCalStatus(idx, 'error');
    }
  }));

  if (errors.length) {
    const banner = document.getElementById('errorBanner');
    banner.hidden = false;
    banner.textContent = 'Não foi possível carregar alguns calendários. Atualize a página dentro de alguns minutos. ' + errors.join(' | ');
  } else {
    document.getElementById('errorBanner').hidden = true;
  }

  setStatus('done');
  updateLastUpdatedLabel({
    snapshotGeneratedAt: lastSyncAt,
    snapshotIsStale,
    staleCalendars: syncManifest?.staleCalendars || []
  });
  renderCalendar();
}

function setStatus(state) {
  document.getElementById('loadingMsg').hidden = state !== 'loading';
}

function setCalStatus(idx, state) {
  calStatus[idx] = state;
  renderControls();
}

async function fetchSyncManifest() {
  try {
    const cb = Date.now();
    const response = await fetch(assetUrl(`${STATIC_DATA_DIR}/manifest.json?_cb=${cb}`), { cache: 'no-store' });
    if (!response.ok) return null;
    const manifest = await response.json();
    const generatedAt = manifest?.generatedAt ? new Date(manifest.generatedAt) : null;

    return {
      generatedAt:
        generatedAt instanceof Date && !Number.isNaN(generatedAt.getTime())
          ? generatedAt
          : null,
      staleCalendars: Array.isArray(manifest?.staleCalendars) ? manifest.staleCalendars : []
    };
  } catch {
    return null;
  }
}

function updateLastUpdatedLabel({
  snapshotGeneratedAt = null,
  snapshotIsStale = false,
  staleCalendars = []
} = {}) {
  const label = document.getElementById('lastUpdated');
  if (!label) return;

  const staleCount = Array.isArray(staleCalendars) ? staleCalendars.length : 0;
  const preservedSuffix = staleCount ? ` • ${staleCount} preservados` : '';
  const titleParts = [];

  if (snapshotGeneratedAt instanceof Date && !Number.isNaN(snapshotGeneratedAt.getTime())) {
    label.textContent = `Última atualização: ${formatTimestamp(snapshotGeneratedAt)}${snapshotIsStale ? ' (desatualizado)' : ''}${preservedSuffix}`;
    titleParts.push(`Última atualização do snapshot: ${formatTimestamp(snapshotGeneratedAt)}`);
  } else {
    label.textContent = staleCount ? `Última atualização: desconhecida${preservedSuffix}` : 'Última atualização: desconhecida';
  }

  if (snapshotIsStale) {
    titleParts.push('O snapshot estático é mais antigo do que a janela horária esperada para atualização.');
  }

  if (staleCount) {
    const staleNames = staleCalendars
      .map((calendar) => calendar?.name || `Fonte ${calendar?.id ?? '?'}`)
      .join(', ');
    titleParts.push(`Fontes preservadas no snapshot: ${staleNames}`);
  }

  label.title = titleParts.join(' ');

  if (!label.textContent) {
    label.textContent = 'Última atualização: desconhecida';
    return;
  }
}

/**
 * Starts an hourly background refresh so an open tab can pick up newer
 * generated snapshots without a full page reload.
 * @returns {void}
 */
function startAutoRefresh() {
  if (autoRefreshTimerId) {
    window.clearInterval(autoRefreshTimerId);
  }

  autoRefreshTimerId = window.setInterval(() => {
    loadAll().catch((error) => {
      console.error('A atualização automática falhou:', error);
    });
  }, AUTO_REFRESH_INTERVAL_MS);
}

function renderControls() {
  renderTabs();
  renderToggles();
}

function renderTabs() {
  const tabs = document.getElementById('locationTabs');
  if (!tabs) return;

  tabs.innerHTML = '';
  tabs.hidden = !activeLocationShowsTabs();
  if (tabs.hidden) return;

  tabsForLocation().forEach((location) => {
    const tab = document.createElement('a');
    tab.className = `location-tab${location.id === activeLocation ? ' active' : ''}`;
    tab.href = locationUrl(location.id);
    if (location.id === activeLocation) {
      tab.setAttribute('aria-current', 'page');
    }
    tab.textContent = location.label;
    tabs.appendChild(tab);
  });
}

function renderToggles() {
  const group = document.getElementById('toggleGroup');
  if (!group) return;

  group.innerHTML = '';
  calendarsForLocation().forEach(({ meta, idx }) => {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.id = `toggle-${idx}`;
    toggle.className = `cal-toggle${visible[idx] ? ' active' : ''}`;
    toggle.style.setProperty('--cal-color', colorForCalendar(idx));
    toggle.setAttribute('aria-pressed', String(visible[idx]));
    toggle.setAttribute('aria-controls', 'calendarContainer');
    if (calStatus[idx] === 'error') toggle.classList.add('error');
    if (calStatus[idx] === 'unavailable') toggle.classList.add('unavailable');

    const dot = document.createElement('span');
    dot.className = 'toggle-dot';
    dot.setAttribute('aria-hidden', 'true');

    const copy = document.createElement('span');
    copy.className = 'toggle-copy';

    const name = document.createElement('span');
    name.className = 'toggle-name';
    name.textContent = meta.name;

    const check = document.createElement('span');
    check.className = 'toggle-check';
    check.setAttribute('aria-hidden', 'true');
    check.textContent = '✓';

    copy.appendChild(name);
    toggle.append(dot, copy, check);
    toggle.addEventListener('click', () => {
      visible[idx] = !visible[idx];
      renderToggles();
      renderCalendar();
    });
    group.appendChild(toggle);
  });
}

// ─── Render ──────────────────────────────────────────────────────────────────

function renderCalendar() {
  const container = document.getElementById('calendarContainer');
  const today = startOfDay(new Date());
  const rangeEnd = calcRangeEnd(today, visibleMonths);
  const hardLimit = addDays(today, MAX_DAYS_AHEAD);
  const activeCalendars = visibleCalendarsForLocation();
  const keyboardBookingKeys = new Set();

  hideTip(true);
  container.innerHTML = '';

  if (!activeCalendars.length) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = `Nenhum calendário selecionado para ${activeLocationLabel()}.`;
    container.appendChild(emptyState);
    updateViewStatus(0);
    syncLoadMoreButton(rangeEnd, hardLimit);
    return;
  }

  const months = [];
  let cursor = new Date(today.getFullYear(), today.getMonth(), 1);
  while (cursor <= rangeEnd) {
    months.push(new Date(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  for (const monthStart of months) {
    container.appendChild(buildMonth(monthStart, today, rangeEnd, activeCalendars, keyboardBookingKeys));
  }

  updateViewStatus(activeCalendars.length, months.length);
  syncLoadMoreButton(rangeEnd, hardLimit);
}

function updateViewStatus(calendarCount, monthCount = 0) {
  const status = document.getElementById('viewStatus');
  if (!status) return;

  if (!calendarCount) {
    status.textContent = 'Nenhum calendário visível.';
    return;
  }

  status.textContent = `${calendarCount} ${calendarCount === 1 ? 'calendário visível' : 'calendários visíveis'} em ${monthCount} ${monthCount === 1 ? 'mês' : 'meses'}.`;
}

function loadMoreMonths() {
  visibleMonths += LOAD_MORE_MONTHS;
  renderCalendar();
}

function syncLoadMoreButton(rangeEnd, hardLimit) {
  const btn = document.getElementById('loadMoreBtn');
  if (!btn) return;
  btn.style.display = rangeEnd < hardLimit ? 'inline-flex' : 'none';
}

function addDayBadge(cell, className, text) {
  const badge = document.createElement('div');
  badge.className = `ci-badge ${className}`;
  badge.setAttribute('aria-hidden', 'true');
  badge.textContent = text;
  cell.appendChild(badge);
}

function addCheckoutMarker(cell, ev, ci, keyboardBookingKeys) {
  const isKeyboardTarget = ev ? claimKeyboardBooking(ev, ci, keyboardBookingKeys) : false;
  const marker = document.createElement(isKeyboardTarget ? 'button' : 'div');
  if (marker instanceof HTMLButtonElement) marker.type = 'button';
  marker.className = 'booking-seg seg-end seg-checkout-marker';
  marker.style.setProperty('--bar-color', colorForCalendar(ci));
  if (ev) {
    attachTooltipHandlers(marker, ev, ci, { keyboardAccessible: isKeyboardTarget });
  }
  cell.appendChild(marker);
}

function buildOccupancyRow(year, month, activeCalendars) {
  const row = document.createElement('div');
  row.className = 'occupancy-row';
  row.setAttribute('role', 'row');

  const labelCell = document.createElement('div');
  labelCell.className = 'occupancy-label-cell';
  labelCell.setAttribute('role', 'rowheader');
  labelCell.textContent = 'OCUP.';
  row.appendChild(labelCell);

  activeCalendars.forEach(({ idx: ci }) => {
    const cell = document.createElement('div');
    cell.className = 'occupancy-cell';
    cell.setAttribute('role', 'cell');
    const value = ['error', 'unavailable'].includes(calStatus[ci]) ? '—' : `${occupancyForMonth(ci, year, month)}%`;
    const valueNode = document.createElement('span');
    valueNode.className = 'occupancy-value';
    valueNode.style.color = colorForCalendar(ci);
    valueNode.textContent = value;
    cell.appendChild(valueNode);
    row.appendChild(cell);
  });

  return row;
}

function buildMonth(monthStart, today, rangeEnd, activeCalendars, keyboardBookingKeys) {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const monthEnd = new Date(year, month + 1, 0);

  const section = document.createElement('section');
  section.className = 'month-section';

  // ── Month heading ───────────────────────────────────────────────────────
  const heading = document.createElement('div');
  heading.className = 'month-heading';

  const titleEl = document.createElement('h2');
  titleEl.className = 'month-title';
  titleEl.id = `month-${year}-${month + 1}`;
  titleEl.textContent = formatMonthTitle(year, month);
  titleEl.setAttribute('aria-label', formatMonthAccessibleTitle(year, month));
  section.setAttribute('aria-labelledby', titleEl.id);
  heading.appendChild(titleEl);
  section.appendChild(heading);

  // ── Calendar grid card ───────────────────────────────────────────────────
  const card = document.createElement('div');
  card.className = 'month-card';
  card.tabIndex = 0;
  card.setAttribute('role', 'table');
  card.setAttribute('aria-labelledby', titleEl.id);
  card.setAttribute('aria-colcount', String(activeCalendars.length + 1));

  // Count visible calendars for CSS Grid
  const visibleCount = activeCalendars.length;
  // Fallback to 1 if none visible to avoid breaking grid
  card.style.setProperty('--cal-count', Math.max(1, visibleCount));

  // Calendar Header Row (Top of columns)
  const headerRow = document.createElement('div');
  headerRow.className = 'dow-header';
  headerRow.setAttribute('role', 'row');
  const dateHeader = document.createElement('div');
  dateHeader.className = 'cal-header-cell is-date';
  dateHeader.setAttribute('role', 'columnheader');
  dateHeader.textContent = 'DATA';
  headerRow.appendChild(dateHeader);
  activeCalendars.forEach(({ meta, idx: ci }) => {
    const th = document.createElement('div');
    const isUnavailable = ['error', 'unavailable'].includes(calStatus[ci]);
    th.className = `cal-header-cell is-calendar${isUnavailable ? ' error' : ''}`;
    th.setAttribute('role', 'columnheader');
    const dot = document.createElement('span');
    dot.className = 'label-dot';
    dot.style.background = colorForCalendar(ci);
    dot.setAttribute('aria-hidden', 'true');

    const copy = document.createElement('span');
    copy.className = 'cal-header-copy';

    const nameNode = buildPropertyTitleNode(meta);

    const metaNode = document.createElement('span');
    metaNode.className = 'cal-header-meta';
    metaNode.textContent = remainingCheckoutLabelForMonth(ci, year, month);

    copy.appendChild(nameNode);
    copy.appendChild(metaNode);

    th.appendChild(dot);
    th.appendChild(copy);
    headerRow.appendChild(th);
  });
  card.appendChild(headerRow);

  // Build days vertically
  const firstDay = new Date(year, month, 1);
  let currentDay = new Date(firstDay);

  while (currentDay <= monthEnd) {
    if (currentDay < today || currentDay > rangeEnd) {
      currentDay = addDays(currentDay, 1);
      continue; // Skip past/out-of-range days
    }

    const dayNext = addDays(currentDay, 1);

    // Create grid row for this day
    const row = document.createElement('div');
    row.className = 'booking-row';
    row.setAttribute('role', 'row');

    // Day Label Cell (Leftmost column)
    const dateCell = document.createElement('div');
    dateCell.className = 'date-cell' + (sameDay(currentDay, today) ? ' is-today' : '');
    dateCell.setAttribute('role', 'rowheader');
    const dowStr = WEEKDAYS_SHORT[(currentDay.getDay() + 6) % 7];
    const dateNode = document.createElement('time');
    dateNode.dateTime = `${year}-${String(month + 1).padStart(2, '0')}-${String(currentDay.getDate()).padStart(2, '0')}`;
    dateNode.setAttribute('aria-label', fmtFull(currentDay));
    dateNode.textContent = String(currentDay.getDate());
    const weekdayNode = document.createElement('span');
    weekdayNode.className = 'dow-label';
    weekdayNode.setAttribute('aria-hidden', 'true');
    weekdayNode.textContent = dowStr;
    dateCell.append(dateNode, weekdayNode);
    row.appendChild(dateCell);

    // Build booking cells for each visible calendar (Columns)
    activeCalendars.forEach(({ idx: ci }) => {

      const cell = document.createElement('div');
      cell.className = 'booking-cell';
      cell.setAttribute('role', 'cell');
      let hasCheckIn = false;
      let hasCheckOut = false;
      let firstCheckOut = null;

      // Find events that overlap this day
      for (const ev of (calData[ci] || [])) {
        const evStart = startOfDay(ev.start);
        const evEnd = startOfDay(ev.end);
        if (sameDay(evStart, currentDay)) hasCheckIn = true;
        if (sameDay(evEnd, currentDay)) {
          hasCheckOut = true;
          if (!firstCheckOut) firstCheckOut = ev;
        }

        // Skip if event doesn't cover this day
        if (evEnd <= currentDay || evStart >= dayNext) continue;

        const startsHere = sameDay(evStart, currentDay);
        const isSingleNight = startsHere && sameDay(evEnd, dayNext);

        let segType = 'mid';
        if (isSingleNight) segType = 'only';
        else if (startsHere) segType = 'start';

        const isKeyboardTarget = claimKeyboardBooking(ev, ci, keyboardBookingKeys);
        const seg = document.createElement(isKeyboardTarget ? 'button' : 'div');
        if (seg instanceof HTMLButtonElement) seg.type = 'button';
        seg.className = `booking-seg seg-${segType}`;
        seg.style.setProperty('--bar-color', colorForCalendar(ci));

        // Add text label for start/only blocks
        if (segType === 'start' || segType === 'only') {
          const lbl = document.createElement('span');
          lbl.className = 'seg-text';
          lbl.textContent = bookingTitle(ev);
          seg.appendChild(lbl);
        }

        attachTooltipHandlers(seg, ev, ci, { keyboardAccessible: isKeyboardTarget });
        cell.appendChild(seg);
      }

      if (hasCheckOut) addCheckoutMarker(cell, firstCheckOut, ci, keyboardBookingKeys);
      if (hasCheckIn) addDayBadge(cell, 'ci-in', '↓');
      if (hasCheckOut) addDayBadge(cell, 'ci-out', '↑');

      if (hasCheckIn && hasCheckOut) {
        cell.classList.add('is-changeover');
      }
      row.appendChild(cell);
    });

    card.appendChild(row);
    currentDay = addDays(currentDay, 1);
  }

  card.appendChild(buildOccupancyRow(year, month, activeCalendars));
  section.appendChild(card);
  return section;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

const tooltip = document.getElementById('tooltip');

function tooltipKey(ev, ci) {
  return `${ci}:${ev.start.getTime()}:${ev.end.getTime()}:${ev.summary || ''}`;
}

function claimKeyboardBooking(ev, ci, keyboardBookingKeys) {
  const key = tooltipKey(ev, ci);
  if (keyboardBookingKeys.has(key)) return false;
  keyboardBookingKeys.add(key);
  return true;
}

function setTooltipContent(ev, ci) {
  const nights = bookingNights(ev);
  tooltip.replaceChildren();

  const title = document.createElement('strong');
  title.textContent = bookingTitle(ev);

  const checkIn = document.createElement('div');
  checkIn.className = 'tip-row tip-in';
  checkIn.textContent = `↓ Entrada  ${fmtFull(ev.start)}`;

  const checkOut = document.createElement('div');
  checkOut.className = 'tip-row tip-out';
  checkOut.textContent = `↑ Saída  ${fmtFull(ev.end)}`;

  const nightsNode = document.createElement('div');
  nightsNode.className = 'tip-nights';
  nightsNode.textContent = nightsLabel(nights);

  tooltip.append(title, checkIn, checkOut, nightsNode);
  tooltip.style.borderColor = colorForCalendar(ci);
}

function positionTooltip(clientX, clientY) {
  const margin = 12;
  const offset = 14;
  const rect = tooltip.getBoundingClientRect();
  const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
  const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);

  tooltip.style.left = `${clamp(clientX + offset, margin, maxLeft)}px`;
  tooltip.style.top = `${clamp(clientY + offset, margin, maxTop)}px`;
}

function showTipAt(clientX, clientY, ev, ci, { pinned = false, key = tooltipKey(ev, ci) } = {}) {
  setTooltipContent(ev, ci);
  tooltip.style.display = 'block';
  tooltip.setAttribute('aria-hidden', 'false');
  tooltip.dataset.pinned = pinned ? 'true' : 'false';
  tooltip.dataset.bookingKey = key;
  positionTooltip(clientX, clientY);
}

function showTip(e, ev, ci) {
  showTipAt(e.clientX, e.clientY, ev, ci);
}

function moveTip(e) {
  if (tooltip.style.display !== 'block' || tooltip.dataset.pinned === 'true') {
    return;
  }

  positionTooltip(e.clientX, e.clientY);
}

function hideTip(force = false) {
  if (!force && tooltip.dataset.pinned === 'true') {
    return;
  }

  tooltip.style.display = 'none';
  tooltip.setAttribute('aria-hidden', 'true');
  tooltip.dataset.pinned = 'false';
  tooltip.dataset.bookingKey = '';
}

function showPinnedTipForTarget(target, ev, ci) {
  const key = tooltipKey(ev, ci);
  const isSamePinned = tooltip.dataset.pinned === 'true' && tooltip.dataset.bookingKey === key;

  if (isSamePinned) {
    hideTip(true);
    return;
  }

  const rect = target.getBoundingClientRect();
  showTipAt(rect.left + (rect.width / 2), rect.bottom, ev, ci, { pinned: true, key });
}

function showTipForTarget(target, ev, ci, { pinned = false } = {}) {
  const rect = target.getBoundingClientRect();
  showTipAt(rect.left + (rect.width / 2), rect.bottom, ev, ci, { pinned });
}

function attachTooltipHandlers(target, ev, ci, { keyboardAccessible = false } = {}) {
  if (keyboardAccessible) {
    const propertyName = CALENDARS_META[ci]?.name || 'Calendário';
    target.setAttribute('aria-label', `${propertyName}: ${bookingTitle(ev)}. Entrada ${fmtFull(ev.start)}, saída ${fmtFull(ev.end)}, ${nightsLabel(bookingNights(ev))}.`);
    target.addEventListener('focus', () => {
      window.requestAnimationFrame(() => {
        if (document.activeElement === target && tooltip.dataset.pinned !== 'true') {
          showTipForTarget(target, ev, ci);
        }
      });
    });
    target.addEventListener('blur', () => hideTip(true));
    target.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      hideTip(true);
      target.blur();
    });
  } else {
    target.setAttribute('aria-hidden', 'true');
  }

  target.addEventListener('mouseenter', (event) => showTip(event, ev, ci));
  target.addEventListener('mousemove', moveTip);
  target.addEventListener('mouseleave', () => hideTip());
  target.addEventListener('click', (event) => {
    event.stopPropagation();
    showPinnedTipForTarget(target, ev, ci);
  });
}
