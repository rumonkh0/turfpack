# TurfSlot — Database Reference

Complete schema for the TurfSlot SQLite database. Source of truth: `server/db/sqlite.js` (there is **no** ORM — the Mongoose files in `server/models/` are dead reference code).

---

## Engine & File

- **Engine:** SQLite via `better-sqlite3` (synchronous, prepared statements).
- **Journal mode:** `WAL` (`PRAGMA journal_mode = WAL`) — expect `-wal` and `-shm` sidecar files next to the DB.
- **File location:**
  - Web / default: `server/data/turfslot.sqlite`
  - Desktop: `process.env.SQLITE_PATH` → Electron `userData/data/turfslot.sqlite`
- **Created/initialized by:** `initDatabase()` on server boot (`CREATE TABLE IF NOT EXISTS` for every table).

### Global conventions
| Aspect | Rule |
|---|---|
| Primary key | `id TEXT` = `crypto.randomUUID()` (string UUID, **not** integer/autoincrement) |
| Timestamps | `created_at TEXT` = ISO-8601 string set at insert; no `updated_at` anywhere |
| Money | `REAL` columns (e.g. `total_price`, `base_price`, `amount`) |
| JSON columns | stored as TEXT, `JSON.stringify` on write / `JSON.parse` on read (declared in `TABLE_CONFIG.jsonColumns`) |
| Naming | `snake_case` throughout |
| Read normalization | every row gets `_id` (=`id`), `createdAt` & `created_date` (=`created_at`); raw `created_at` deleted; `users.password` stripped unless `includePassword` |

There are **8 tables**: 7 domain tables + `app_settings`. No foreign-key constraints are declared — relationships (`turf_id`, `booking_id`, `product_id`) are logical only, enforced in controller code.

---

## Table: `users`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | TEXT | no | — | PK, UUID |
| `full_name` | TEXT | no | — | |
| `email` | TEXT | no | — | **UNIQUE** |
| `password` | TEXT | no | — | bcrypt hash; stripped from reads unless `includePassword` |
| `role` | TEXT | no | `'user'` | seen: `user`, `admin` |
| `reset_password_token` | TEXT | yes | — | present in schema, unused by controllers |
| `reset_password_expire` | TEXT | yes | — | present in schema, unused by controllers |
| `image_url` | TEXT | yes | — | |
| `image_public_id` | TEXT | yes | — | Cloudinary id or `local:<file>` |
| `status` | TEXT | no | `'active'` | seen: `active` |
| `created_at` | TEXT | no | — | ISO string |

- **Index:** `idx_users_email` on `(email)`.
- **jsonColumns:** none.
- **Config defaults (`createRecord`):** `role: 'user'`, `status: 'active'`.
- **Seeded on boot:** `DEFAULT_ADMIN_*` (default `rumon@turfslot.com` / `00000000`) and `admin@mail.com` / `00000000`, both `role: admin`, `status: active`.

---

## Table: `turfs`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | TEXT | no | — | PK |
| `name` | TEXT | no | — | |
| `type` | TEXT | no | — | |
| `size` | TEXT | yes | — | |
| `location` | TEXT | yes | — | |
| `description` | TEXT | yes | — | |
| `image_url` | TEXT | yes | — | |
| `image_public_id` | TEXT | yes | — | |
| `status` | TEXT | no | `'active'` | |
| `base_price` | REAL | no | `0` | |
| `peak_price` | REAL | no | `0` | |
| `night_price` | REAL | no | `0` | |
| `opening_hour` | INTEGER | no | `6` | 0–23 |
| `closing_hour` | INTEGER | no | `23` | 0–23 |
| `peak_hours_start` | INTEGER | no | `17` | |
| `peak_hours_end` | INTEGER | no | `21` | |
| `weekend_multiplier` | REAL | no | `1.2` | |
| `amenities` | TEXT (JSON) | yes | `[]` | **jsonColumn** — array |
| `created_at` | TEXT | no | — | |

- **jsonColumns:** `amenities`.
- **allowedSort:** `id, name, type, status, base_price, created_at`.
- Pricing fields drive slot-cost calculation (peak/night/weekend). Image cleanup on replace/delete.

---

## Table: `bookings`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | TEXT | no | — | PK |
| `turf_id` | TEXT | no | — | → `turfs.id` (logical) |
| `turf_name` | TEXT | yes | — | denormalized copy |
| `customer_name` | TEXT | no | — | |
| `customer_phone` | TEXT | no | — | |
| `customer_email` | TEXT | yes | — | |
| `date` | TEXT | no | — | booking day (string) |
| `start_hour` | INTEGER | no | — | |
| `end_hour` | INTEGER | no | — | |
| `duration_hours` | REAL | yes | — | |
| `total_price` | REAL | no | — | |
| `paid_amount` | REAL | no | `0` | partial-payment total so far |
| `payment_history` | TEXT (JSON) | yes | `[]` | **jsonColumn** — see below |
| `status` | TEXT | no | `'confirmed'` | `pending, confirmed, cancelled, completed, no_show` |
| `payment_status` | TEXT | no | `'unpaid'` | `paid, unpaid, partial, refunded` |
| `payment_method` | TEXT | no | `'bkash'` | `bkash, nagad, rocket, cash, card, other` |
| `notes` | TEXT | yes | — | |
| `txn_id` | TEXT | yes | — | |
| `created_at` | TEXT | no | — | |

- **Index:** `idx_bookings_turf_date_time` on `(turf_id, date, start_hour, end_hour)` — backs conflict detection.
- **jsonColumns:** `payment_history`.
- **allowedSort:** `id, date, start_hour, end_hour, status, payment_status, created_at`.
- **`payment_history` element shape:** `{ amount, date, method, txn_id, notes }`. Remaining balance = `total_price - paid_amount`.
- **Conflict rule** (enforced in `createBooking`, not the DB): same `turf_id` + `date`, `status != 'cancelled'`, and `start_hour < newEnd AND end_hour > newStart` → rejected.
- ⚠️ **Destructive migration:** on boot, if this table lacks `paid_amount`/`payment_history`, it is **DROPped and recreated** (data loss).

---

## Table: `payments`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | TEXT | no | — | PK |
| `booking_id` | TEXT | yes | — | → `bookings.id` (logical); null for non-booking sales |
| `amount` | REAL | no | — | |
| `status` | TEXT | no | `'completed'` | |
| `method` | TEXT | no | — | bkash/nagad/rocket/cash/card/other |
| `transaction_id` | TEXT | yes | — | |
| `customer_name` | TEXT | yes | — | |
| `customer_phone` | TEXT | yes | — | |
| `created_at` | TEXT | no | — | |

- **jsonColumns:** none. **allowedSort:** `id, amount, status, method, created_at`.
- Auto-created when a booking is saved with `payment_status` of `paid` (amount = `total_price`) or `partial` (amount = `paid_amount`).

---

## Table: `products`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | TEXT | no | — | PK |
| `name` | TEXT | no | — | |
| `category` | TEXT | no | — | |
| `price` | REAL | no | — | sell price |
| `cost_price` | REAL | no | `0` | |
| `stock` | INTEGER | no | `0` | decremented on order |
| `unit` | TEXT | no | `'pcs'` | |
| `sku` | TEXT | yes | — | |
| `status` | TEXT | no | `'active'` | |
| `image_url` | TEXT | yes | — | |
| `image_public_id` | TEXT | yes | — | |
| `description` | TEXT | yes | — | |
| `low_stock_alert` | INTEGER | no | `5` | threshold for UI alerts |
| `created_at` | TEXT | no | — | |

- **jsonColumns:** none. **allowedSort:** `id, name, category, price, stock, status, created_at`.
- Stock changes via `incrementColumn('products', id, 'stock', -qty)` on order creation (atomic `COALESCE(stock,0) + delta`).

---

## Table: `orders`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | TEXT | no | — | PK |
| `customer_name` | TEXT | yes | — | |
| `customer_phone` | TEXT | yes | — | |
| `items` | TEXT (JSON) | yes | `[]` | **jsonColumn** — line items |
| `total_amount` | REAL | no | — | |
| `status` | TEXT | no | `'confirmed'` | |
| `payment_method` | TEXT | no | `'cash'` | |
| `payment_status` | TEXT | no | `'paid'` | |
| `notes` | TEXT | yes | — | |
| `created_at` | TEXT | no | — | |

- **jsonColumns:** `items`. **allowedSort:** `id, customer_name, status, payment_status, total_amount, created_at`.
- Each `items[]` entry carries at least `product_id` + `quantity` (used to decrement stock). No stock restoration on cancel/update.

---

## Table: `tournaments`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | TEXT | no | — | PK |
| `name` | TEXT | no | — | |
| `turf_id` | TEXT | no | — | → `turfs.id` (logical) |
| `turf_name` | TEXT | yes | — | denormalized |
| `start_date` | TEXT | yes | — | |
| `end_date` | TEXT | yes | — | |
| `max_teams` | INTEGER | no | `8` | |
| `entry_fee` | REAL | no | `0` | |
| `prize_pool` | REAL | no | `0` | |
| `status` | TEXT | no | `'upcoming'` | |
| `format` | TEXT | no | `'knockout'` | |
| `description` | TEXT | yes | — | |
| `rules` | TEXT | yes | — | |
| `teams` | TEXT (JSON) | yes | `[]` | **jsonColumn** — array of teams |
| `created_at` | TEXT | no | — | |

- **jsonColumns:** `teams`. **allowedSort:** `id, name, status, format, start_date, end_date, created_at`.

---

## Table: `app_settings` (key/value)

| Column | Type | Null | Notes |
|---|---|---|---|
| `key` | TEXT | no | PK |
| `value` | TEXT | no | |

- No `TABLE_CONFIG` entry; accessed only via `getSetting(key)` / `setSetting(key, value)` (upsert via `ON CONFLICT(key) DO UPDATE`).
- **Known keys:**
  - `license_key` — activated desktop license (HMAC hex).
  - `desktop_user_id` — persisted desktop admin user id for auto-login.

---

## Relationship Map (logical, no FK constraints)

```
turfs ──1:N──▶ bookings        (bookings.turf_id → turfs.id)
turfs ──1:N──▶ tournaments     (tournaments.turf_id → turfs.id)
bookings ──1:N──▶ payments     (payments.booking_id → bookings.id, nullable)
products ──N:M──▶ orders       (orders.items[].product_id → products.id; stock decremented)
users                          (standalone; auth/roles)
app_settings                   (standalone; license + desktop state)
```

---

## Indexes

| Index | Table | Columns | Purpose |
|---|---|---|---|
| `idx_bookings_turf_date_time` | bookings | `turf_id, date, start_hour, end_hour` | booking-conflict lookups |
| `idx_users_email` | users | `email` | login by email (also `UNIQUE` on the column) |

---

## Enumerated Values (application-enforced, not DB CHECK constraints)

| Field | Values |
|---|---|
| `users.role` | `user`, `admin` |
| `users.status` | `active` (others possible via API) |
| `bookings.status` | `pending`, `confirmed`, `cancelled`, `completed`, `no_show` |
| `bookings.payment_status` | `paid`, `unpaid`, `partial`, `refunded` |
| `bookings.payment_method` / `payments.method` | `bkash`, `nagad`, `rocket`, `cash`, `card`, `other` |
| `tournaments.status` | `upcoming` (+ others via API) |
| `tournaments.format` | `knockout` (+ others via API) |

Money is Bangladeshi Taka (৳).

---

## Data-Access Cheat Sheet (`db/sqlite.js` exports)

| Function | SQL effect |
|---|---|
| `createRecord(table, payload)` | INSERT (UUID id, ISO created_at, defaults merged, JSON serialized) |
| `listRecords(table, {sort, limit, where, params})` | SELECT … ORDER BY … LIMIT (default 500) |
| `findById(table, id, opts)` | SELECT … WHERE id = ? |
| `findOne(table, where, params, opts)` | SELECT … WHERE <raw> LIMIT 1 |
| `updateById(table, id, payload)` | UPDATE whitelisted cols |
| `deleteById(table, id)` | DELETE, returns bool |
| `incrementColumn(table, id, col, val)` | UPDATE col = COALESCE(col,0)+val |
| `clearAllTables()` | DELETE FROM all 7 domain tables |
| `getSetting`/`setSetting` | app_settings read / upsert |

---

## Gotchas

- **Adding a column requires two edits** in `sqlite.js`: the `CREATE TABLE` DDL **and** the table's `TABLE_CONFIG.columns`. Miss the latter → writes silently drop the field (whitelist).
- **JSON columns must be listed in `jsonColumns`**, or objects get stored as `"[object Object]"`.
- **`bookings` migration is destructive** — deploying to an old DB missing `paid_amount`/`payment_history` wipes bookings.
- **No FK/CHECK constraints** — referential integrity and enums are only enforced in controllers.
- **No `updated_at`** — last-modified time is not tracked.
- **`reset_password_token`/`reset_password_expire`** exist but no password-reset flow is wired.
