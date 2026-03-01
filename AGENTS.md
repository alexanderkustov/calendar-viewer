# AGENTS.md

## Scope

These instructions apply to the entire repository.

## Project intent

This is a small, dependency-light calendar timeline viewer. Favor clarity and maintainability over abstraction.

## Architecture boundaries

- Keep server and API behavior in `server.js`.
- Keep browser rendering and interaction logic in `main.js`.
- Keep markup in `index.html` and styling in `style.css`.
- Preserve the current plain Node.js static serving and proxy approach in `server.js`.

## Implementation guidelines

- Prefer vanilla JavaScript and Node core modules.
- Do not add frameworks, transpilers, or build tooling unless explicitly requested.
- Keep changes focused; avoid broad refactors unless required by the task.
- When editing calendar wiring, keep `CALENDARS` in `server.js` and `CALENDARS_META` in `main.js` in sync.

## Current behavior assumptions

- Authentication is currently disabled (no password gate in UI or API).
- Timeline range is controlled by `DAYS_AHEAD` in `main.js` (currently 180).
- `/api/calendars` returns source feeds, while the UI can merge multiple sources into one property.

## Verification

After code changes, run:

- `node --check server.js`
- `node --check main.js`

If UI behavior changes, start the app with `npm start` and verify in a browser.

## Documentation

- Update `README.md` when setup, behavior, config, or endpoints change.
- Keep README instructions short and actionable.
