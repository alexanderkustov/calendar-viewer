const COLORS = ['#3E92CF', '#60C6C9', '#1A558A', '#9B51E0', '#27AE60'];
const MAX_DAYS_AHEAD = 180;
const INITIAL_VISIBLE_MONTHS = 2;
const LOAD_MORE_MONTHS = 1;

const CALENDARS_META = [
  { name: "Pardais 205", sources: [0] },
  { name: "Silchoro 1205", sources: [1] },
  { name: "Antero A7", sources: [2, 3] },
  { name: "portimao J 138", sources: [4] },
  { name: "portimao G 347", sources: [5] }
];

let calData = new Array(CALENDARS_META.length).fill(null);
let visible = new Array(CALENDARS_META.length).fill(true); // toggle state
let visibleMonths = INITIAL_VISIBLE_MONTHS;

// ─── Helpers ────────────────────────────────────────────────────────────────

function startOfDay(d) { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function fmtFull(d) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }
function bookingNights(ev) { return Math.max(1, Math.round((startOfDay(ev.end) - startOfDay(ev.start)) / 86400000)); }
function nightsLabel(nights) { return `${nights} night${nights !== 1 ? 's' : ''}`; }
function bookingTitle(ev) {
  const summary = (ev.summary || '').trim();
  if (!summary) return nightsLabel(bookingNights(ev));
  if (/\breserv(?:ed|ation)\b/i.test(summary)) return nightsLabel(bookingNights(ev));
  return summary;
}
function calcRangeEnd(today, monthWindow) {
  const monthWindowEnd = new Date(today.getFullYear(), today.getMonth() + monthWindow, 0);
  const hardLimit = addDays(today, MAX_DAYS_AHEAD);
  return new Date(Math.min(monthWindowEnd, hardLimit));
}

const WEEKDAYS_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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
  const today = startOfDay(new Date());
  const rangeEnd = addDays(today, MAX_DAYS_AHEAD);
  const mStart = new Date(year, month, 1);
  const mEnd = new Date(year, month + 1, 0); // last day

  const from = new Date(Math.max(mStart, today));
  const to = addDays(new Date(Math.min(mEnd, rangeEnd)), 1); // exclusive

  if (from >= to) return null;

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
  // Password modal removed
});

async function loadAll() {
  setStatus('loading');
  calData = new Array(CALENDARS_META.length).fill(null);
  const errors = [];

  await Promise.all(CALENDARS_META.map(async (meta, idx) => {
    try {
      const allEvents = [];
      for (const sourceId of meta.sources) {
        const res = await fetch(`/api/ical?id=${sourceId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
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
    // No password errors
    banner.textContent = 'Some calendars failed to load. Make sure server.js is running. ' + errors.join(' | ');
  } else {
    document.getElementById('errorBanner').style.display = 'none';
  }

  setStatus('done');
  renderCalendar();
}

function setStatus(state) {
  document.getElementById('loadingMsg').style.display = state === 'loading' ? 'flex' : 'none';
}

function setCalStatus(idx, state) {
  const bar = document.getElementById('statusBar');
  let toggle = document.getElementById(`toggle-${idx}`);
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.id = `toggle-${idx}`;
    toggle.className = 'cal-toggle active';
    toggle.style.setProperty('--cal-color', COLORS[idx]);
    toggle.innerHTML = `
      <span class="toggle-dot"></span>
      <span class="toggle-name">${CALENDARS_META[idx].name}</span>
      <span class="toggle-check">✓</span>`;
    toggle.addEventListener('click', () => {
      visible[idx] = !visible[idx];
      toggle.classList.toggle('active', visible[idx]);
      renderCalendar();
    });
    bar.insertBefore(toggle, document.getElementById('refreshBtn'));
  }
  if (state === 'error') toggle.classList.add('error');
}

// ─── Render ──────────────────────────────────────────────────────────────────

function renderCalendar() {
  const container = document.getElementById('calendarContainer');
  const today = startOfDay(new Date());
  const rangeEnd = calcRangeEnd(today, visibleMonths);
  const hardLimit = addDays(today, MAX_DAYS_AHEAD);

  container.innerHTML = '';

  const months = [];
  let cursor = new Date(today.getFullYear(), today.getMonth(), 1);
  while (cursor <= rangeEnd) {
    months.push(new Date(cursor));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  for (const monthStart of months) {
    container.appendChild(buildMonth(monthStart, today, rangeEnd));
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
  marker.style.setProperty('--bar-color', COLORS[ci]);
  if (ev) {
    marker.addEventListener('mouseenter', e => showTip(e, ev, ci));
    marker.addEventListener('mousemove', moveTip);
    marker.addEventListener('mouseleave', hideTip);
  }
  cell.appendChild(marker);
}

function buildMonth(monthStart, today, rangeEnd) {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const monthEnd = new Date(year, month + 1, 0);

  const section = document.createElement('div');
  section.className = 'month-section';

  // ── Month heading + occupancy bars ──────────────────────────────────────
  const heading = document.createElement('div');
  heading.className = 'month-heading';

  const titleEl = document.createElement('div');
  titleEl.className = 'month-title';
  titleEl.innerHTML = `
    <div class="month-labels">
      <span class="month-tech-label">MONTH</span>
      <span class="month-tech-label">${MONTH_NAMES[month].toUpperCase()}</span>
      <span class="month-tech-label">YEAR</span>
      <span class="month-tech-label">${year}</span>
    </div>
    <div class="month-big-num">${month + 1}</div>
  `;
  heading.appendChild(titleEl);
  // Occupancy stats — one per visible calendar
  const statsEl = document.createElement('div');
  statsEl.className = 'month-stats';

  CALENDARS_META.forEach((meta, ci) => {
    if (!visible[ci]) return;
    const pct = occupancyForMonth(ci, year, month);
    if (pct === null) return;

    const stat = document.createElement('div');
    stat.className = 'occ-stat';
    stat.innerHTML = `
      <div class="occ-label">
        <span class="occ-dot" style="background:${COLORS[ci]}"></span>
        ${meta.name}
      </div>
      <div class="occ-bar-wrap">
        <div class="occ-bar-fill" style="width:${pct}%;background:${COLORS[ci]}"></div>
      </div>
      <span class="occ-pct" style="color:${COLORS[ci]}">${pct}%</span>`;
    statsEl.appendChild(stat);
  });

  heading.appendChild(statsEl);
  // Add horizontal line
  const hr = document.createElement('hr');
  hr.className = 'month-section-line';
  heading.appendChild(hr);
  section.appendChild(heading);

  // ── Calendar grid card ───────────────────────────────────────────────────
  const card = document.createElement('div');
  card.className = 'month-card';

  // Count visible calendars for CSS Grid
  const visibleCount = visible.filter(v => v).length;
  // Fallback to 1 if none visible to avoid breaking grid
  card.style.setProperty('--cal-count', Math.max(1, visibleCount));

  // Calendar Header Row (Top of columns)
  const headerRow = document.createElement('div');
  headerRow.className = 'dow-header';
  headerRow.innerHTML = `<div class="cal-header-cell">DATE</div>`;
  CALENDARS_META.forEach((meta, ci) => {
    if (!visible[ci]) return;
    const th = document.createElement('div');
    th.className = 'cal-header-cell';
    th.innerHTML = `<span class="label-dot" style="background:${COLORS[ci]}"></span>${meta.name}`;
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
    CALENDARS_META.forEach((meta, ci) => {
      if (!visible[ci]) return;

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
        seg.style.setProperty('--bar-color', COLORS[ci]);

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
  tooltip.style.borderColor = COLORS[ci];
  tooltip.style.display = 'block';
  moveTip(e);
}
function moveTip(e) {
  tooltip.style.left = (e.clientX + 14) + 'px';
  tooltip.style.top = (e.clientY + 14) + 'px';
}
function hideTip() { tooltip.style.display = 'none'; }


loadAll();
window.loadMoreMonths = loadMoreMonths;
