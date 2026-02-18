# M LOVE Memorial (PWA)

Memorial inbox + calendar web app built with React + Vite + PWA.

Current behavior:
- Locked emails stay hidden until unlock time.
- Newly unlocked emails appear automatically.
- Local notification is sent when unlocked (if permission is granted and app is active).

## Why HTML looked blank

Do not open the project root `index.html` by double click.
That file is a development entry and must run through Vite.

If GitHub Pages shows a blank page, it is usually because the source files
were served directly instead of the built output.
This repo publishes the prebuilt static files from `docs/`.

GitHub Pages setting should be:
- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/` (root)

If source stays at root, the root page automatically redirects to `/docs/`.

## Quick start (Windows)

- Double click `start-dev.bat`
- Browser opens at `http://localhost:5173`

## Preview production build (Windows)

- Double click `start-preview.bat`
- Browser opens at `http://localhost:4173`

## Manual commands

```bash
npm install
npm run dev -- --host
```

Build + preview:

```bash
npm run build
npm run preview -- --host --port 4173
```

## Project data folders

- `data/calendar/YYYY/*.json`
- `data/emails/YYYY/*.eml`

Those files are seeded into IndexedDB on first launch.
