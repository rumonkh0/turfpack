# Partial Payment Tracking System - Implementation Plan & Execution Summary

## 📋 Audit Results

### Current System Analysis

- **Booking Model**: Supports `payment_status` enum: `['paid', 'unpaid', 'partial', 'refunded']`
- **Payment Model**: Separate collection with status and transaction details
- **Missing**: Tracking of partial payment amounts, payment history, and remaining balance

---

## 🎯 Implementation Plan

### Phase 1: Backend Schema Updates ✅

**Goal**: Add data fields to support partial payment tracking

#### Changes:

- **Booking.js Model**
  - Added `paid_amount: Number` (default: 0) - tracks total amount paid so far
  - Added `payment_history: Array` - records each payment with:
    - `amount`: Payment amount
    - `date`: Payment date
    - `method`: Payment method (bkash, nagad, rocket, etc.)
    - `txn_id`: Transaction ID
    - `notes`: Payment notes

**Status**: ✅ COMPLETED

---

### Phase 2: Frontend UI Components ✅

**Goal**: Add UI for entering and tracking partial payments

#### Components Updated:

**1. BookingFormDialog.jsx**

- Added `paid_amount` to form state (initialized to 0)
- New partial payment input section with:
  - Total Amount display (disabled)
  - Paid Amount input field
  - Real-time remaining balance calculation
  - Validation: paid_amount cannot exceed total_price
- Imported PaymentHistoryPanel component
- Display payment history when editing existing bookings

**2. PaymentHistoryPanel.jsx** (NEW)

- Shows payment history for partial payments
- Displays:
  - Payment method with icon
  - Transaction ID
  - Payment date
  - Payment notes
  - Amount paid
- Summary section showing:
  - Total paid amount
  - Remaining balance (red if unpaid, green if fully paid)

**3. Bookings.jsx**

- Updated payment status column to show:
  - Status badge
  - For partial payments: Shows "৳{paid_amount} / ৳{total_price}"
  - Updated time display to use formatTime() helper

**Status**: ✅ COMPLETED

---

## 🔄 Data Flow

### Creating a Booking with Partial Payment:

1. User selects booking details (turf, date, time)
2. System calculates `total_price` based on time slots and pricing
3. User selects `payment_status: "partial"`
4. Partial payment section appears
5. User enters `paid_amount` (e.g., 1000 out of 2000)
6. UI shows remaining balance: `৳1000`
7. User selects payment method and enters Transaction ID
8. Booking is saved with:
   - `payment_status: "partial"`
   - `paid_amount: 1000`
   - `payment_history: [{amount: 1000, date, method, txn_id}]`

### Recording Additional Partial Payments:

1. Admin opens existing booking (payment_status = "partial")
2. PaymentHistoryPanel shows previous payments and remaining balance
3. Admin increases `paid_amount` (e.g., from 1000 to 1800)
4. New payment is recorded in history
5. Remaining balance updates: `৳200`

---

## 📊 Database Schema

### Booking Collection - New Fields:

```javascript
{
  // ... existing fields
  payment_status: "partial",     // New: tracks status
  paid_amount: 1000,             // New: total paid so far
  payment_history: [             // New: complete audit trail
    {
      amount: 1000,
      date: "2026-05-21T10:30:00Z",
      method: "bkash",
      txn_id: "8K7L9M0",
      notes: "Initial payment"
    }
  ]
}
```

---

## 🎨 UI Features

### Partial Payment Input Section (When payment_status = "partial"):

```
┌─ Total Amount        ┌─ Paid Amount (৳)      ┐
│  ৳2000 [DISABLED]    │  [input: 1000]         │
└──────────────────────┴────────────────────────┘
  Remaining Balance: ৳1000
```

### Payment History Display (Edit Mode):

```
┌─ Payment History (1 payment) ──────────────┐
│  🟪 BKash                                   │
│     TxnID: 8K7L9M0                         │
│     📅 May 21, 2026                        │
│     Amount: ৳1000                          │
├─────────────────────────────────────────────┤
│  Total Paid: ৳1000                         │
│  Remaining Balance: ৳1000                  │
└─────────────────────────────────────────────┘
```

### Bookings List (Payment Status Column):

```
Status: partial
৳1000 / ৳2000
```

---

## ✅ Validation Rules

1. **Paid Amount Validation**:
   - Cannot be negative
   - Cannot exceed total_price
   - Updates in real-time as user types

2. **Payment Status Rules**:
   - `paid` → No paid_amount input needed
   - `partial` → Requires paid_amount < total_price
   - `unpaid` → No payment tracking
   - `refunded` → No changes allowed

3. **Remaining Balance Calculation**:
   - `remaining = total_price - paid_amount`
   - Displayed in real-time
   - Marked in red if > 0 (unpaid)

---

## 🚀 Usage Workflow

### Admin Creating Partial Payment Booking:

1. Click "New Booking"
2. Fill in turf, date, time, customer details
3. Select Payment Status: "partial"
4. Enter amount paid (e.g., 1000)
5. Select payment method (bkash, nagad, etc.)
6. Enter Transaction ID
7. Click "Book" → Booking created with tracking

### Admin Updating Partial Payment:

1. Click on existing partial payment booking
2. View payment history panel
3. Change `paid_amount` to increase payment
4. Select payment method for new payment
5. Click "Update" → Payment history updated

### Bookings List View:

- See partial payment status with "৳1000 / ৳2000" format
- Quickly identify unpaid bookings
- Click to edit and record additional payments

---

## 📝 Files Modified

### Backend:

- `/server/models/Booking.js` - Added paid_amount and payment_history schema

### Frontend:

- `/client/src/components/bookings/BookingFormDialog.jsx` - Added partial payment UI
- `/client/src/components/bookings/PaymentHistoryPanel.jsx` - NEW payment history display
- `/client/src/pages/Bookings.jsx` - Updated payment status display

---

## 🔍 Testing Checklist

- [ ] Create booking with full payment (paid)
- [ ] Create booking with partial payment (e.g., 1000/2000)
- [ ] Verify remaining balance shows correctly
- [ ] Edit partial payment booking and increase payment
- [ ] Verify payment history displays correctly
- [ ] Verify bookings list shows partial payment amounts
- [ ] Verify validation prevents invalid amounts
- [ ] Verify payment method and TxnID saved correctly

---

## 🎯 Future Enhancements

1. **Payment Notifications**: Email/SMS when payment is recorded
2. **Auto-Mark as Paid**: When paid_amount = total_price, change status to "paid"
3. **Payment Reminders**: Automated reminders for unpaid balance
4. **Payment Analytics**: Reports on partial vs full payments
5. **Bulk Payment Recording**: Record multiple partial payments at once
6. **Payment Plans**: Define payment schedule/installments
7. **Refund Tracking**: Track refunded amounts separately

---

## 📌 Notes

- Partial payment amounts are stored in `paid_amount` field
- Complete payment audit trail in `payment_history` array
- Remaining balance calculated dynamically: `total_price - paid_amount`
- Payment history can be viewed in booking edit form
- Supports multiple payment methods and transactions per booking
