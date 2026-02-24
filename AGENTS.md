# AGENTS.md

## Scope

These instructions apply to the entire repository.

## Purpose

This is a small calendar timeline project with minimal dependencies. Keep changes focused, readable, and easy to run locally.

## Development guidelines

- Prefer simple, dependency-free solutions (vanilla JS + Node core modules).
- Avoid introducing frameworks or build tooling unless explicitly requested.
- Keep UI behavior in `main.js` and server/API behavior in `server.js`.
- Preserve the current lightweight static serving pattern in `server.js`.

## Verification

After making changes, run lightweight checks where applicable:

- `node --check server.js`
- `node --check main.js`

If behavior changes affect user-visible UI, run the app and verify manually.

## Documentation

- Update `README.md` when setup, behavior, configuration, or endpoints change.
- Keep instructions concise and directly actionable.
