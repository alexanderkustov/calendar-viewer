# Calendar Viewer

https://calendar-viewer-production.up.railway.app/

A lightweight Node.js + vanilla JavaScript web app that shows Airbnb iCal availability across multiple properties in a single 90-day timeline view.

## Features

- Aggregates three Airbnb iCal feeds through a local proxy (`/api/ical`) to avoid browser CORS issues.
- Displays bookings in a month-by-month timeline.
- Shows monthly occupancy percentages per property.
- Lets you toggle each property on/off in the UI.
- Protects access with a simple password gate.

## Project structure

- `server.js` — HTTP server, static file serving, iCal proxy API, and password check.
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

When prompted, enter the app password currently defined in `server.js`.

## Configuration notes

- **Port**: set `PORT` environment variable to override the default (`3000`).
- **Calendars**: edit the `CALENDARS` array in `server.js`.
- **Password**: edit the `PASSWORD` constant in `server.js`.

> ⚠️ Security note: the current password protection is intentionally simple and suitable only for low-risk/private usage.

## API endpoints

- `GET /api/calendars` — list of calendar IDs and names.
- `GET /api/ical?id=<index>` — proxied iCal file for a calendar.

For protected routes, provide password either as:

- query parameter: `?password=...`
- header: `x-password: ...`

## Deploy

The repository includes `railway.toml`, so it can be deployed to Railway with the Node start command.
