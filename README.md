# Walkthru

3D home configurator and design review: builders publish homes, buyers explore, personalize and comment on them in the browser.

## How it works

The site is built from `src/` by `npm run build` (`scripts/build.mjs`):

- `/` — landing page (`src/landing.html` → `site/index.html`)
- `/playground` — the 3D player, floor plan editor and Studio (`src/head.html` + `src/css/*.css` + `src/body.html` + `src/*.js`). The JS is bundled with three.js and minified by esbuild into `site/assets/playground.<hash>.js` (cached for a year); `walkthru.html` is still produced as a single-file copy that loads three.js from a CDN.
- `/account` — sign-in, sign-up and settings (`src/account.html`).
- Designer extras live in `src/designer.js` (furniture, notes, dimensions, multi-select, mirror, door/window sizes, roof style and pitch, site) and `src/extras.js` (photo textures, PDF plan sheet, 360° panorama, video). `src/ui.js` holds the dockable toolbar, popovers, side panels and viewer tools (render styles, measure, sun study, saved views, export/import, areas and estimate, keyboard shortcuts).

When served with the API, the playground has two extra sides:

| Route | Who | What |
|---|---|---|
| `/playground#admin` | Studio (admin) | Project dashboard: create from a template or a design saved in the browser |
| `/playground#admin/p/<id>` | Studio | Edit the design (autosaves), share customer links, read comments, activity, versions, accept customer changes |
| `/playground#c/<token>` | Customer | Branded view of their home. Depending on the link: look and comment / also pick finishes / also change the floor plan. Edits go to their own copy; "Send" notifies the studio |

Old links on the root URL (`/#admin`, `/#c/<token>`) redirect to the playground. Without the API (e.g. the Claude artifact) the app runs exactly as before, on the browser alone.

## Accounts, email and customer links

- **Accounts** (`api/auth.js`, `api/team.js`): email + password (scrypt hashes), 30-day HttpOnly session cookie, workspaces with owner / admin / editor / viewer roles, email invites, password reset. Sign in at `/account`. Projects belong to a workspace; other workspaces can't see them.
- **Saved designs** (`api/designs.js`): signed-in playground designs sync to the account in the background and come down on other devices. Signed out they stay in the browser.
- **Customer links** can have an expiry date and a password (sent as `x-share-pass`). Expired links answer 410.
- **Email** (`api/_lib/mail.js`): customer link emails, comment / submission notifications to the team, studio replies to the customer, invites and password resets. Set `RESEND_API_KEY` and `MAIL_FROM` to send for real; without them every email is stored in the `outbox` table and printed in the dev server log.
- **Telemetry** (`src/track.js` → `api/log.js`): page views, a few product events and uncaught errors, first-party only. Owners and admins see a 30-day summary on `/account`.
- The old shared `ADMIN_KEY` still works as a studio key (it sees every project), so existing setups keep running.
- **Sign-in required**: the playground and Studio only open for signed-in people; signed-out visits go to `/account#login`. Customer links (`/playground#c/<token>`) stay open for buyers.
- **`ALLOW_SIGNUPS`** (default `true`): set to `false` to close public sign-up. Invited people can still join, and the very first account on a fresh install can always be created.
- Visible branding is "Demo" (`BRAND_NAME`, default `Demo`).

## Run locally

```sh
npm install
npm run dev        # http://localhost:8787  — uses .data/local.db (SQLite) unless .env.local points at Turso
npm run seed       # optional: a demo studio account (see scripts/seed.mjs for the login)
npm test           # API tests against a throwaway database
```

## Deploy (Vercel + Turso)

1. `turso db create home-studio` → `turso db show home-studio --url` and `turso db tokens create home-studio`
2. In Vercel, set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `ADMIN_KEY`, `BRAND_NAME` (see `.env.example`).
3. Run `npm install && npm run build`, then deploy (`npx vercel --prod`). Tables (and new columns) are created on the first request.

## Where things live

- **Turso (metadata)** — `projects`, `versions`, `shares` (customer links), `comments` (with 3D pins), `events` (activity feed).
- **Object storage (design JSON)** — `api/_lib/blob.js`. Keys: `projects/<id>/v<n>.json` for each version, `shares/<token>.json` for a customer's working copy.
  The default `db` driver keeps them in a Turso `blobs` table. To switch to S3 / R2 / GCS / Vercel Blob, add a driver with `put`, `get`, `del` and set `BLOB_DRIVER`. Nothing else changes.
- **API** — `api/health`, `api/projects`, `api/project`, `api/share`, `api/comments` (5 functions, inside Vercel's free-tier limit).

## Not built yet

- Angled or curved walls: rooms are rectangles (join several for L-shapes).
- Changing storey and ceiling heights: they are fixed for every design.
- Editing Sample 2: it is a hand-built model, not a floor plan.
- Billing, and a builder product catalogue shared across a workspace (photo textures are per browser).

## Demo limits (on purpose, for now)

- Customer links are bearer links: anyone with the URL can open them (they can be turned off from the studio).
