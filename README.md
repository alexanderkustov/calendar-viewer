# Calendar Viewer

https://calendar-viewer-production.up.railway.app/

A lightweight vanilla JavaScript calendar timeline viewer that can run as a static site on GitHub Pages.

## Features

- Publishes generated calendar snapshots from Airbnb and Booking.com as static files under `data/`.
- Displays bookings in a month-by-month timeline.
- Shows monthly occupancy percentages per property in a footer row for each month, calculated across the full month.
- Splits the view into **Albufeira** and **Portimao** tabs, defaulting to **Albufeira** on `/`.
- Supports direct location routes for the visible locations, with route-only internal views that hide the tab bar while active.
- Shows the remaining check-out dates for each property within that month in the month table headers.
- Lets you toggle each property on/off in the UI.
- Shows the current month + next month by default, with a **Load more** button for additional months.
- Displays **Snapshot updated** or **Live refreshed** in the status line, using the source actually in use and the browser's local timezone.
- Includes a GitHub Actions workflow that refreshes the static calendar snapshots every hour.
- Runs an hourly in-browser refresh for open tabs and prefers live API data when a snapshot is stale or the user clicks **Refresh**.

## Project structure

- `server.js` — optional local HTTP server and iCal proxy fallback.
- `index.html` — main page markup.
- `albufeira/index.html`, `portimao/index.html`, `mama/index.html` — static route entrypoints for GitHub Pages.
- `main.js` — iCal parsing, data loading, occupancy calculation, and calendar rendering.
- `style.css` — app styling.
- `scripts/sync-static-data.js` — fetches remote iCal feeds into a staged directory, retries transient failures, and swaps the managed snapshot files into `data/` only after the full refresh succeeds.

## Prerequisites

- Node.js 18+ (Node 20 recommended)

## Run locally

```bash
npm run sync:calendars
npm start
```

Then open:

- `http://localhost:3000`
- `http://localhost:3000/albufeira/`
- `http://localhost:3000/portimao/`
- `http://localhost:3000/mama/`

## How Calendar Refreshing Works

The application uses a hybrid approach to ensure calendar data is as current as possible without overwhelming external providers or blocking the page load.

### 1. Static Snapshots (Background Sync)
- A GitHub Actions workflow runs every hour, executing `npm run sync:calendars` (`scripts/sync-static-data.js`).
- This script pulls the latest iCal feeds for every configured source, retries transient fetch failures, and safely writes them into the `data/` directory (e.g., `data/calendar-0.ics`).
- If a specific calendar feed still fails or times out, the script preserves its previous snapshot and records the failure in `data/manifest.json`.
- The new snapshots form the site's default data source, updated frequently in the background.

### 2. Frontend Data Loading (`main.js`)
On page load, the frontend decides whether to use the pre-generated static snapshots or query the live API for fresh data:
- It fetches `data/manifest.json` to check the `generatedAt` timestamp.
- If the snapshot is **older than 75 minutes**, the frontend considers it stale.
- **Normal Load**: If the snapshot is fresh, the app loads `data/calendar-<id>.ics`. If any static file fails to load, it automatically falls back to the live API (`/api/ical?id=<id>`).
- **Stale Load**: If the snapshot is stale, the app flips the priority and fetches from the live API first. If the live API fails, it falls back to the static snapshot.
- The status line reflects the source actually used: `Snapshot updated` for static data, `Live refreshed` when a live fetch supplied the data, and a preserved-count suffix when some sources were carried over from an earlier snapshot.

### 3. Manual and Auto-Refreshes
- **Manual Refresh**: Clicking the "Refresh" button forces a live fetch for all active calendars `loadAll({ preferLive: true })`.
- **Auto-Refresh**: If the user leaves the tab open, a background timer automatically triggers a live refresh every 60 minutes, bringing in fresh bookings without a full page reload.

## Configuration notes

- **Port**: set `PORT` environment variable to override the default (`3000`).
- **Source feeds**: edit the `CALENDARS` array in `server.js`.
- **Location routes**: edit `LOCATION_ROUTES` in `main.js`; set `showInTabs: false` for route-only views that should stay out of the tab bar.
- **Property grouping and tabs**: edit `CALENDARS_META` in `main.js` to control how one or more source feeds map to a single property row and location tab; keep each `location` value aligned with `LOCATION_ROUTES`.
- **Maximum time horizon**: edit `MAX_DAYS_AHEAD` in `main.js` (currently `180`).
- **Initial months shown**: edit `INITIAL_VISIBLE_MONTHS` in `main.js` (currently `2`).
- **Static refresh**: run `npm run sync:calendars` to refresh the committed `data/` snapshots manually. The sync writes into a staged directory and swaps files only after completion; if a calendar fetch fails after retries, the previous `calendar-<id>.ics` snapshot is preserved for that calendar and the failure is recorded in `data/manifest.json` under `staleCalendars`.

## Page routes

- `GET /` — default entrypoint, showing the Albufeira view first.
- `GET /albufeira/` — direct entrypoint for Albufeira calendars.
- `GET /portimao/` — direct entrypoint for Portimao calendars.
- `GET /mama/` — route-only view with its own calendars and no location tabs.
- Additional route-only internal views can be configured without appearing in the tabs.

## API endpoints

- `GET /api/calendars` — list of source calendar IDs and names.
- `GET /api/ical?id=<index>` — proxied iCal file for a source calendar.

The browser prefers the static snapshots in `data/` on first load, but manual refreshes and stale snapshots prefer the live proxy first and fall back to the committed data files if the proxy is unavailable.

Limitations:
- Airbnb page parsing is best-effort and can break if Airbnb changes page structure.
- The site now advertises `noindex` via `robots.txt`, page metadata, and the local server headers, but GitHub Pages still makes the generated `data/` files public. Only use this setup if that visibility is acceptable.

No authentication is currently required for API routes.

## Deploy to GitHub Pages

1. Push the repository to GitHub.
2. In the repository settings, enable GitHub Pages with **GitHub Actions** as the source.
3. Run the **Refresh Calendars** workflow once to create the first `data/` snapshots if they are not already committed.
4. The **Deploy Pages** workflow publishes the site on every push, and the refresh workflow keeps `data/` updated every hour with concurrency enabled so overlapping runs do not fight each other.
