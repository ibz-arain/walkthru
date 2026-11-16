# Walkthru

3D home configurator and design review: builders publish homes, buyers explore, personalize and comment on them in the browser.

## How it works

The site has two pages, both built from `src/` by `build.sh`:

- `/` — landing page (`src/landing.html` → `site/index.html`)
- `/playground` — the 3D player, floor plan editor and Studio (`src/head.html` + `src/css/*.css` + `src/body.html` + `src/*.js` → `site/playground.html`). `src/ui.js` holds the dockable toolbar, popovers, side panels and viewer tools (render styles, measure, sun study, saved views, export/import, areas and estimate, keyboard shortcuts).

When served with the API, the playground has two extra sides:

| Route | Who | What |
|---|---|---|
| `/playground#admin` | Studio (admin) | Project dashboard: create from a template or a design saved in the browser |
| `/playground#admin/p/<id>` | Studio | Edit the design (autosaves), share customer links, read comments, activity, versions, accept customer changes |
| `/playground#c/<token>` | Customer | Branded view of their home. Depending on the link: look and comment / also pick finishes / also change the floor plan. Edits go to their own copy; "Send" notifies the studio |

Old links on the root URL (`/#admin`, `/#c/<token>`) redirect to the playground. Without the API (e.g. the Claude artifact) the app runs exactly as before, on the browser alone.

## Run locally

```sh
npm install
npm run dev        # http://localhost:8787  — uses .data/local.db (SQLite) unless .env.local points at Turso
```

## Deploy (Vercel + Turso)

1. `turso db create home-studio` → `turso db show home-studio --url` and `turso db tokens create home-studio`
2. In Vercel, set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `ADMIN_KEY`, `BRAND_NAME` (see `.env.example`).
3. Run `./build.sh`, then deploy (`npx vercel --prod`). Tables are created on the first request.

## Where things live

- **Turso (metadata)** — `projects`, `versions`, `shares` (customer links), `comments` (with 3D pins), `events` (activity feed).
- **Object storage (design JSON)** — `api/_lib/blob.js`. Keys: `projects/<id>/v<n>.json` for each version, `shares/<token>.json` for a customer's working copy.
  The default `db` driver keeps them in a Turso `blobs` table. To switch to S3 / R2 / GCS / Vercel Blob, add a driver with `put`, `get`, `del` and set `BLOB_DRIVER`. Nothing else changes.
- **API** — `api/health`, `api/projects`, `api/project`, `api/share`, `api/comments` (5 functions, inside Vercel's free-tier limit).

## Demo limits (on purpose, for now)

- One shared studio key, no user accounts or companies yet.
- Customer links are bearer links: anyone with the URL can open them (they can be turned off from the studio).
- No emails yet: the studio sees new activity on the dashboard and in each project's Activity tab.
