# Calendar Viewer

https://calendar-viewer-production.up.railway.app/

A lightweight Node.js + vanilla JavaScript web app that shows iCal availability across multiple properties in a single 180-day timeline view.

## Features

- Aggregates four iCal feeds (Airbnb + Booking.com) through a local proxy (`/api/ical`) to avoid browser CORS issues.
- Displays bookings in a month-by-month timeline.
- Shows nightly Airbnb base prices on free days for the next 30 days.
- Shows monthly occupancy percentages per property.
- Lets you toggle each property on/off in the UI.
- Renders a rolling 180-day forward-looking view.

## Project structure

- `server.js` — HTTP server, static file serving, iCal proxy API, and Airbnb price API.
- `index.html` — main page markup.
- `main.js` — iCal parsing, data loading, occupancy calculation, and calendar rendering.
- `style.css` — app styling.

## Prerequisites

- Node.js 18+ (Node 20 recommended)

## Run locally

```bash
npm start
```

Then open:

- `http://localhost:3000`

## Configuration notes

- **Port**: set `PORT` environment variable to override the default (`3000`).
- **Source feeds**: edit the `CALENDARS` array in `server.js`.
- **Pricing listings**: edit the `PRICE_PROPERTIES` array in `server.js` (one Airbnb listing per property ID).
- **Property grouping**: edit `CALENDARS_META` in `main.js` to control how one or more source feeds map to a single property row.
- **Time horizon**: edit `DAYS_AHEAD` in `main.js` (currently `180`).
- **Pricing horizon**: edit `PRICE_DAYS_AHEAD` in `main.js` (currently `30`).

## API endpoints

- `GET /api/calendars` — list of source calendar IDs and names.
- `GET /api/ical?id=<index>` — proxied iCal file for a source calendar.
- `GET /api/prices?propertyId=<index>&from=<YYYY-MM-DD>&days=<1-30>` — nightly base price lookup for one property/date range.

`/api/prices` responses include `entries[]` with:
- `status: "ok"` plus `amount` and `formatted` when a nightly price is available.
- `status: "missing"` when pricing is unavailable for that date.
- `cached: true|false` showing whether the value came from the in-memory cache.

Pricing cache TTL is 1 hour.

Limitations:
- Airbnb page parsing is best-effort and can break if Airbnb changes page structure.
- When no one-night base price is available (for example due to minimum-stay rules), the UI shows `-`.

No authentication is currently required for API routes.

## Deploy

The repository includes `railway.toml`, so it can be deployed to Railway with the Node start command.
