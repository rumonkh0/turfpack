# Phase 3 — API Contracts

All endpoints follow the existing TurfSlot conventions:
- Response shape: `{ success: true, data: ... }` or `{ success: true, count: N, data: [...] }`
- Errors: `{ success: false, error: "message" }` with appropriate HTTP status
- Auth: `Authorization: Bearer <token>` header
- All new endpoints require `protect` middleware (JWT auth)
- Role-restricted endpoints use `authorize('admin')` or `authorize('admin', 'partner')`

Base URL: `/api`

---

## 1. Account Management (Chart of Accounts)

### `GET /api/accounts`
List all accounts in the chart.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Query | `?type=asset&status=active&sort=-code&limit=100` |
| Response | `{ success, count, data: [Account] }` |

### `POST /api/accounts`
Create a custom account (admin-extensible chart).

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Body | `{ code, name, type, normal_side, description }` |
| Validation | `code` must match type range (1xxx=asset, 2xxx=liability, 3xxx=equity, 4xxx=revenue, 5xxx=cogs, 6xxx=expense); `code` must be unique |
| Response | `201 { success, data: Account }` |

### `PUT /api/accounts/:id`
Update a custom account (system accounts cannot be renamed/retyped).

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Body | `{ name?, description?, status? }` |
| Guard | Reject if `is_system = 1` and trying to change `code`, `type`, or `normal_side` |
| Response | `{ success, data: Account }` |

**Account shape:**
```json
{
  "_id": "uuid",
  "code": "6007",
  "name": "Transport",
  "type": "expense",
  "normal_side": "debit",
  "description": "Travel and transport costs",
  "is_system": 0,
  "status": "active",
  "createdAt": "2026-07-25T..."
}
```

---

## 2. Expense Management

### `GET /api/expenses`
List expenses with optional filters.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Query | `?from=2026-01-01&to=2026-01-31&account_code=6002&payment_method=cash&sort=-entry_date&limit=100` |
| Filter logic | `entry_date >= from AND entry_date <= to` (both optional) |
| Response | `{ success, count, data: [Expense] }` |

### `GET /api/expenses/:id`
Get single expense.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Response | `{ success, data: Expense }` |

### `POST /api/expenses`
Record a new expense. Auto-posts journal entry.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Body | `{ description, amount, account_code?, payment_method?, entry_date, notes? }` |
| Defaults | `account_code: "6099"`, `payment_method: "cash"` |
| Side effect | Creates journal entry: DR account_code, CR CASH(payment_method) |
| Response | `201 { success, data: Expense }` |

### `DELETE /api/expenses/:id`
Delete expense and post offsetting journal entry.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Side effect | Posts reversal journal entry (DR cash, CR expense account) |
| Response | `{ success, data: {} }` |

**Expense shape:**
```json
{
  "_id": "uuid",
  "description": "July electricity bill",
  "amount": 5000.00,
  "account_code": "6002",
  "payment_method": "bkash",
  "payment_status": "paid",
  "entry_date": "2026-07-25",
  "notes": "Meter #4421",
  "created_by": "user-uuid",
  "createdAt": "2026-07-25T..."
}
```

---

## 3. Income Management

### `GET /api/incomes`
List incomes with optional filters.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Query | `?from=2026-01-01&to=2026-07-31&account_code=4099&sort=-entry_date&limit=100` |
| Response | `{ success, count, data: [Income] }` |

### `GET /api/incomes/:id`
Get single income.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Response | `{ success, data: Income }` |

### `POST /api/incomes`
Record manual income. Auto-posts journal entry.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Body | `{ description, amount, account_code?, payment_method?, entry_date, notes? }` |
| Defaults | `account_code: "4099"`, `payment_method: "cash"` |
| Side effect | Creates journal entry: DR CASH(payment_method), CR account_code |
| Response | `201 { success, data: Income }` |

### `DELETE /api/incomes/:id`
Delete income and post offsetting journal entry.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Side effect | Posts reversal journal entry |
| Response | `{ success, data: {} }` |

**Income shape:** Same structure as Expense, with `account_code` defaulting to `"4099"`.

---

## 4. Partner Management

### `GET /api/partners`
List all partner users with their current share.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Response | `{ success, count, data: [PartnerWithShare] }` |

**Response shape:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "_id": "user-uuid",
      "full_name": "Karim Ahmed",
      "email": "karim@example.com",
      "role": "partner",
      "status": "active",
      "share_bp": 4000,
      "share_pct": 40.00,
      "createdAt": "2026-01-15T..."
    }
  ]
}
```

### `POST /api/partners`
Create a new partner user.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Body | `{ full_name, email, password }` |
| Logic | If first partner ever → auto-assign 10000 bp (100%). Otherwise → must call `/api/partners/reallocate` to adjust shares. |
| Response | `201 { success, data: PartnerWithShare }` |

### `GET /api/partners/:id`
Get single partner with share details.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Response | `{ success, data: PartnerWithShare }` |

### `PUT /api/partners/:id`
Update partner user details (not share — use reallocate).

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Body | `{ full_name?, email?, password?, status? }` |
| Response | `{ success, data: PartnerWithShare }` |

### `POST /api/partners/reallocate`
Atomically reallocate all partner shares. Must sum to 10000 bp.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Body | `{ shares: [{ user_id, share_bp }], reason? }` |
| Validation | `sum(share_bp) == 10000`; every `user_id` must be an active partner; all current partners must be included |
| Side effect | Closes current ratio version (`effective_to = now`), creates new version, logs to `profit_share_change_log` |
| Response | `{ success, data: { version, shares: [{ user_id, share_bp }] } }` |

**Request example:**
```json
{
  "shares": [
    { "user_id": "uuid-1", "share_bp": 4000 },
    { "user_id": "uuid-2", "share_bp": 3500 },
    { "user_id": "uuid-3", "share_bp": 2500 }
  ],
  "reason": "Onboarding new partner Rahim"
}
```

### `GET /api/partners/shares/history`
Get share reallocation history.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Query | `?limit=20` |
| Response | `{ success, count, data: [ChangeLogEntry] }` |

**ChangeLogEntry shape:**
```json
{
  "_id": "uuid",
  "version": 3,
  "changed_by": "admin-uuid",
  "reason": "Onboarding new partner Rahim",
  "snapshot": [
    { "user_id": "uuid-1", "full_name": "Karim", "share_bp": 4000 },
    { "user_id": "uuid-2", "full_name": "Jamal", "share_bp": 3500 },
    { "user_id": "uuid-3", "full_name": "Rahim", "share_bp": 2500 }
  ],
  "createdAt": "2026-07-20T..."
}
```

---

## 5. Partner Payouts

### `GET /api/partners/payouts`
List all payouts.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Query | `?user_id=uuid&from=2026-01-01&to=2026-07-31&sort=-created_at&limit=50` |
| Response | `{ success, count, data: [Payout] }` |

### `POST /api/partners/payouts`
Disburse profit to a partner.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Body | `{ user_id, amount, payment_method, notes? }` |
| Validation | `user_id` must be an active partner |
| Side effect | Creates journal entry: DR 3100 Partner Drawings, CR CASH(method) |
| Response | `201 { success, data: Payout }` |

**Payout shape:**
```json
{
  "_id": "journal-entry-uuid",
  "user_id": "partner-uuid",
  "partner_name": "Karim Ahmed",
  "amount": 50000.00,
  "payment_method": "bkash",
  "notes": "July 2026 share payout",
  "entry_date": "2026-07-25",
  "createdAt": "2026-07-25T..."
}
```

---

## 6. Ledger (Journal Entries)

### `GET /api/ledger`
List journal entries with lines.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Query | `?from=2026-07-01&to=2026-07-31&reference_type=booking&sort=-entry_date&limit=100` |
| Response | `{ success, count, data: [JournalEntryWithLines] }` |

### `GET /api/ledger/:id`
Get single journal entry with all lines.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Response | `{ success, data: JournalEntryWithLines }` |

**JournalEntryWithLines shape:**
```json
{
  "_id": "uuid",
  "entry_date": "2026-07-25",
  "description": "Booking #abc created (partial payment)",
  "reference_type": "booking",
  "reference_id": "booking-uuid",
  "posting_event": "booking:created",
  "created_by": "user-uuid",
  "createdAt": "2026-07-25T...",
  "lines": [
    { "account_code": "1100", "account_name": "Accounts Receivable", "debit": 200000, "credit": 0 },
    { "account_code": "4001", "account_name": "Booking Revenue", "debit": 0, "credit": 200000 },
    { "account_code": "1001", "account_name": "Cash - bKash", "debit": 100000, "credit": 0 },
    { "account_code": "1100", "account_name": "Accounts Receivable", "debit": 0, "credit": 100000 }
  ],
  "total_debit": 300000,
  "total_credit": 300000
}
```

---

## 7. Reports

All report endpoints accept period parameters: `?from=2026-07-01&to=2026-07-31`
or shorthand: `?period=daily|weekly|monthly|yearly` (calculated relative to today).

### `GET /api/reports/profit-loss`
Profit & Loss statement for a period.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin', 'partner')` |
| Query | `?from=...&to=...` or `?period=monthly` |
| Response | See below |

```json
{
  "success": true,
  "data": {
    "period": { "from": "2026-07-01", "to": "2026-07-31" },
    "revenue": {
      "total": 850000,
      "breakdown": [
        { "account_code": "4001", "name": "Booking Revenue", "amount": 600000 },
        { "account_code": "4002", "name": "Product Sales Revenue", "amount": 200000 },
        { "account_code": "4099", "name": "Miscellaneous Revenue", "amount": 50000 }
      ]
    },
    "cogs": {
      "total": 80000,
      "breakdown": [
        { "account_code": "5001", "name": "Cost of Goods Sold", "amount": 80000 }
      ]
    },
    "gross_profit": 770000,
    "expenses": {
      "total": 320000,
      "breakdown": [
        { "account_code": "6001", "name": "Rent", "amount": 150000 },
        { "account_code": "6002", "name": "Utilities", "amount": 80000 },
        { "account_code": "6003", "name": "Salaries & Wages", "amount": 90000 }
      ]
    },
    "net_profit": 450000
  }
}
```

### `GET /api/reports/cash-position`
Cash balance per payment method.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Query | `?as_of=2026-07-31` (defaults to today) |
| Response | See below |

```json
{
  "success": true,
  "data": {
    "as_of": "2026-07-31",
    "total": 1250000,
    "accounts": [
      { "code": "1001", "name": "Cash - bKash", "balance": 450000 },
      { "code": "1002", "name": "Cash - Nagad", "balance": 200000 },
      { "code": "1004", "name": "Cash - Physical", "balance": 600000 }
    ]
  }
}
```

### `GET /api/reports/receivables`
Outstanding accounts receivable.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin')` |
| Query | `?as_of=2026-07-31` |
| Response | See below |

```json
{
  "success": true,
  "data": {
    "as_of": "2026-07-31",
    "total_outstanding": 75000,
    "bookings": [
      {
        "booking_id": "uuid",
        "customer_name": "Rafiq",
        "total_price": 200000,
        "paid": 125000,
        "outstanding": 75000
      }
    ]
  }
}
```

### `GET /api/reports/partner-shares`
Partner profit share report for a period.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin', 'partner')` |
| Query | `?from=...&to=...` or `?period=monthly` |
| Partner scope | Partner users only see their own row; admin sees all |
| Response | See below |

```json
{
  "success": true,
  "data": {
    "period": { "from": "2026-07-01", "to": "2026-07-31" },
    "net_profit": 450000,
    "shares": [
      {
        "user_id": "uuid-1",
        "full_name": "Karim Ahmed",
        "effective_bp": 4000,
        "effective_pct": 40.00,
        "gross_share": 180000,
        "paid_out": 100000,
        "outstanding": 80000
      },
      {
        "user_id": "uuid-2",
        "full_name": "Jamal Hossain",
        "effective_bp": 3500,
        "effective_pct": 35.00,
        "gross_share": 157500,
        "paid_out": 0,
        "outstanding": 157500
      },
      {
        "user_id": "uuid-3",
        "full_name": "Rahim Khan",
        "effective_bp": 2500,
        "effective_pct": 25.00,
        "gross_share": 112500,
        "paid_out": 50000,
        "outstanding": 62500
      }
    ]
  }
}
```

### `GET /api/reports/revenue-breakdown`
Revenue by source for a period.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin', 'partner')` |
| Query | `?from=...&to=...` or `?period=monthly` |
| Response | Same structure as `revenue` in P&L |

### `GET /api/reports/expense-breakdown`
Expenses by category for a period.

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin', 'partner')` |
| Query | `?from=...&to=...` or `?period=monthly` |
| Response | Same structure as `expenses` in P&L |

### `GET /api/reports/dashboard`
Aggregated dashboard summary (single call for UI cards).

| Field | Value |
|-------|-------|
| Auth | `protect, authorize('admin', 'partner')` |
| Query | `?period=monthly` |
| Partner scope | Partner sees net_profit + own share only (no cash position, no other partners) |
| Response | See below |

**Admin response:**
```json
{
  "success": true,
  "data": {
    "period": { "from": "2026-07-01", "to": "2026-07-31" },
    "total_revenue": 850000,
    "total_expenses": 320000,
    "cogs": 80000,
    "net_profit": 450000,
    "total_cash": 1250000,
    "total_receivables": 75000,
    "partner_count": 3,
    "booking_count": 45,
    "order_count": 120
  }
}
```

**Partner response:**
```json
{
  "success": true,
  "data": {
    "period": { "from": "2026-07-01", "to": "2026-07-31" },
    "total_revenue": 850000,
    "total_expenses": 320000,
    "cogs": 80000,
    "net_profit": 450000,
    "my_share": {
      "effective_bp": 4000,
      "effective_pct": 40.00,
      "gross_share": 180000,
      "paid_out": 100000,
      "outstanding": 80000
    }
  }
}
```

---

## 8. Authorization Matrix

| Endpoint | Admin | Partner | Staff |
|----------|-------|---------|-------|
| **Accounts** |||
| `GET /api/accounts` | ✅ | ❌ | ❌ |
| `POST /api/accounts` | ✅ | ❌ | ❌ |
| `PUT /api/accounts/:id` | ✅ | ❌ | ❌ |
| **Expenses** |||
| `GET /api/expenses` | ✅ | ❌ | ❌ |
| `GET /api/expenses/:id` | ✅ | ❌ | ❌ |
| `POST /api/expenses` | ✅ | ❌ | ❌ |
| `DELETE /api/expenses/:id` | ✅ | ❌ | ❌ |
| **Incomes** |||
| `GET /api/incomes` | ✅ | ❌ | ❌ |
| `GET /api/incomes/:id` | ✅ | ❌ | ❌ |
| `POST /api/incomes` | ✅ | ❌ | ❌ |
| `DELETE /api/incomes/:id` | ✅ | ❌ | ❌ |
| **Partners** |||
| `GET /api/partners` | ✅ | ❌ | ❌ |
| `POST /api/partners` | ✅ | ❌ | ❌ |
| `GET /api/partners/:id` | ✅ | ❌ | ❌ |
| `PUT /api/partners/:id` | ✅ | ❌ | ❌ |
| `POST /api/partners/reallocate` | ✅ | ❌ | ❌ |
| `GET /api/partners/shares/history` | ✅ | ❌ | ❌ |
| `GET /api/partners/payouts` | ✅ | ❌ | ❌ |
| `POST /api/partners/payouts` | ✅ | ❌ | ❌ |
| **Ledger** |||
| `GET /api/ledger` | ✅ | ❌ | ❌ |
| `GET /api/ledger/:id` | ✅ | ❌ | ❌ |
| **Reports** |||
| `GET /api/reports/profit-loss` | ✅ | ✅ (same data) | ❌ |
| `GET /api/reports/cash-position` | ✅ | ❌ | ❌ |
| `GET /api/reports/receivables` | ✅ | ❌ | ❌ |
| `GET /api/reports/partner-shares` | ✅ (all) | ✅ (own only) | ❌ |
| `GET /api/reports/revenue-breakdown` | ✅ | ✅ (same data) | ❌ |
| `GET /api/reports/expense-breakdown` | ✅ | ✅ (same data) | ❌ |
| `GET /api/reports/dashboard` | ✅ (full) | ✅ (limited) | ❌ |

---

## 9. Route Mounts (to add in `app.js`)

```javascript
import accountRoutes from './routes/accountRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import incomeRoutes from './routes/incomeRoutes.js';
import partnerRoutes from './routes/partnerRoutes.js';
import ledgerRoutes from './routes/ledgerRoutes.js';
import reportRoutes from './routes/reportRoutes.js';

app.use('/api/accounts', accountRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/incomes', incomeRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/reports', reportRoutes);
```

---

## 10. New Files to Create

| File | Responsibility |
|------|---------------|
| `server/routes/accountRoutes.js` | Chart of Accounts CRUD |
| `server/routes/expenseRoutes.js` | Expense CRUD + ledger posting |
| `server/routes/incomeRoutes.js` | Income CRUD + ledger posting |
| `server/routes/partnerRoutes.js` | Partner CRUD + reallocate + payouts |
| `server/routes/ledgerRoutes.js` | Journal entry read-only |
| `server/routes/reportRoutes.js` | All report endpoints |
| `server/controllers/accountController.js` | Thin controller → service |
| `server/controllers/expenseController.js` | Thin controller → service |
| `server/controllers/incomeController.js` | Thin controller → service |
| `server/controllers/partnerController.js` | Thin controller → service |
| `server/controllers/ledgerController.js` | Thin controller → service |
| `server/controllers/reportController.js` | Thin controller → service |
| `server/services/ledgerPostingService.js` | Single writer to journal |
| `server/services/profitShareService.js` | Ratio management + time-slicing |
| `server/services/reportingService.js` | All report aggregations |

---

## 11. Period Query Helper

All report endpoints accept either explicit dates or a shorthand period:

| Query | Resolved |
|-------|----------|
| `?from=2026-07-01&to=2026-07-31` | Explicit range |
| `?period=daily` | Today only |
| `?period=weekly` | Monday–Sunday of current week |
| `?period=monthly` | 1st–last of current month |
| `?period=yearly` | Jan 1–Dec 31 of current year |

If neither provided, defaults to `monthly`.

All amounts in report responses are in **poisha** (integer). Display conversion: `amount / 100` = taka.
