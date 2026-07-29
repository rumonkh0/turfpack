# TurfSlot — Backend Architecture

Detailed reference for the `server/` package: the Express API that powers both the web app and the embedded desktop app.

---

## 1. Runtime Topology

The **same Express app** (`server/app.js`) runs in two modes, selected purely by environment variables — there is no separate codebase.

| | Web mode | Desktop mode |
|---|---|---|
| Process | `node server.js` (or nodemon) | Electron `desktop/main.js` imports `app.js` and `app.listen()`s on `127.0.0.1` |
| DB path | `server/data/turfslot.sqlite` (default) | `SQLITE_PATH` → Electron `userData/data/…` |
| Serves client | Only if `NODE_ENV=production` or `SERVE_CLIENT=true` | Always (`SERVE_CLIENT=true`) |
| `/api/license` | **Not mounted** (no `SQLITE_PATH`) | Mounted |
| Auth | Real login | License-gated silent auto-login |
| Uploads | Cloudinary (if keys set) | Local disk (`LOCAL_UPLOAD_DIR`) |

**Key env vars:** `PORT`, `NODE_ENV`, `SERVE_CLIENT`, `SQLITE_PATH`, `LOCAL_UPLOAD_DIR`, `JWT_SECRET`, `DESKTOP_TRUSTED_MODE`, `LICENSE_STATUS`, `MACHINE_ID`, `DEFAULT_ADMIN_{NAME,EMAIL,PASSWORD}`, `CLOUDINARY_{CLOUD_NAME,API_KEY,API_SECRET}`.

> `.env.example` still lists `MONGODB_URI` — that is stale. Mongo is not used (see §3).

---

## 2. Boot Sequence

```
server.js
  ├─ dotenv.config()
  ├─ connectDB()            → config/db.js → initDatabase()   (db/sqlite.js)
  │      • opens SQLite, PRAGMA journal_mode = WAL
  │      • CREATE TABLE IF NOT EXISTS × 8
  │      • runs ad-hoc bookings migration
  │      • seeds default admin users
  └─ app.listen(PORT)
```

Desktop boot (`desktop/main.js`) differs: it sets all env vars first, then `import("../server/app.js")` (lazily, because `app.js` reads `NODE_ENV`/`SERVE_CLIENT` at module-init time), calls `connectDB()`, `app.listen(127.0.0.1)` with EADDRINUSE port-walking (5000→5100), verifies the license against the `license_key` app-setting, then opens the browser window.

---

## 3. Persistence Layer — `db/sqlite.js` (the heart of the backend)

**Critical:** `server/models/*.js` are Mongoose schemas that **nothing imports**. They are dead reference code. All data access flows through the hand-rolled `better-sqlite3` layer in `db/sqlite.js`. To change data shape, edit `sqlite.js` — editing a Mongoose model has zero runtime effect.

### Native module loading
`loadBetterSqlite3()` tries multiple paths so the native binding resolves whether running from source, from an unpacked ASAR (`app.asar.unpacked`), or inside the ASAR. After any Electron/native change, run `npm run desktop:rebuild-native`.

### `TABLE_CONFIG` — the schema contract
A single object drives all generic CRUD. Per table it declares:
- `columns` — writable columns (whitelist for INSERT/UPDATE; anything not listed is silently dropped).
- `jsonColumns` — columns serialized to JSON text on write, `JSON.parse`d on read.
- `defaults` — merged under the payload on `createRecord`.
- `allowedSort` — whitelist of sortable fields (guards against SQL injection via `sort`).

Tables: `users`, `turfs`, `bookings`, `payments`, `products`, `orders`, `tournaments`, plus a key/value `app_settings` table (no TABLE_CONFIG entry — accessed only via `getSetting`/`setSetting`).

### Row normalization (`parseRow`)
Every row returned by the helpers is normalized so controllers/clients see a Mongo-ish shape:
- `id` is copied to `_id`.
- `created_at` → exposed as both `createdAt` and `created_date`, then the raw `created_at` key is deleted.
- `jsonColumns` are parsed (fallback to `null` on malformed JSON).
- `users.password` is stripped unless `{ includePassword: true }`.

### Sort mapping (`sortToOrderBy`)
Accepts comma-separated fields with `-` prefix for DESC (e.g. `-createdAt,name`). `createdAt`/`created_date` are mapped to the real `created_at` column. Fields not in `allowedSort` are ignored. Falls back to `created_at DESC`.

### Generic data-access API (used by every controller)
| Function | Purpose |
|---|---|
| `createRecord(table, payload)` | UUID `id` + ISO `created_at`, merges defaults, serializes JSON cols, INSERT, returns full row (incl. password) |
| `listRecords(table, {sort, limit, where, params})` | SELECT with ORDER BY + `LIMIT` (default 500), optional raw `where` + bound `params` |
| `findById(table, id, options)` | single row by PK |
| `findOne(table, where, params, options)` | single row by raw WHERE clause |
| `updateById(table, id, payload)` | UPDATE only whitelisted columns; no-op returns current row |
| `deleteById(table, id)` | returns boolean (`changes > 0`) |
| `incrementColumn(table, id, column, value)` | atomic `COALESCE(col,0) + value` — used for product stock |
| `clearAllTables()` | wipes all data (used by seed) |
| `getSetting(key)` / `setSetting(key, value)` | `app_settings` upsert (license key, desktop user id) |

### IDs & timestamps
IDs are `crypto.randomUUID()` **strings** (not integers, not ObjectIds). `created_at` is an ISO-8601 string set at insert time. Money columns are `REAL`.

### Migrations
Migration is ad-hoc and destructive. On boot, if `bookings` lacks `paid_amount`/`payment_history`, the table is **`DROP`ped and recreated** (data loss). When adding a column you must update **both** the `CREATE TABLE` DDL and the table's `TABLE_CONFIG.columns`, or writes silently drop the field.

### Default-user seeding
`initDatabase()` seeds two admin accounts if absent: the configured `DEFAULT_ADMIN_*` (default `rumon@turfslot.com` / `00000000`) and `admin@mail.com` / `00000000`. Passwords are bcrypt-hashed.

---

## 4. HTTP Layer — `app.js`

Middleware order:
1. `express.json()` + `cookie-parser`
2. `morgan("dev")` — only when `NODE_ENV=development`
3. **CORS** — dynamic origin check: localhost/127.0.0.1 regex, an explicit allowlist, and any `*.rumon.top`; `credentials: true`. Preflight handled globally.
4. `helmet({ crossOriginResourcePolicy: false })`
5. Routers under `/api/*`
6. `/api/license` — mounted **only if** `SQLITE_PATH` is set
7. `/uploads` static — only if the local upload dir exists
8. SPA fallback — when serving the client, any non-`/api/` path returns `client/dist/index.html` (dist path resolved from several candidates incl. ASAR layouts)
9. `errorHandler` (last)

---

## 5. Request Pipeline (per resource)

```
routes/<x>Routes.js
   → protect / authorize('admin')        (middleware/auth.js)
   → controller fn wrapped in asyncHandler (middleware/async.js)
        → db/sqlite.js helpers
        → res.json({ success, data, [count] })
   → on throw → ErrorResponse → errorHandler → { success:false, error }
```

- **`asyncHandler`** — `Promise.resolve(fn).catch(next)`; removes try/catch from controllers.
- **`ErrorResponse`** — `Error` subclass carrying `statusCode`.
- **`errorHandler`** — still contains Mongoose-specific branches (`CastError`, `11000`, `ValidationError`) that are now vestigial; default 500.

### Response envelope
Success: `{ success: true, data, count? }`. Error: `{ success: false, error }`. The client's `api/client.js` unwraps `.data`.

---

## 6. Authentication & Authorization — `middleware/auth.js`

- **`protect`** — extracts JWT from `Authorization: Bearer <t>` **or** the `token` cookie, `jwt.verify` with `JWT_SECRET`, loads `req.user = findById("users", decoded.id)`. 401 on missing/invalid/absent user.
- **`authorize(...roles)`** — 403 unless `req.user.role` is in `roles`. Roles seen: `user`, `admin`.
- **Token issuance** (`sendTokenResponse` in `authController`) — `jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' })`, also sets an httpOnly cookie. `secure` cookie only when `production` **and not** desktop (`!SQLITE_PATH`). Returns `{ success, token, user }`.

> Note: JWT payload uses `user._id` (the normalized alias), while `protect` reads `decoded.id` — consistent because `_id === id`.

### Desktop auto-login — `authController.desktopAutoLogin`
`POST /api/auth/desktop-auto-login`. Guarded by `DESKTOP_TRUSTED_MODE === "true"` (else 404) and `LICENSE_STATUS === "active"` (else 403). Resolves the admin account by preference order: configured email → persisted `desktop_user_id` setting → legacy `admin@admin.com` → create new. Forces the account to `role: admin`, `status: active`, persists `desktop_user_id`, and issues a token. This is why the desktop app skips the login screen.

---

## 7. API Surface

All under `/api`. **Auth column:** Public / User (any authed) / Admin.

### auth (`/auth`)
| Method | Path | Access |
|---|---|---|
| POST | `/register` | Public |
| POST | `/login` | Public |
| POST | `/desktop-auto-login` | Public (desktop+license gated) |
| GET | `/me` | User |

### turfs (`/turfs`)
| GET `/` | Public | supports `?select=`, `?sort=`, `?limit=`, and equality filters on any query param |
| GET `/:id` | Public |
| POST `/` · PUT `/:id` · DELETE `/:id` | Admin | image cleanup via Cloudinary on replace/delete |

### bookings (`/bookings`)
| GET `/` | User | GET `/:id` | User |
| POST `/` | User | **conflict check** + optional payment record |
| PUT `/:id` | User | DELETE `/:id` | Admin |

### payments (`/payments`)
| GET `/` | Admin | POST `/` | User |

### products (`/products`)
| GET `/` | Public | POST/PUT/DELETE | Admin (Cloudinary image cleanup) |

### orders (`/orders`)
| GET `/` | Admin | POST `/` | User (decrements product stock) | PUT `/:id` | Admin |

### tournaments (`/tournaments`)
| GET `/` | Public | POST `/` | Admin | PUT `/:id` | Admin |
*(a `deleteTournament` controller exists but is not routed.)*

### users (`/users`)
Router-level `protect` + `authorize('admin')` on **all** routes. GET/POST `/`, GET/PUT/DELETE `/:id`. Passwords hashed on create; on update a blank password is ignored, non-blank is re-hashed.

### upload (`/upload`)
`protect` + `POST /` `multipart/form-data` field **`file`**. Returns `{ file_url, public_id }`.

### license (`/license`, desktop only)
GET `/status` → `{ activated, machineId }`. POST `/activate` with `{ licenseKey }` — verifies via `desktop/license.js`, persists to `app_settings`.

---

## 8. Cross-cutting Business Logic

- **Booking conflict detection** (`createBooking`): rejects overlap for same `turf_id` + `date` where `status != 'cancelled'` and `start_hour < newEnd AND end_hour > newStart`. Backed by index `idx_bookings_turf_date_time`.
- **Booking → payment linkage**: creating a `paid`/`partial` booking also writes a `payments` row (amount = `paid_amount` for partial, else `total_price`).
- **Partial payments**: `bookings.paid_amount` + `bookings.payment_history` (JSON array of `{amount, date, method, txn_id, notes}`). Remaining = `total_price - paid_amount`.
- **Order → stock**: `createOrder` decrements `products.stock` per line item via `incrementColumn(..., -qty)`. (Note: no stock restore on order cancel/update.)
- **Image lifecycle**: turfs/products/users store `image_url` + `image_public_id`. On replace or delete, the old Cloudinary asset is destroyed; `local:`-prefixed ids are skipped (local-disk uploads).

---

## 9. File & Image Uploads — `middleware/upload.js`

Storage backend is chosen at load time by presence of all three Cloudinary env vars:
- **Cloudinary present** → `CloudinaryStorage`, folder `turfslot`, formats jpg/png/jpeg/webp.
- **Absent** (typical desktop) → `multer.diskStorage` into `LOCAL_UPLOAD_DIR`, filename `<ts>-<uuid><ext>`, served via `/uploads`.

Filter: image mimetypes only. Limit: 8 MB. `uploadController` detects Cloudinary vs local by whether `req.file.path` is an `http` URL and builds the returned `file_url`/`public_id` accordingly.

---

## 10. Seeding & Scripts

- `npm run seed` (`scripts/seed.js`) → `clearAllTables()` then inserts sample turfs/bookings/payments/products via `createRecord`.
- Boot-time seeding of admin users happens in `initDatabase()` (§3).
- `server/TurfSlot_API_Collection.json` — Postman collection for manual testing (no automated test suite exists).

---

## 11. Conventions & Gotchas

- ES modules throughout (`"type": "module"`).
- `snake_case` columns; JSON-array columns must be declared in `TABLE_CONFIG.jsonColumns` or they store `[object Object]`.
- Adding a column requires editing **both** the `CREATE TABLE` DDL and `TABLE_CONFIG.columns`.
- The `bookings` migration is destructive — it drops the table.
- `errorHandler`'s Mongoose branches are dead code but harmless.
- `deleteTournament` is implemented but unrouted.
- `sort`/`select`/equality filters are only as safe as the `allowedSort`/column whitelists — never interpolate arbitrary user fields into `where` outside those guards.
