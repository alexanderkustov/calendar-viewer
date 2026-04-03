# Calendar Viewer

A lightweight vanilla JavaScript calendar timeline viewer published as a static site.

## How it works

- GitHub Actions runs `npm run sync:calendars` every hour.
- `scripts/sync-static-data.js` fetches each remote iCal feed, converts it to `data/calendar-<id>.json`, and updates `data/calendars.json` plus `data/manifest.json`.
- The browser only reads those generated JSON files.
- `server.js` is only a tiny local preview server for `npm start`.

## Files

- `calendar-sources.js` — source iCal feed list.
- `calendar-snapshot.js` — Node helpers for fetching feeds and converting iCal to JSON snapshots.
- `main.js` — browser-side loading, rendering, and occupancy calculations.
- `server.js` — local static preview server.
- `scripts/sync-static-data.js` — hourly/manual snapshot generator.

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

## Configuration

- Edit `CALENDARS` in `calendar-sources.js` to change source feeds.
- Edit `CALENDARS_META` in `main.js` to map source feeds onto property rows.
- Keep `CALENDARS` and `CALENDARS_META` in sync when adding or removing sources.
- Edit `LOCATION_ROUTES` in `main.js` to control tabs and route-only views.
- Edit `MAX_DAYS_AHEAD` and `INITIAL_VISIBLE_MONTHS` in `main.js` to tune the default horizon.

## Refreshing data

- Run `npm run sync:calendars` to refresh the committed snapshots manually.
- The sync writes into a staged directory and swaps `data/` only after the full refresh succeeds.
- If a source fails after retries, the previous snapshot is preserved and the failure is recorded in `data/manifest.json`.

## Deploy

GitHub Pages is deployed from the checked-in static files. The refresh workflow updates `data/`, and the Pages workflow publishes the site.

## Notes

- The generated `data/` files are public on GitHub Pages.
- There is no production API or live proxy anymore.
