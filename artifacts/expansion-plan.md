# Partner Role & Double-Entry Ledger — Backend Expansion

## Context

TurfSlot currently has two roles (`admin`, `user`) and a float-based, single-row
payment model with no accounting layer. The business is owned by 10+ partners who
split profit by percentage. This expansion adds a **partner role**, a **versioned
profit-share system**, and a **full double-entry ledger** that auto-posts from
existing sales/payment flows. Backend only — no UI.

---

## Confirmed Decisions

| Topic | Decision |
|---|---|
| Roles | Rename existing `user` → `staff`; add `partner`. Enum: `admin / staff / partner` |
| Partner identity | A role on `users` (no separate Partner entity) |
| Admin & shares | Admin **cannot** hold a profit share. Only `partner` users hold shares |
| Share invariant | `sum(partner shares) == 10000 bp` at all times. Requires ≥1 partner |
| Bootstrap rule | First partner created → 100% (10000 bp). Every later change is a reallocation |
| Money | Integer minor units (poisha, ৳1 = 100) for all new financial tables |
| Percentages | Integer basis points (10% = 1000; shares sum to 10000) |
| Ledger | Full double-entry (Chart of Accounts, balanced journals, debits == credits) |
| Chart of accounts | Minimal seeded first; admin-extensible (add accounts in any category) |
| Accounting basis | Unpaid booking → Accounts Receivable; each installment moves AR → Cash |
| Manual income | Admin can record income beyond bookings/orders (sponsorship, rental, etc.) |
| Legacy tables | Left as-is (`REAL`); only new financial tables use integer units |

---

## Architecture

Controller → Service → Repository layering for all new code. Plain-JS modules with
explicit dependency passing — no DI container, no formal interfaces. Role behavior
via a single permission/policy map, not scattered `if role ===` checks.

---

## New Tables (7)

| # | Table | Purpose |
|---|-------|---------|
| 1 | `accounts` | Chart of Accounts — code, name, type, normal side |
| 2 | `journal_entries` | One header per financial event (date, description, reference) |
| 3 | `journal_lines` | Debit/credit rows within each journal entry |
| 4 | `profit_share_ratios` | Partner ownership %, versioned with `effective_from` / `effective_to` |
| 5 | `profit_share_change_log` | Audit trail of every ratio reallocation |
| 6 | `expenses` | Admin-recorded expense source records |
| 7 | `incomes` | Admin-recorded income source records (sponsorship, misc revenue, etc.) |

---

## Admin Capabilities

| Action | Description |
|--------|-------------|
| Record expense | Pick category (Rent, Utilities, Salaries, etc.), amount, payment method |
| Record income | Pick revenue account (or create new), amount, payment method |
| Add chart accounts | Extend any category — new expense types, asset accounts, liability accounts |
| Manage partners | Create partner users, reallocate profit shares (sum must stay 10000 bp) |
| Disburse payouts | Pay a partner their share, recorded as contra-equity drawing |
| View all reports | P&L, cash position, AR aging, partner shares, revenue/expense breakdowns |

---

## Phases

### Phase 1 — Discovery & Design Confirmation *(no code)* ✅ Complete

**Output:** `artifacts/ledger-design.md`
- Chart of Accounts (19 seed accounts across 6 types + admin-extensible)
- Exact double-entry postings for 13 event types:
  - Booking: created (unpaid/paid/partial), installment, cancelled, refund (full/partial)
  - Product: order created, order cancelled (with COGS)
  - Manual expense, manual income, partner payout, tournament entry (dormant)
- Report definitions: P&L, partner share, cash position, AR, accrual vs cash views
- Time-slicing algorithm for mid-period ratio changes
- Documented assumptions and constraints

---

### Phase 2 — Database Design *(schema only)*

**Output:** DDL + `TABLE_CONFIG` entries (in lockstep per repo convention) for all 7 tables.

Additional deliverables:
- Role-enum migration (`user` → `staff`, add `partner`) — **non-destructive**
- **Transaction wrapper** for `sqlite.js` (absent today; required for atomic
  journal writes and ratio reallocation)
- Seed script for minimal Chart of Accounts

**Stop:** Approve schema; flag any table shape that forces an API change.

---

### Phase 3 — API / Contract Design *(specs only)*

**Output:** REST contracts matching existing `{success, data}` response style.

| Scope | Endpoints |
|-------|-----------|
| Partner management | CRUD partners, ratio reallocation |
| Manual transactions | Create/list expenses, create/list incomes |
| Partner payouts | Create payout, list payouts |
| Reports (admin) | P&L, cash position, AR, revenue/expense breakdown |
| Reports (partner) | Own share summary, period reports (daily/weekly/monthly/yearly/custom) |

Per-endpoint authorization matrix. Partner sees aggregate financials but never
another partner's individual payout. Pagination on list endpoints.

**Stop:** Approve contracts.

---

### Phase 4 — Implementation *(reviewable sub-steps)*

| Step | Deliverable |
|------|-------------|
| **4a** | Transaction wrapper + role migration + chart seed |
| **4b** | `LedgerPostingService` (single writer to the ledger) + repositories |
| **4c** | `ProfitShareService` (atomic reallocation; 10000-bp invariant; time-sliced payout) |
| **4d** | Event hooks wiring existing booking/payment/order/refund flows into posting |
| **4e** | `ReportingService` + admin/partner endpoints + `authorize('partner')` support |

**Stop after each sub-step** for review.

---

### Phase 5 — Tests

Stand up test harness (none exists today). Unit tests for:

- [ ] debits == credits on every journal entry
- [ ] ratio sum == 10000 bp after every reallocation
- [ ] mid-period ratio-change time-slicing produces correct weights
- [ ] partial-payment AR flow (create → installment → settle)
- [ ] refund/cancel produces correct offsetting entries
- [ ] integer-money rounding — partner payouts sum exactly to net profit

**Stop:** Review coverage.

---

### Phase 6 — Legacy Migration Proposal *(doc only)*

Phased proposal to bring existing modules to the new standard:
- Float → integer money conversion
- Non-destructive migration patterns (replace the destructive `bookings` migration)
- Service extraction from existing controllers

**Proposed, NOT executed.**

---

## Key Files

### Modified

| File | Change |
|------|--------|
| `server/db/sqlite.js` | 7 new tables in `TABLE_CONFIG` + DDL; transaction wrapper |
| `server/middleware/auth.js` | Add `partner` role to `authorize()` |
| `server/controllers/bookingController.js` | Hook: auto-post journal on booking events |
| `server/controllers/orderController.js` | Hook: auto-post journal on order events |

### New

| File | Purpose |
|------|---------|
| `server/services/ledgerPostingService.js` | Single writer to the ledger — all journal entries go through here |
| `server/services/profitShareService.js` | Ratio management, time-sliced payout calculation |
| `server/services/reportingService.js` | P&L, cash position, AR, partner share reports |
| `server/repositories/*.js` | Data access layer for new tables |
| `server/controllers/partnerController.js` | Partner management + payout endpoints |
| `server/controllers/expenseController.js` | Manual expense CRUD |
| `server/controllers/incomeController.js` | Manual income CRUD |
| `server/controllers/reportController.js` | Report endpoints |
| `server/routes/partnerRoutes.js` | Partner routes |
| `server/routes/expenseRoutes.js` | Expense routes |
| `server/routes/incomeRoutes.js` | Income routes |
| `server/routes/reportRoutes.js` | Report routes |

---

## Working Mode

Deliver **one phase** → stop → explicit approval → next phase. No code before Phase 4.

---

## Verification

- **Automated:** Unit tests (Phase 5) are the primary gate for all money logic
- **Manual:** Seed chart → create partners → reallocate → create booking + partial
  payment → verify journals balance → run period report → confirm partner payouts
  sum exactly to net profit

---

## Open Assumption

Bootstrap: first partner = 100%. Until ≥1 partner exists, share-dependent reports
return "no partners configured" rather than erroring.
