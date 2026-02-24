const COLORS    = ['#c0392b', '#2e6da4', '#27795a'];
const DAYS_AHEAD = 90;

const CALENDARS_META = [
  { name: "Pardais 205" },
  { name: "Silchoro 1205" },
  { name: "Antero A7" },
];

let calData  = [null, null, null];
let visible  = [true, true, true]; // toggle state

// ─── Helpers ────────────────────────────────────────────────────────────────

function startOfDay(d) { const r = new Date(d); r.setHours(0,0,0,0); return r; }
function addDays(d, n)  { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function sameDay(a, b)  { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function fmtFull(d)     { return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); }
function clamp(v,lo,hi) { return Math.min(Math.max(v,lo),hi); }

const WEEKDAYS_SHORT = ['Mo','Tu','We','Th','Fr','Sa','Su'];
const MONTH_NAMES    = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── iCal Parse ─────────────────────────────────────────────────────────────

function parseICS(text) {
  const events = [];
  text = text.replace(/\r\n[ \t]/g,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
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
      if (key === 'DTEND')   ev.end   = parseICSDate(val, keyFull);
    }
  }
  return events;
}

function parseICSDate(val, keyFull) {
  val = val.trim();
  if (/VALUE=DATE/i.test(keyFull) || /^\d{8}$/.test(val)) {
    const s = val.replace(/^VALUE=DATE:/i,'');
    return new Date(+s.slice(0,4), +s.slice(4,6)-1, +s.slice(6,8));
  }
  const y=+val.slice(0,4),mo=+val.slice(4,6)-1,d=+val.slice(6,8);
  const h=+(val.slice(9,11)||0),mi=+(val.slice(11,13)||0),sec=+(val.slice(13,15)||0);
  if (val.endsWith('Z')) return new Date(Date.UTC(y,mo,d,h,mi,sec));
  return new Date(y,mo,d,h,mi,sec);
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
  const today    = startOfDay(new Date());
  const rangeEnd = addDays(today, DAYS_AHEAD);
  const mStart   = new Date(year, month, 1);
  const mEnd     = new Date(year, month + 1, 0); // last day

  const from = new Date(Math.max(mStart, today));
  const to   = addDays(new Date(Math.min(mEnd, rangeEnd)), 1); // exclusive

  if (from >= to) return null;

  const totalDays = Math.round((to - from) / 86400000);
  const booked    = bookedDaysInRange(ci, from, to);
  return Math.round((booked / totalDays) * 100);
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

let userPassword = null;

function showPasswordModal() {
  document.getElementById('passwordModal').style.display = 'block';
  document.getElementById('passwordInput').value = '';
  document.getElementById('passwordError').textContent = '';
}

function hidePasswordModal() {
  document.getElementById('passwordModal').style.display = 'none';
}

function submitPassword() {
  const input = document.getElementById('passwordInput').value;
  userPassword = input;
  hidePasswordModal();
  loadAll();
}

window.addEventListener('DOMContentLoaded', () => {
  showPasswordModal();
});

async function loadAll() {
  if (!userPassword) {
    showPasswordModal();
    return;
  }
  setStatus('loading');
  calData = [null, null, null];
  const errors = [];

  await Promise.all(CALENDARS_META.map(async (meta, idx) => {
    try {
      const res = await fetch(`/api/ical?id=${idx}`, {
        headers: { 'x-password': userPassword }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Not a valid iCal response');
      calData[idx] = parseICS(text);
      setCalStatus(idx, 'loaded');
    } catch(e) {
      errors.push(`${CALENDARS_META[idx].name}: ${e.message}`);
      calData[idx] = [];
      setCalStatus(idx, 'error');
    }
  }));

  if (errors.length) {
    const banner = document.getElementById('errorBanner');
    banner.style.display = 'block';
    if (errors.some(e => e.includes('HTTP 401'))) {
      banner.textContent = 'Incorrect password. Please try again.';
      userPassword = null;
      showPasswordModal();
      return;
    }
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
  const bar  = document.getElementById('statusBar');
  let toggle = document.getElementById(`toggle-${idx}`);
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.id        = `toggle-${idx}`;
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
  const today     = startOfDay(new Date());
  const rangeEnd  = addDays(today, DAYS_AHEAD);

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
}

function buildMonth(monthStart, today, rangeEnd) {
  const year     = monthStart.getFullYear();
  const month    = monthStart.getMonth();
  const monthEnd = new Date(year, month + 1, 0);

  const section = document.createElement('div');
  section.className = 'month-section';

  // ── Month heading + occupancy bars ──────────────────────────────────────
  const heading = document.createElement('div');
  heading.className = 'month-heading';

  const titleEl = document.createElement('div');
  titleEl.className = 'month-title';
  titleEl.innerHTML = `<span class="month-name">${MONTH_NAMES[month]}</span><span class="month-year">${year}</span>`;
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
  section.appendChild(heading);

  // ── Calendar grid card ───────────────────────────────────────────────────
  const card = document.createElement('div');
  card.className = 'month-card';

  // Day-of-week header
  const dowRow = document.createElement('div');
  dowRow.className = 'dow-header';
  dowRow.innerHTML = `<div class="row-label-cell"></div>`;
  for (const d of WEEKDAYS_SHORT) {
    const cell = document.createElement('div');
    cell.className = 'dow-cell';
    cell.textContent = d;
    dowRow.appendChild(cell);
  }
  card.appendChild(dowRow);

  // Build weeks
  const firstDay = new Date(year, month, 1);
  const dowFirst = (firstDay.getDay() + 6) % 7;
  let weekStart  = addDays(firstDay, -dowFirst);

  while (weekStart <= monthEnd) {
    const weekEnd = addDays(weekStart, 6);
    if (weekEnd < today || weekStart > rangeEnd || weekEnd < new Date(year, month, 1)) {
      weekStart = addDays(weekStart, 7);
      continue;
    }

    // Date row
    const dateRow = document.createElement('div');
    dateRow.className = 'week-date-row';
    dateRow.innerHTML = `<div class="row-label-cell"></div>`;
    for (let d = 0; d < 7; d++) {
      const day  = addDays(weekStart, d);
      const cell = document.createElement('div');
      cell.className = 'date-cell' +
        (sameDay(day, today)       ? ' is-today'     : '') +
        (day.getMonth() !== month  ? ' out-of-month' : '') +
        (day < today || day > rangeEnd ? ' out-of-range' : '');
      cell.textContent = day.getDate();
      dateRow.appendChild(cell);
    }
    card.appendChild(dateRow);

    // Booking rows — only for visible calendars
    CALENDARS_META.forEach((meta, ci) => {
      if (!visible[ci]) return;

      const row = document.createElement('div');
      row.className = 'booking-row';

      const label = document.createElement('div');
      label.className = 'row-label-cell row-label';
      label.innerHTML = `<span class="label-dot" style="background:${COLORS[ci]}"></span>${meta.name}`;
      row.appendChild(label);

      for (let d = 0; d < 7; d++) {
        const day     = addDays(weekStart, d);
        const dayNext = addDays(day, 1);
        const outOfRange = day < today || day > rangeEnd;
        const outOfMonth = day.getMonth() !== month;

        const cell = document.createElement('div');
        cell.className = 'booking-cell' + (outOfRange || outOfMonth ? ' dimmed' : '');

        for (const ev of (calData[ci] || [])) {
          const evStart = startOfDay(ev.start);
          const evEnd   = startOfDay(ev.end);
          if (evEnd <= day || evStart >= dayNext) continue;

          const startsHere = sameDay(evStart, day);
          const endsHere   = sameDay(evEnd, dayNext) || sameDay(evEnd, day);
          let segType = 'mid';
          if (startsHere && endsHere) segType = 'only';
          else if (startsHere)        segType = 'start';
          else if (endsHere)          segType = 'end';

          const seg = document.createElement('div');
          seg.className = `booking-seg seg-${segType}`;
          seg.style.setProperty('--bar-color', COLORS[ci]);

          if (segType === 'start' || segType === 'only') {
            const lbl = document.createElement('span');
            lbl.className   = 'seg-text';
            lbl.textContent = ev.summary || '';
            seg.appendChild(lbl);
          }

          seg.addEventListener('mouseenter', e => showTip(e, ev, ci));
          seg.addEventListener('mousemove', moveTip);
          seg.addEventListener('mouseleave', hideTip);
          cell.appendChild(seg);

          if (startsHere) {
            const b = document.createElement('div');
            b.className = 'ci-badge ci-in';
            b.textContent = '↓';
            cell.appendChild(b);
          }
          if (endsHere && segType !== 'start') {
            const b = document.createElement('div');
            b.className = 'ci-badge ci-out';
            b.textContent = '↑';
            cell.appendChild(b);
          }
        }
        row.appendChild(cell);
      }
      card.appendChild(row);
    });

    const sep = document.createElement('div');
    sep.className = 'week-sep';
    card.appendChild(sep);

    weekStart = addDays(weekStart, 7);
  }

  section.appendChild(card);
  return section;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

const tooltip = document.getElementById('tooltip');

function showTip(e, ev, ci) {
  const nights = Math.round((startOfDay(ev.end) - startOfDay(ev.start)) / 86400000);
  tooltip.innerHTML = `
    <strong>${ev.summary || 'Booking'}</strong>
    <div class="tip-row tip-in">↓ Check-in &ensp;${fmtFull(ev.start)}</div>
    <div class="tip-row tip-out">↑ Check-out  ${fmtFull(ev.end)}</div>
    <div class="tip-nights">${nights} night${nights !== 1 ? 's' : ''}</div>`;
  tooltip.style.borderColor = COLORS[ci];
  tooltip.style.display = 'block';
  moveTip(e);
}
function moveTip(e) {
  tooltip.style.left = (e.clientX + 14) + 'px';
  tooltip.style.top  = (e.clientY + 14) + 'px';
}
function hideTip() { tooltip.style.display = 'none'; }

loadAll();