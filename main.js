const COLORS = ['#3E92CF', '#60C6C9', '#1A558A', '#9B51E0', '#27AE60', '#F2994A', '#E76F51', '#2A9D8F', '#264653', '#E9C46A'];
const MAX_DAYS_AHEAD = 180;
const INITIAL_VISIBLE_MONTHS = 2;
const LOAD_MORE_MONTHS = 1;
const STATIC_DATA_DIR = 'data';
const APP_ROOT = document.documentElement.dataset.appRoot || '.';
const APP_ROOT_URL = new URL(APP_ROOT.endsWith('/') ? APP_ROOT : `${APP_ROOT}/`, window.location.href);
const PAGE_LOCATION_ID = window.__CALENDAR_VIEWER_LOCATION__ || null;
const LOCATION_ROUTES = [
  { id: 'albufeira', label: 'Albufeira', slug: '', showInTabs: true },
  { id: 'portimao', label: 'Portimao', slug: 'portimao', showInTabs: true },
  { id: 'mama', label: 'Mama', slug: 'mama', showInTabs: false }
];
const LOCATION_TABS = LOCATION_ROUTES.filter((location) => location.showInTabs);

const CALENDARS_META = [
  { name: "Pardais 205", location: 'albufeira', sources: [0] },
  { name: "Silchoro 1205", location: 'albufeira', sources: [1] },
  { name: "Antero A7", location: 'albufeira', sources: [2, 3] },
  { name: "Portimao J138", location: 'portimao', sources: [4] },
  { name: "Portimao G137", location: 'portimao', sources: [5] },
  { name: "Raul 24 - 1", location: 'mama', sources: [6] },
  { name: "Raul 24 - 3", location: 'mama', sources: [7] },
  { name: "Eulalia", location: 'mama', sources: [8] },
  { name: "Balaia 404", location: 'mama', sources: [9] },
  { name: "Balaia 405", location: 'mama', sources: [10] },
  { name: "Onda Verde", location: 'mama', sources: [11] },
  { name: "Aljezur", location: 'mama', sources: [12] },
  { name: "Pescadores", location: 'mama', sources: [13] },
  { name: "Eulalia", location: 'mama', sources: [14] }
];

let calData = new Array(CALENDARS_META.length).fill(null);
let calStatus = new Array(CALENDARS_META.length).fill('idle');
let visible = new Array(CALENDARS_META.length).fill(true); // toggle state
let activeLocation = LOCATION_TABS[0]?.id || LOCATION_ROUTES[0]?.id || null;
let visibleMonths = INITIAL_VISIBLE_MONTHS;

// ─── Helpers ────────────────────────────────────────────────────────────────

function startOfDay(d) { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function fmtFull(d) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtShort(d) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }
function bookingNights(ev) { return Math.max(1, Math.round((startOfDay(ev.end) - startOfDay(ev.start)) / 86400000)); }
function nightsLabel(nights) { return `${nights} night${nights !== 1 ? 's' : ''}`; }
function bookingTitle(ev) {
  const summary = (ev.summary || '').trim();
  if (!summary) return nightsLabel(bookingNights(ev));
  if (/\breserv(?:ed|ation)\b/i.test(summary)) return nightsLabel(bookingNights(ev));
  return summary;
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

const WEEKDAYS_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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

function activeLocationShowsTabs() {
  return LOCATION_ROUTES.find((location) => location.id === activeLocation)?.showInTabs ?? false;
}

function remainingCheckoutLabelForMonth(idx, year, month) {
  if (calStatus[idx] === 'loading') return '🚪: loading...';
  if (calStatus[idx] === 'error') return '🚪 unavailable';

  const remainingDates = remainingCheckoutDatesForMonth(idx, year, month);
  if (!remainingDates.length) return 'No 🚪 this month';
  return `🚪: ${remainingDates.map((date) => fmtShort(date)).join(', ')}`;
}

// ─── iCal Parse ─────────────────────────────────────────────────────────────

function parseICS(text) {
  const events = [];
  text = text.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let ev = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line === 'BEGIN:VEVENT') { ev = {}; }
    else if (line === 'END:VEVENT') {
      if (ev && ev.start && ev.end) events.push(ev);
      ev = null;
    } else if (ev) {
      const ci = line.indexOf(':');
      if (ci < 0) continue;
      const keyFull = line.slice(0, ci);
      const key = keyFull.split(';')[0].toUpperCase();
      const val = line.slice(ci + 1);
      if (key === 'SUMMARY') ev.summary = val;
      if (key === 'DTSTART') ev.start = parseICSDate(val, keyFull);
      if (key === 'DTEND') ev.end = parseICSDate(val, keyFull);
    }
  }
  return events;
}

function parseICSDate(val, keyFull) {
  val = val.trim();
  if (/VALUE=DATE/i.test(keyFull) || /^\d{8}$/.test(val)) {
    const s = val.replace(/^VALUE=DATE:/i, '');
    return new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
  }
  const y = +val.slice(0, 4), mo = +val.slice(4, 6) - 1, d = +val.slice(6, 8);
  const h = +(val.slice(9, 11) || 0), mi = +(val.slice(11, 13) || 0), sec = +(val.slice(13, 15) || 0);
  if (val.endsWith('Z')) return new Date(Date.UTC(y, mo, d, h, mi, sec));
  return new Date(y, mo, d, h, mi, sec);
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
    : LOCATION_TABS[0]?.id || LOCATION_ROUTES[0]?.id || null;
  if (initialLocation) {
    activeLocation = initialLocation;
  }
  renderControls();
  loadAll();
});

async function loadSourceCalendar(sourceId) {
  const staticRes = await fetch(assetUrl(`${STATIC_DATA_DIR}/calendar-${sourceId}.ics`), { cache: 'no-store' });
  if (staticRes.ok) {
    return staticRes.text();
  }

  const apiRes = await fetch(`/api/ical?id=${sourceId}`);
  if (!apiRes.ok) throw new Error(`HTTP ${apiRes.status}`);
  return apiRes.text();
}

async function loadAll() {
  setStatus('loading');
  const activeCalendars = calendarsForLocation(activeLocation);
  calData = new Array(CALENDARS_META.length).fill(null);
  calStatus = new Array(CALENDARS_META.length).fill('idle');
  activeCalendars.forEach(({ idx }) => {
    calStatus[idx] = 'loading';
  });
  document.getElementById('errorBanner').style.display = 'none';
  renderControls();
  const errors = [];

  await Promise.all(activeCalendars.map(async ({ meta, idx }) => {
    try {
      const allEvents = [];
      for (const sourceId of meta.sources) {
        const text = await loadSourceCalendar(sourceId);
        if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Not a valid iCal response');
        allEvents.push(...parseICS(text));
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
    banner.style.display = 'block';
    banner.textContent = 'Some calendars failed to load. Refresh the generated data files, or use the local Node server fallback. ' + errors.join(' | ');
  } else {
    document.getElementById('errorBanner').style.display = 'none';
  }

  setStatus('done');
  updateLastUpdatedLabel();
  renderCalendar();
}

function setStatus(state) {
  document.getElementById('loadingMsg').style.display = state === 'loading' ? 'flex' : 'none';
}

function setCalStatus(idx, state) {
  calStatus[idx] = state;
  renderControls();
}

function updateLastUpdatedLabel(date = new Date()) {
  const label = document.getElementById('lastUpdated');
  if (!label) return;
  const timestamp = date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  label.textContent = `Last updated: ${timestamp}`;
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

  LOCATION_TABS.forEach((location) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `location-tab${location.id === activeLocation ? ' active' : ''}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(location.id === activeLocation));
    tab.textContent = location.label;
    tab.addEventListener('click', () => {
      if (location.id === activeLocation) return;
      window.location.assign(locationUrl(location.id));
    });
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
    if (calStatus[idx] === 'error') toggle.classList.add('error');
    toggle.innerHTML = `
      <span class="toggle-dot"></span>
      <span class="toggle-copy">
        <span class="toggle-name">${meta.name}</span>
      </span>
      <span class="toggle-check">✓</span>`;
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

  container.innerHTML = '';

  if (!activeCalendars.length) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = `No calendars selected for ${activeLocationLabel()}.`;
    container.appendChild(emptyState);
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
    container.appendChild(buildMonth(monthStart, today, rangeEnd, activeCalendars));
  }

  syncLoadMoreButton(rangeEnd, hardLimit);
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
  badge.textContent = text;
  cell.appendChild(badge);
}

function addCheckoutMarker(cell, ev, ci) {
  const marker = document.createElement('div');
  marker.className = 'booking-seg seg-end seg-checkout-marker';
  marker.style.setProperty('--bar-color', colorForCalendar(ci));
  if (ev) {
    marker.addEventListener('mouseenter', e => showTip(e, ev, ci));
    marker.addEventListener('mousemove', moveTip);
    marker.addEventListener('mouseleave', hideTip);
  }
  cell.appendChild(marker);
}

function buildOccupancyRow(year, month, activeCalendars) {
  const row = document.createElement('div');
  row.className = 'occupancy-row';

  const labelCell = document.createElement('div');
  labelCell.className = 'occupancy-label-cell';
  labelCell.textContent = 'OCC';
  row.appendChild(labelCell);

  activeCalendars.forEach(({ idx: ci }) => {
    const cell = document.createElement('div');
    cell.className = 'occupancy-cell';
    cell.innerHTML = `<span class="occupancy-value" style="color:${colorForCalendar(ci)}">${occupancyForMonth(ci, year, month)}%</span>`;
    row.appendChild(cell);
  });

  return row;
}

function buildMonth(monthStart, today, rangeEnd, activeCalendars) {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const monthEnd = new Date(year, month + 1, 0);

  const section = document.createElement('div');
  section.className = 'month-section';

  // ── Month heading ───────────────────────────────────────────────────────
  const heading = document.createElement('div');
  heading.className = 'month-heading';

  const titleEl = document.createElement('div');
  titleEl.className = 'month-title';
  titleEl.textContent = `${MONTH_NAMES[month]} ${year}`;
  heading.appendChild(titleEl);
  section.appendChild(heading);

  // ── Calendar grid card ───────────────────────────────────────────────────
  const card = document.createElement('div');
  card.className = 'month-card';

  // Count visible calendars for CSS Grid
  const visibleCount = activeCalendars.length;
  // Fallback to 1 if none visible to avoid breaking grid
  card.style.setProperty('--cal-count', Math.max(1, visibleCount));

  // Calendar Header Row (Top of columns)
  const headerRow = document.createElement('div');
  headerRow.className = 'dow-header';
  headerRow.innerHTML = `<div class="cal-header-cell is-date">DATE</div>`;
  activeCalendars.forEach(({ meta, idx: ci }) => {
    const th = document.createElement('div');
    th.className = `cal-header-cell is-calendar${calStatus[ci] === 'error' ? ' error' : ''}`;
    th.innerHTML = `
        <span class="label-dot" style="background:${colorForCalendar(ci)}"></span>
      <span class="cal-header-copy">
        <span class="cal-header-name">${meta.name}</span>
        <span class="cal-header-meta">${remainingCheckoutLabelForMonth(ci, year, month)}</span>
      </span>`;
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

    // Day Label Cell (Leftmost column)
    const dateCell = document.createElement('div');
    dateCell.className = 'date-cell' + (sameDay(currentDay, today) ? ' is-today' : '');
    const dowStr = WEEKDAYS_SHORT[(currentDay.getDay() + 6) % 7];
    dateCell.innerHTML = `
      ${currentDay.getDate()}
      <span class="dow-label">${dowStr}</span>
    `;
    row.appendChild(dateCell);

    // Build booking cells for each visible calendar (Columns)
    activeCalendars.forEach(({ idx: ci }) => {

      const cell = document.createElement('div');
      cell.className = 'booking-cell';
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

        const seg = document.createElement('div');
        seg.className = `booking-seg seg-${segType}`;
        seg.style.setProperty('--bar-color', colorForCalendar(ci));

        // Add text label for start/only blocks
        if (segType === 'start' || segType === 'only') {
          const lbl = document.createElement('span');
          lbl.className = 'seg-text';
          lbl.textContent = bookingTitle(ev);
          seg.appendChild(lbl);
        }

        seg.addEventListener('mouseenter', e => showTip(e, ev, ci));
        seg.addEventListener('mousemove', moveTip);
        seg.addEventListener('mouseleave', hideTip);
        cell.appendChild(seg);
      }

      if (hasCheckOut) addCheckoutMarker(cell, firstCheckOut, ci);
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

function showTip(e, ev, ci) {
  const nights = bookingNights(ev);
  tooltip.innerHTML = `
    <strong>${bookingTitle(ev)}</strong>
    <div class="tip-row tip-in">↓ Check-in &ensp;${fmtFull(ev.start)}</div>
    <div class="tip-row tip-out">↑ Check-out  ${fmtFull(ev.end)}</div>
    <div class="tip-nights">${nightsLabel(nights)}</div>`;
  tooltip.style.borderColor = colorForCalendar(ci);
  tooltip.style.display = 'block';
  moveTip(e);
}
function moveTip(e) {
  tooltip.style.left = (e.clientX + 14) + 'px';
  tooltip.style.top = (e.clientY + 14) + 'px';
}
function hideTip() { tooltip.style.display = 'none'; }

window.loadMoreMonths = loadMoreMonths;
