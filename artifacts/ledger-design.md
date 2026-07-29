# TurfSlot — Ledger Design (Phase 1)

## Purpose

This document defines the Chart of Accounts, double-entry posting rules for every
business event, report definitions, and assumptions for the TurfSlot accounting ledger.
All downstream work (schema, API, implementation) derives from this design.

---

## 1. Chart of Accounts

All new financial amounts are stored in **integer minor units (poisha)**. ৳1 = 100 poisha.
Percentages are integer **basis points** (10000 bp = 100%).

### Account Types & Normal Sides

| Type | Code Range | Normal Side | Increases with |
|------|-----------|-------------|----------------|
| Asset | 1xxx | Debit | Debit |
| Liability | 2xxx | Credit | Credit |
| Equity | 3xxx | Credit | Credit |
| Revenue | 4xxx | Credit | Credit |
| COGS | 5xxx | Debit | Debit |
| Expense | 6xxx | Debit | Debit |

### Seed Accounts

#### Assets (1xxx)

| Code | Name | Description |
|------|------|-------------|
| 1001 | Cash - bKash | Mobile banking - bKash |
| 1002 | Cash - Nagad | Mobile banking - Nagad |
| 1003 | Cash - Rocket | Mobile banking - Rocket |
| 1004 | Cash - Physical | Physical cash on hand |
| 1005 | Cash - Card | Card terminal receipts |
| 1006 | Cash - Other | Other payment channels |
| 1100 | Accounts Receivable | Unpaid/partial booking balances |
| 1200 | Inventory | Product stock at cost |

#### Liabilities (2xxx)

| Code | Name | Description |
|------|------|-------------|
| 2001 | Accounts Payable | Unpaid obligations (future use) |

#### Equity (3xxx)

| Code | Name | Normal Side | Description |
|------|------|-------------|-------------|
| 3000 | Retained Earnings | Credit | Accumulated net profit |
| 3100 | Partner Drawings | **Debit** (contra-equity) | Payouts to partners |

#### Revenue (4xxx)

| Code | Name | Description |
|------|------|-------------|
| 4001 | Booking Revenue | Turf rental income |
| 4002 | Product Sales Revenue | POS/retail product sales |
| 4003 | Tournament Revenue | Tournament entry fees |

#### Cost of Goods Sold (5xxx)

| Code | Name | Description |
|------|------|-------------|
| 5001 | Cost of Goods Sold | Product cost basis on sale |

#### Operating Expenses (6xxx)

| Code | Name | Description |
|------|------|-------------|
| 6001 | Rent | Venue/space rental |
| 6002 | Utilities | Electric, water, internet |
| 6003 | Salaries & Wages | Staff compensation |
| 6004 | Maintenance | Turf/facility upkeep |
| 6005 | Marketing | Advertising, promotions |
| 6006 | Equipment | Gear, tools, hardware |
| 6099 | Miscellaneous | Uncategorized expenses |

### Payment Method → Cash Account Map

| `payment_method` value | Account Code |
|------------------------|--------------|
| `bkash` | 1001 |
| `nagad` | 1002 |
| `rocket` | 1003 |
| `cash` | 1004 |
| `card` | 1005 |
| `other` | 1006 |

---

## 2. Journal Structure

Each accounting event produces one **journal entry** containing two or more **journal lines**.

```
journal_entry
├── id (UUID)
├── entry_date (ISO date — the business date, not necessarily created_at)
├── description ("Booking #X created", "Expense: Electricity")
├── reference_type (booking | order | expense | payout | adjustment)
├── reference_id (the source record's UUID, nullable for adjustments)
├── created_by (user UUID — who triggered it)
├── created_at (ISO timestamp)
└── lines[]
    ├── account_code (e.g. "1001")
    ├── debit (integer poisha, 0 if credit line)
    ├── credit (integer poisha, 0 if debit line)
    └── description (optional per-line memo)
```

### Invariant

For every journal entry: **sum(debit) == sum(credit)**. Enforced at write time inside a
transaction. Violation → rollback, throw.

### Idempotency

Each event posts exactly once. The `(reference_type, reference_id)` pair plus a
**posting_event** qualifier (e.g. `booking:created`, `booking:payment`) uniquely
identifies a journal entry. Re-posting the same event is a no-op.

---

## 3. Posting Rules — Every Business Event

All amounts below are in **poisha** (integer). `CASH(method)` means the cash account
mapped from the payment method (see §1 table).

---

### 3.1 Booking Created (unpaid)

**Trigger:** New booking with `payment_status = 'unpaid'`
**Posting event:** `booking:created`

| # | Account | Debit | Credit |
|---|---------|-------|--------|
| 1 | 1100 Accounts Receivable | total_price | |
| 2 | 4001 Booking Revenue | | total_price |

Revenue is recognized on confirmation (accrual basis). AR tracks the obligation.

---

### 3.2 Booking Created (paid in full)

**Trigger:** New booking with `payment_status = 'paid'`
**Posting event:** `booking:created`

| # | Account | Debit | Credit |
|---|---------|-------|--------|
| 1 | 1100 Accounts Receivable | total_price | |
| 2 | 4001 Booking Revenue | | total_price |
| 3 | CASH(method) | total_price | |
| 4 | 1100 Accounts Receivable | | total_price |

Lines 1–2: revenue recognition. Lines 3–4: immediate settlement.
AR nets to zero; cash increases; revenue recorded. Single journal entry, 4 lines.

---

### 3.3 Booking Created (partial payment)

**Trigger:** New booking with `payment_status = 'partial'`, `paid_amount > 0`
**Posting event:** `booking:created`

| # | Account | Debit | Credit |
|---|---------|-------|--------|
| 1 | 1100 Accounts Receivable | total_price | |
| 2 | 4001 Booking Revenue | | total_price |
| 3 | CASH(method) | paid_amount | |
| 4 | 1100 Accounts Receivable | | paid_amount |

AR balance after = total_price − paid_amount (the outstanding amount).

---

### 3.4 Booking — Later Installment Payment

**Trigger:** Installment added to existing booking (`payment_history` entry appended)
**Posting event:** `booking:installment:{payment_index}`

| # | Account | Debit | Credit |
|---|---------|-------|--------|
| 1 | CASH(installment.method) | installment.amount | |
| 2 | 1100 Accounts Receivable | | installment.amount |

Reduces AR by installment amount. When AR reaches zero → booking is fully paid.

---

### 3.5 Booking Cancelled (unpaid — no refund)

**Trigger:** Booking status → `cancelled`, `payment_status = 'unpaid'`
**Posting event:** `booking:cancelled`

| # | Account | Debit | Credit |
|---|---------|-------|--------|
| 1 | 4001 Booking Revenue | total_price | |
| 2 | 1100 Accounts Receivable | | total_price |

Reverses the original accrual. AR and Revenue both return to pre-booking state.

---

### 3.6 Booking Refund (fully paid → refunded)

**Trigger:** Booking `payment_status` → `refunded` (was `paid`)
**Posting event:** `booking:refund`

| # | Account | Debit | Credit |
|---|---------|-------|--------|
| 1 | 4001 Booking Revenue | total_price | |
| 2 | CASH(method) | | total_price |

Revenue reversed, cash returned.

---

### 3.7 Booking Refund (partial paid → cancelled/refunded)

**Trigger:** Booking cancelled after partial payment; `paid_amount` refunded
**Posting event:** `booking:refund`

| # | Account | Debit | Credit |
|---|---------|-------|--------|
| 1 | 4001 Booking Revenue | total_price | |
| 2 | 1100 Accounts Receivable | | (total_price − paid_amount) |
| 3 | CASH(method) | | paid_amount |

Reverses full revenue. Clears remaining AR. Returns paid cash.
sum(DR) = total_price. sum(CR) = (total_price − paid_amount) + paid_amount = total_price. ✓

---

### 3.8 Product Order (paid)

**Trigger:** New order created (`payment_status = 'paid'`)
**Posting event:** `order:created`

| # | Account | Debit | Credit |
|---|---------|-------|--------|
| 1 | CASH(method) | total_amount | |
| 2 | 4002 Product Sales Revenue | | total_amount |
| 3 | 5001 Cost of Goods Sold | cost_total | |
| 4 | 1200 Inventory | | cost_total |

`cost_total` = Σ(item.quantity × product.cost_price) for all items in the order.
Lines 1–2: revenue. Lines 3–4: cost recognition (reduces inventory asset).

---

### 3.9 Product Order Cancelled

**Trigger:** Order `status` → `cancelled` (was `confirmed`)
**Posting event:** `order:cancelled`

| # | Account | Debit | Credit |
|---|---------|-------|--------|
| 1 | 4002 Product Sales Revenue | total_amount | |
| 2 | CASH(method) | | total_amount |
| 3 | 1200 Inventory | cost_total | |
| 4 | 5001 Cost of Goods Sold | | cost_total |

Exact mirror of 3.8. Revenue reversed, cash returned, inventory restored.

---

### 3.10 Manual Expense

**Trigger:** Admin records an expense via the expense API
**Posting event:** `expense:created`

| # | Account | Debit | Credit |
|---|---------|-------|--------|
| 1 | 6xxx (selected category) | amount | |
| 2 | CASH(method) | | amount |

Admin selects expense category (6001–6099) and payment method.
If expense is unpaid (payable), credit 2001 Accounts Payable instead of Cash.

---

### 3.11 Partner Payout

**Trigger:** Admin disburses profit share to a partner
**Posting event:** `payout:created`

| # | Account | Debit | Credit |
|---|---------|-------|--------|
| 1 | 3100 Partner Drawings | amount | |
| 2 | CASH(method) | | amount |

Drawings is contra-equity (debit normal). Increases drawings, decreases cash.
The journal entry's `reference_id` links to the payout record; `created_by` = admin.

---

### 3.12 Tournament Entry Fee (future)

**Trigger:** Tournament payment received (not yet implemented in current system)
**Posting event:** `tournament:entry_fee`

| # | Account | Debit | Credit |
|---|---------|-------|--------|
| 1 | CASH(method) | entry_fee | |
| 2 | 4003 Tournament Revenue | | entry_fee |

Placeholder rule. Will activate when tournament payment tracking is built.

---

## 4. Report Definitions

### 4.1 Profit & Loss (Income Statement)

For a given period `[from, to]`:

```
Revenue (R)
  = sum(credit) on accounts 4xxx where entry_date in [from, to]

Cost of Goods Sold (C)
  = sum(debit) on account 5001 where entry_date in [from, to]

Gross Profit
  = R − C

Operating Expenses (E)
  = sum(debit) on accounts 6xxx where entry_date in [from, to]

Net Profit (P)
  = Gross Profit − E
  = R − C − E
```

All values derived from `journal_lines` only. No joins to legacy tables needed.

---

### 4.2 Partner Profit Share (for a period)

```
1. Compute Net Profit (P) for the period per §4.1
2. For each partner, determine effective share_bp for the period:
   - If ratio was constant all period → share_bp as-is
   - If ratio changed mid-period → time-slice (see §5)
3. Each partner's share = P × (effective_bp / 10000)
4. Round via largest-remainder method so Σ(partner shares) == P exactly
5. Subtract any payouts already disbursed in the period (sum of DR 3100
   where journal references that partner's payout records)
6. Result: outstanding amount owed to each partner
```

---

### 4.3 Cash Position

Point-in-time balance of each cash account (1001–1006):

```
Balance = sum(debit) − sum(credit) on account where entry_date <= as_of_date
```

Total cash = sum of all cash account balances.

---

### 4.4 Accounts Receivable

Outstanding AR = balance of account 1100 (sum debit − sum credit).
Per-booking AR: filter journal_lines by `reference_type = 'booking'` AND
`account_code = '1100'`, group by `reference_id`.

---

### 4.5 Accrual vs Cash Revenue Views

| View | Definition |
|------|-----------|
| **Accrual Revenue** | All credits to 4001 in period (includes uncolle­cted bookings) |
| **Cash Revenue** | All debits to cash accounts (1001–1006) in period that offset AR (credit side = 1100) |
| **Cash Collected** | Total debits to cash accounts in period (all sources) |

The ledger naturally supports both views — no separate books needed.

---

### 4.6 Revenue Breakdown

Group revenue by account for the period:
- 4001 → Booking Revenue
- 4002 → Product Sales Revenue
- 4003 → Tournament Revenue

Further breakdowns (by turf, by product category) use `reference_id` to join
back to the source table when needed.

---

### 4.7 Expense Breakdown

Group expenses by account (6001–6099) for the period. Each account code maps
to a human-readable category name from the chart.

---

## 5. Time-Sliced Profit Sharing

When partner ratios change mid-period, profit must be allocated proportionally
to the time each ratio was in effect.

### Algorithm

```
Period: [from, to] (total_days)

For each ratio version effective during the period:
  overlap_start = max(version.effective_from, from)
  overlap_end   = min(version.effective_to or to, to)
  overlap_days  = overlap_end − overlap_start + 1

  For each partner in that version:
    weight = overlap_days / total_days
    effective_bp += version.share_bp × weight

Round effective_bp to integers; adjust remainders so sum == 10000.
Then apply effective_bp to Net Profit per §4.2.
```

### Example

Period: Jan 1–31 (31 days). Partner A had 6000bp Jan 1–15 (15 days),
then 5000bp Jan 16–31 (16 days). Partner B: 4000bp → 5000bp.

```
A effective = (6000 × 15/31) + (5000 × 16/31) = 2903 + 2581 = 5484 bp
B effective = (4000 × 15/31) + (5000 × 16/31) = 1935 + 2581 = 4516 bp
Sum = 10000 ✓
```

---

## 6. Assumptions & Constraints

| # | Assumption |
|---|-----------|
| 1 | **Bootstrap:** First partner created → 100% (10000 bp). Until ≥1 partner exists, share-dependent reports return "no partners configured." |
| 2 | **Inventory account goes negative.** Product purchases/restocking are not tracked in the current system. The 1200 Inventory balance represents net outflows only. Profit calculations use COGS (5001) directly, not inventory delta. |
| 3 | **Legacy money stays REAL.** Existing `bookings.total_price`, `products.price`, etc. remain floats. The ledger converts on posting: `Math.round(legacy_float * 100)` → poisha integer. |
| 4 | **No multi-currency.** All amounts are BDT (৳). |
| 5 | **Refund method = original payment method** unless explicitly overridden. |
| 6 | **Tournament posting is dormant** until tournament payment tracking is implemented. |
| 7 | **One journal entry per atomic event.** A booking creation that includes partial payment = 1 journal entry with 4 lines (not two separate entries). |
| 8 | **Expense payment on record = paid immediately.** Future: unpaid expenses → AP flow (2001 credit instead of cash). |
| 9 | **Period = calendar date boundaries.** entry_date (not created_at) determines which period a posting belongs to. |
| 10 | **Rounding: largest-remainder** for partner payouts so Σ shares == net profit exactly (no fractional poisha lost/gained). |

---

## 7. Conversion: Legacy Float → Ledger Integer

When an existing flow (booking, order, payment) triggers a ledger posting:

```javascript
function toPoisha(taka) {
  return Math.round(taka * 100);
}
```

This is the single conversion point. All ledger writes, comparisons, and reports
operate on integers after conversion. Display layer (future UI) converts back:
`amount / 100` for display.

---

## 8. Event → Posting Trigger Map

Summary of which controller action fires which posting:

| Controller Action | Posting Event | Section |
|-------------------|---------------|---------|
| `createBooking` (unpaid) | `booking:created` | §3.1 |
| `createBooking` (paid) | `booking:created` | §3.2 |
| `createBooking` (partial) | `booking:created` | §3.3 |
| `addPayment` / `updateBooking` (installment) | `booking:installment:{idx}` | §3.4 |
| `updateBooking` (→ cancelled, unpaid) | `booking:cancelled` | §3.5 |
| `updateBooking` (→ refunded, was paid) | `booking:refund` | §3.6 |
| `updateBooking` (→ refunded, was partial) | `booking:refund` | §3.7 |
| `createOrder` | `order:created` | §3.8 |
| `updateOrder` (→ cancelled) | `order:cancelled` | §3.9 |
| `createExpense` (new endpoint) | `expense:created` | §3.10 |
| `createPayout` (new endpoint) | `payout:created` | §3.11 |

---

## 9. Idempotency & Safety

- **Unique constraint:** `(reference_type, reference_id, posting_event)` on `journal_entries`.
  Attempting to re-post the same event → no-op (caught by UNIQUE, no error surfaced to user).
- **Transaction boundary:** Every posting is wrapped in a SQLite transaction.
  If any line fails validation (debit ≠ credit sum), the entire entry rolls back.
- **No orphan lines:** Journal lines cannot exist without a parent journal entry (enforced by
  FK or by always inserting entry + lines in same transaction).
- **Immutability:** Journal entries are **append-only**. Corrections are posted as new
  offsetting entries (e.g., §3.5/3.6/3.9), never by editing/deleting existing lines.

---

## 10. What This Design Does NOT Cover (deferred)

- UI / frontend components (out of scope for this backend expansion)
- Multi-turf P&L (per-turf profit centers) — possible future extension via sub-accounts
- Tax calculations or VAT
- Bank reconciliation
- Automated period-close / year-end entries
- Depreciation schedules
- Budget vs actual tracking

---

## Approval Checklist

Before proceeding to Phase 2 (Database Schema), confirm:

- [ ] Chart of Accounts — codes, names, normal sides acceptable?
- [ ] Posting rules for each event — debits/credits correct?
- [ ] Cash account split by payment method — needed, or consolidate to single cash account?
- [ ] COGS approach (post on sale, inventory goes negative) — acceptable?
- [ ] Time-slicing algorithm for mid-period ratio changes — correct?
- [ ] Largest-remainder rounding for partner payouts — acceptable?
- [ ] Any missing business events that need ledger postings?

