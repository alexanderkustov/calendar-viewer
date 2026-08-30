const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');

const PROJECT_DIR = path.join(__dirname, '..');
const {
  activitiesForDate,
  canonicalName,
  dateKey,
  hasCheckout,
  nextDateKey
} = require('../today.js');

function requestRoute(url) {
  const { server } = require('../server.js');
  const headers = {};
  let body = '';
  let statusCode = 200;

  const request = { headers: { host: 'localhost' }, method: 'GET', url };
  const response = {
    end(content = '') {
      body = String(content);
    },
    setHeader(name, value) {
      headers[name] = value;
    },
    writeHead(code, responseHeaders = {}) {
      statusCode = code;
      Object.assign(headers, responseHeaders);
    }
  };

  server.emit('request', request, response);

  return { body, headers, statusCode };
}

test('today route redirects to its directory', () => {
  const response = requestRoute('/today');

  assert.equal(response.statusCode, 301);
  assert.equal(response.headers.Location, '/today/');
});

test('today route is served locally', () => {
  const response = requestRoute('/today/');

  assert.equal(response.statusCode, 200);
  assert.doesNotMatch(response.body, /<h1[^>]*>Entradas e saídas<\/h1>/);
});

test('today page loads both day lists', async () => {
  const html = await fs.readFile(path.join(PROJECT_DIR, 'today/index.html'), 'utf8');

  assert.match(html, /id="todayList"/);
  assert.match(html, /id="tomorrowList"/);
  assert.match(html, /\.\.\/today\.js/);
});

test('today filter matches event end dates', () => {
  const targetDate = '2026-08-29';
  const events = [
    {
      start: { type: 'date', value: '2026-08-27' },
      end: { type: 'date', value: targetDate }
    }
  ];

  assert.equal(hasCheckout(events, targetDate), true);
  assert.equal(hasCheckout(events, '2026-08-30'), false);
});

test('today filter uses Lisbon time', () => {
  const lateUtcDate = new Date('2026-08-29T23:30:00.000Z');

  assert.equal(dateKey(lateUtcDate), '2026-08-30');
});

test('today list merges booking feeds', () => {
  assert.equal(canonicalName('Antero A7 booking'), 'Antero A7');
});

test('today route marks entries and exits', () => {
  const targetDate = '2026-08-30';
  const events = [
    {
      start: { type: 'date', value: targetDate },
      end: { type: 'date', value: '2026-09-02' }
    },
    {
      start: { type: 'date', value: '2026-08-27' },
      end: { type: 'date', value: targetDate }
    }
  ];

  assert.deepEqual(activitiesForDate(events, targetDate), ['Entrada', 'Saída']);
});

test('today route includes tomorrow across month boundaries', () => {
  assert.equal(nextDateKey('2026-08-31'), '2026-09-01');
});
