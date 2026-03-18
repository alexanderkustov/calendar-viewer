# Calendar Viewer

https://calendar-viewer-production.up.railway.app/

A lightweight Node.js + vanilla JavaScript web app that shows iCal availability across multiple properties in a timeline view.

## Features

- Aggregates six iCal feeds (Airbnb + Booking.com) through a local proxy (`/api/ical`) to avoid browser CORS issues.
- Displays bookings in a month-by-month timeline.
- Shows monthly occupancy percentages per property.
- Splits the view into **Albufeira** and **Portimao** tabs, defaulting to **Albufeira**.
- Shows the next check-out date for each property in text form in the top controls.
- Lets you toggle each property on/off in the UI.
- Shows the current month + next month by default, with a **Load more** button for additional months.

## Project structure

- `server.js` — HTTP server, static file serving, and iCal proxy API.
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
- **Property grouping and tabs**: edit `CALENDARS_META` in `main.js` to control how one or more source feeds map to a single property row and location tab.
- **Maximum time horizon**: edit `MAX_DAYS_AHEAD` in `main.js` (currently `180`).
- **Initial months shown**: edit `INITIAL_VISIBLE_MONTHS` in `main.js` (currently `2`).

## API endpoints

- `GET /api/calendars` — list of source calendar IDs and names.
- `GET /api/ical?id=<index>` — proxied iCal file for a source calendar.

Limitations:
- Airbnb page parsing is best-effort and can break if Airbnb changes page structure.

No authentication is currently required for API routes.

## Deploy

The repository includes `railway.toml`, so it can be deployed to Railway with the Node start command.
