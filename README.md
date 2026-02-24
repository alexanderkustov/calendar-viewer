# Calendar Viewer

A lightweight Node.js + vanilla JavaScript app that shows Airbnb iCal availability across multiple properties in a shared 90-day timeline.

## Features

- Aggregates Airbnb iCal feeds through a local proxy (`/api/ical`) to avoid browser CORS issues.
- Displays bookings month-by-month.
- Shows monthly occupancy percentages per property.
- Lets you toggle each property on/off.
- Uses a simple password gate for both API and served frontend.

## Project structure

- `server.js` — Node HTTP server for the iCal proxy API and production static serving from `dist/`.
- `index.html` — app shell entry used by Vite.
- `src/main.js` — UI logic, iCal parsing, occupancy calculation, and timeline rendering.
- `src/style.css` — app styling.

## Prerequisites

- Node.js 18+ (Node 20 recommended)

## Run locally (Vite + API)

Install dependencies:

```bash
npm install
```

Run the frontend dev server:

```bash
npm run dev
```

Run the API server in another terminal:

```bash
npm start
```

Then open the Vite URL (usually `http://localhost:5173`).

## Build + production run

```bash
npm run build
npm start
```

This serves the Vite build output (`dist/`) from the Node server.

## Configuration

- **Server port**: `PORT` (default `3000`)
- **App password**: `APP_PASSWORD` (default value in `server.js`)
- **Calendars**: edit the `CALENDARS` array in `server.js`
- **Frontend API base (dev/remote API)**: `VITE_API_BASE`
  - Empty by default, so frontend calls same-origin `/api/...`
  - Example: `VITE_API_BASE=http://localhost:3000 npm run dev`

> ⚠️ Security note: the password protection is intentionally simple and only suitable for low-risk/private usage.

## API endpoints

- `GET /api/calendars` — list of calendar IDs and names.
- `GET /api/ical?id=<index>` — proxied iCal file for a calendar.

For protected routes, provide password either as:

- query parameter: `?password=...`
- header: `x-password: ...`

## Deploy

The repository includes `railway.toml` and can run using:

```bash
npm run build && npm start
```
