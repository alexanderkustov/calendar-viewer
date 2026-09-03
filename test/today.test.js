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
  isRafaelProperty,
  messageUrlFor,
  nextDateKey,
  renderTitle
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

test('airbnb-messages.json route is served locally', () => {
  const response = requestRoute('/airbnb-messages.json');

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Content-Type'], 'application/json; charset=utf-8');
});

test('airbnb-messages.json contains entries for all properties', async () => {
  const raw = await fs.readFile(path.join(PROJECT_DIR, 'airbnb-messages.json'), 'utf8');
  const config = JSON.parse(raw);
  const { CALENDARS } = require('../calendar-sources.js');

  for (const calendar of CALENDARS) {
    const name = canonicalName(calendar.name);
    assert.ok(name in config, `Missing config entry for ${name}`);
  }
});

test('messageUrlFor resolves URL by property name', () => {
  const map = {
    'Pardais 205': 'https://airbnb.com/messages/100',
    '336 Paraiso': 'https://airbnb.com/messages/200'
  };

  assert.equal(messageUrlFor('Pardais 205', map), 'https://airbnb.com/messages/100');
  assert.equal(messageUrlFor('Unknown', map), '');
});

test('renderTitle produces link when messageUrl exists', () => {
  global.document = {
    createElement(tag) {
      return {
        className: '',
        href: '',
        rel: '',
        setAttribute(key, val) {
          this[key] = val;
        },
        tagName: tag,
        target: '',
        textContent: '',
        title: ''
      };
    }
  };

  const node = renderTitle({
    messageUrl: 'https://airbnb.com/messages/100',
    name: 'Pardais 205'
  });

  assert.equal(node.tagName, 'a');
  assert.equal(node.href, 'https://airbnb.com/messages/100');
  assert.equal(node.target, '_blank');
  assert.equal(node.rel, 'noopener noreferrer');
  assert.equal(node.textContent, 'Pardais 205');
  delete global.document;
});

test('renderTitle produces span when messageUrl is absent', () => {
  global.document = {
    createElement(tag) {
      return {
        className: '',
        tagName: tag,
        textContent: ''
      };
    }
  };

  const node = renderTitle({
    messageUrl: '',
    name: 'Silchoro 404'
  });

  assert.equal(node.tagName, 'span');
  assert.equal(node.textContent, 'Silchoro 404');
  delete global.document;
});

test('isRafaelProperty identifies Albufeira and Portimao properties', () => {
  assert.equal(isRafaelProperty('Pardais 205'), true);
  assert.equal(isRafaelProperty('Silchoro 1205'), true);
  assert.equal(isRafaelProperty('Silchoro 404'), true);
  assert.equal(isRafaelProperty('Antero A7'), true);
  assert.equal(isRafaelProperty('Antero A7 booking'), true);
  assert.equal(isRafaelProperty('Portimao J138'), true);
  assert.equal(isRafaelProperty('Portimao G137'), true);

  assert.equal(isRafaelProperty('Raul 1'), false);
  assert.equal(isRafaelProperty('Aljezur'), false);
  assert.equal(isRafaelProperty('Pescadores'), false);
});

test('today page includes Today - Rafael section below main ones', async () => {
  const html = await fs.readFile(path.join(PROJECT_DIR, 'today/index.html'), 'utf8');

  assert.match(html, /Today - Rafael/);
  assert.match(html, /id="rafaelTodayList"/);
  assert.match(html, /id="rafaelTomorrowList"/);
});

