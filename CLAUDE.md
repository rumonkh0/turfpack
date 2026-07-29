# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

TurfSlot is a turf (sports ground) booking and management system that ships two ways from one codebase:

- **Web app** — Vite/React SPA (`client/`) talking to an Express API (`server/`).
- **Desktop app** — Electron shell (`desktop/`) that boots the same Express server on `127.0.0.1`, serves the built client, and stores data in a local SQLite file. Desktop builds are license-gated (hardware-locked).

The repo is a monorepo of three independently-installed npm packages: root (`package.json`, desktop/electron tooling), `client/`, and `server/`. Each has its own `node_modules`.

## Commands

Run these from the directory that owns the package.

**Client** (`cd client`):
- `npm run dev` — Vite dev server (default `http://localhost:5173`)
- `npm run build` — production build to `client/dist`
- `npm run lint` / `npm run lint:fix` — ESLint (flat config, `eslint.config.js`)
- `npm run typecheck` — `tsc` type-check of JSX via `jsconfig.json` (`checkJs: true`)

**Server** (`cd server`):
- `npm run dev` — nodemon on `server.js` (default port 5000)
- `npm start` — plain node
- `npm run seed` — reset all tables and load sample data (`scripts/seed.js`)

**Desktop / packaging** (repo root):
- `npm run desktop:start` — build client, rebuild native `better-sqlite3` for Electron, launch the app in production mode
- `npm run desktop:pack:win` — build the Windows `.exe` installer (needs wine/xvfb on Linux; see `DESKTOP_BUILD.md`)
- `npm run desktop:pack:deb` — build the Linux `.deb`
- `npm run desktop:reset-user` — reset the desktop admin user
- `npm run desktop:rebuild-native` — rebuild `better-sqlite3` against Electron's ABI (run after any native-module change)

There is no automated test suite. `server/TurfSlot_API_Collection.json` is a Postman collection for manual API testing.

## Architecture

### Persistence — SQLite only, models are legacy

**Critical:** `server/models/*.js` are Mongoose schemas kept only as reference/documentation. **No controller or route imports them.** All persistence goes through the hand-rolled `better-sqlite3` layer in `server/db/sqlite.js`. When you change data shape, edit `sqlite.js`, not the Mongoose model.

`server/db/sqlite.js` is the single source of truth for the schema and the generic data-access API:
- `TABLE_CONFIG` declares each table's writable `columns`, `jsonColumns` (serialized to/from JSON text), `defaults`, and `allowedSort` whitelist.
- `initDatabase()` runs `CREATE TABLE IF NOT EXISTS` for `users`, `turfs`, `bookings`, `payments`, `products`, `orders`, `tournaments`, `app_settings`.
- Generic helpers used by every controller: `createRecord`, `listRecords`, `findById`, `findOne`, `updateById`, `deleteById`, `incrementColumn`, `clearAllTables`.
- `getSetting`/`setSetting` back the `app_settings` key/value table (license key, desktop user id, etc.).

The DB file path comes from `process.env.SQLITE_PATH`, else `server/data/turfslot.sqlite`. In desktop mode `main.js` points it at Electron's `userData` dir so it's writable post-install.

### Server request flow

`server.js` → `config/db.js` (`connectDB` = `initDatabase()`) → `app.js`. `app.js` mounts routers under `/api/*`, configures CORS (allowlist + `*.rumon.top` + localhost regex), Helmet, and—when `NODE_ENV=production` or `SERVE_CLIENT=true`—serves `client/dist` with SPA fallback. `/api/license` is only mounted when `SQLITE_PATH` is set (desktop mode).

Standard pattern per resource: `routes/<x>Routes.js` → `controllers/<x>Controller.js`. Controllers are wrapped in `middleware/async.js` (async error catcher) and throw `utils/errorResponse.js` (`ErrorResponse`), handled by `middleware/error.js`. Auth via `middleware/auth.js`: `protect` (JWT from `Authorization: Bearer` or `token` cookie) and `authorize(...roles)`.

### Desktop mode & auth

`desktop/main.js` sets env (`NODE_ENV=production`, `SERVE_CLIENT=true`, `DESKTOP_TRUSTED_MODE=true`, `JWT_SECRET`, default admin creds, `SQLITE_PATH`), starts Express, verifies the license, then opens a `BrowserWindow` pointed at the local server. When trusted + licensed, the client calls `POST /api/auth/desktop-auto-login` (`authController.desktopAutoLogin`) to silently sign in the default admin — no login screen.

### Licensing (desktop only)

Hardware-locked via HMAC-SHA256 in `desktop/license.js`: `licenseKey = HMAC(LICENSE_SALT, machineId)`, verified with constant-time compare. `desktop/keygen.js` generates keys for a machine ID (private dev tool — excluded from the packaged app via the `build.files` `!desktop/keygen.js`). Activation status lives in `app_settings` (`license_key`); `licenseController` exposes `/api/license/status` and `/api/license/activate`. Web builds have no license endpoint (returns 404), and the client treats a 404 as "web mode, skip the check".

### Client structure

- Entry `main.jsx` → `App.jsx`. `App.jsx` first checks license status, then wraps everything in `AuthProvider` (`lib/AuthContext.jsx`) + React Query (`lib/query-client.js`) + `react-router-dom`.
- **Routing is convention-based via `pages.config.js`.** That file's header says it is auto-generated — each file in `pages/` is registered as a route by its name (e.g. `pages/Bookings.jsx` → `/Bookings`). Only `mainPage` is meant to be hand-edited. Add a page by creating a file in `pages/`, not by hand-wiring routes. (The `products/*` pages are the exception — wired explicitly in `App.jsx` with `ProductsLayout`.)
- API access is centralized in `src/api/client.js` (`apiClient`): `apiClient.entities.<Entity>` gives `list/get/create/update/delete`, plus `apiClient.auth`, `apiClient.integrations.Core.UploadFile`, and `apiClient.license`. `VITE_API_URL` selects the backend (`/api` in desktop, `http://localhost:5000/api` by default in dev). `src/api/base44Client.js` is an in-memory mock store (legacy).
- UI: Tailwind + shadcn/ui primitives in `components/ui/` (config in `components.json`). Path alias `@` → `client/src`. Feature components under `components/<feature>/`.
- Auth token is stored in `localStorage` and sent as a Bearer header by `client.js`.

## Engineering Principles
- Keep file modular and reusable. If a controller or component is growing too large, propose a split before adding more.
- New tables/columns: update TABLE_CONFIG AND the CREATE TABLE statement
  in the same change — never one without the other.
- Prefer small, composable functions over long ones with multiple
  responsibilities crammed together.

## Conventions

- ES modules everywhere (`"type": "module"` in all three packages).
- API responses are `{ success, data, ... }`; `client.js` unwraps `.data`. Errors are `{ success: false, error }`.
- SQLite columns are `snake_case` (e.g. `customer_name`, `total_price`, `payment_status`); JSON-array columns (e.g. `turfs.amenities`, `bookings.payment_history`) are declared in `TABLE_CONFIG.jsonColumns`.
- Bookings track partial payments via `paid_amount` + a `payment_history` JSON array; see `PARTIAL_PAYMENT_PLAN.md` for the data model and UI flow.
- Money is Bangladeshi Taka (৳); payment methods include `bkash`, `nagad`, `rocket`, `cash`, `card`.

## Gotchas

- After changing anything native or Electron-related, run `npm run desktop:rebuild-native` — `better-sqlite3` must match Electron's ABI or the desktop app won't boot.
- `sqlite.js` includes ad-hoc migration logic (e.g. rebuilding the `bookings` table). When adding a column, update both the `CREATE TABLE` and the table's `TABLE_CONFIG.columns`, or writes will silently drop the field.
- Editing a Mongoose model in `server/models/` has **no runtime effect** — it's dead code for the running app.
