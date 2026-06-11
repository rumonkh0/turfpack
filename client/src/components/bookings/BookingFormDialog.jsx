import React, { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/api/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import PaymentHistoryPanel from "./PaymentHistoryPanel";

function calcPrice(turf, date, startHour, endHour) {
  if (!turf || !date) return 0;
  const d = new Date(date);
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  let total = 0;
  const step = 0.25; // 15-minute pricing blocks
  for (let h = Number(startHour); h < Number(endHour); h += step) {
    const hourMark = Math.floor(h);
    let rate = turf.base_price || 0;
    if (
      hourMark >= (turf.peak_hours_start || 17) &&
      hourMark < (turf.peak_hours_end || 21)
    ) {
      rate = turf.peak_price || rate;
    }
    if (hourMark >= 21 || hourMark < 6) {
      rate = turf.night_price || rate;
    }
    if (isWeekend) {
      rate = Math.round(rate * (turf.weekend_multiplier || 1.2));
    }
    total += rate * step;
  }
  return Math.round(total);
}

export default function BookingFormDialog({
  open,
  onOpenChange,
  turfs,
  existingBookings,
  onSaved,
  booking,
}) {
  const isEdit = !!booking;
  const [form, setForm] = useState({
    turf_id: "",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    date: new Date().toISOString().split("T")[0],
    start_hour: 17,
    end_hour: 18,
    status: "confirmed",
    payment_status: "unpaid",
    payment_method: "bkash",
    paid_amount: 0,
    notes: "",
    is_recurring: false,
    promo_code: "",
    txn_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [startHour12, setStartHour12] = useState("5");
  const [startMinute, setStartMinute] = useState("00");
  const [startMeridiem, setStartMeridiem] = useState("PM");
  const [endHour12, setEndHour12] = useState("6");
  const [endMinute, setEndMinute] = useState("00");
  const [endMeridiem, setEndMeridiem] = useState("PM");

  const to12 = (value24) => {
    const totalMinutes = Math.round(Number(value24 || 0) * 60);
    const safeMinutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
    const hour24 = Math.floor(safeMinutes / 60);
    const minute = safeMinutes % 60;
    const meridiem = hour24 >= 12 ? "PM" : "AM";
    const hour = ((hour24 + 11) % 12) + 1;
    return { hour, minute, meridiem };
  };

  const to24 = (hour12, minute, meridiem) => {
    const parsedHour = Number(hour12);
    const parsedMinute = Number(minute);
    if (!Number.isFinite(parsedHour) || !Number.isFinite(parsedMinute))
      return null;
    if (parsedHour < 1 || parsedHour > 12) return null;
    if (parsedMinute < 0 || parsedMinute > 59) return null;
    let hour = parsedHour % 12;
    if (meridiem === "PM") hour += 12;
    return hour + parsedMinute / 60;
  };

  const defaults = useMemo(
    () => ({
      turf_id: "",
      customer_name: "",
      customer_phone: "",
      customer_email: "",
      date: new Date().toISOString().split("T")[0],
      start_hour: 17,
      end_hour: 18,
      status: "confirmed",
      payment_status: "unpaid",
      payment_method: "bkash",
      notes: "",
      is_recurring: false,
      promo_code: "",
      txn_id: "",
    }),
    [],
  );

  useEffect(() => {
    if (open) {
      if (booking) {
        const existingPaid = Number(booking.paid_amount || 0);
        const existingTotal = Number(booking.total_price || 0);
        const due = Math.max(0, existingTotal - existingPaid);
        setForm({ ...defaults, ...booking, paid_amount: due, txn_id: "" });
      } else {
        setForm(defaults);
      }
    }
  }, [booking, open, defaults]);

  useEffect(() => {
    const s = to12(form.start_hour);
    const e = to12(form.end_hour);
    setStartHour12(String(s.hour));
    setStartMinute(String(s.minute).padStart(2, "0"));
    setStartMeridiem(s.meridiem);
    setEndHour12(String(e.hour));
    setEndMinute(String(e.minute).padStart(2, "0"));
    setEndMeridiem(e.meridiem);
  }, [form.start_hour, form.end_hour]);

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const selectedTurf = turfs.find((t) => t.id === form.turf_id);

  const hasRangeConflict = (rangeStart, rangeEnd) => {
    if (!form.turf_id || !form.date) return false;
    return existingBookings.some((b) => {
      // Handle turf_id being either a string ID or a populated object
      const b_turf_id =
        typeof b.turf_id === "object"
          ? b.turf_id?._id || b.turf_id?.id
          : b.turf_id;

      // Ensure date comparison is robust (only the YYYY-MM-DD part)
      const b_date = b.date?.split("T")[0];
      const f_date = form.date?.split("T")[0];

      return (
        b.id !== booking?.id &&
        b_turf_id === form.turf_id &&
        b_date === f_date &&
        b.status !== "cancelled" &&
        rangeStart < Number(b.end_hour) &&
        rangeEnd > Number(b.start_hour)
      );
    });
  };

  const totalPrice = useMemo(
    () => calcPrice(selectedTurf, form.date, form.start_hour, form.end_hour),
    [selectedTurf, form.date, form.start_hour, form.end_hour],
  );

  // Due is remaining amount for existing booking (for new booking due === totalPrice)
  const dueAmount = useMemo(() => {
    const existingPaid = Number(booking?.paid_amount || 0);
    return Math.max(0, totalPrice - existingPaid);
  }, [totalPrice, booking]);

  const invalidTimeRange = Number(form.end_hour) <= Number(form.start_hour);
  const outsideTurfHours = selectedTurf
    ? Number(form.start_hour) < Number(selectedTurf.opening_hour || 6) ||
      Number(form.end_hour) > Number(selectedTurf.closing_hour || 23)
    : false;

  const conflicting = useMemo(() => {
    if (invalidTimeRange) return false;
    return hasRangeConflict(Number(form.start_hour), Number(form.end_hour));
  }, [
    form.turf_id,
    form.date,
    form.start_hour,
    form.end_hour,
    existingBookings,
    booking?.id,
  ]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const calculatedTotal = calcPrice(
        selectedTurf,
        form.date,
        form.start_hour,
        form.end_hour,
      );

      // Build payment history and payload
      let paymentHistory = booking?.payment_history || [];
      const data = {
        ...form,
        turf_name: selectedTurf?.name || "",
        total_price: calculatedTotal,
        duration_hours: form.end_hour - form.start_hour,
      };

      if (isEdit) {
        // For edits, treat paid_amount as an incremental payment to deduct from due.
        const existingPaid = Number(booking?.paid_amount || 0);
        const due = Math.max(0, calculatedTotal - existingPaid);
        const entered = Number(form.paid_amount || 0);

        if (entered > 0) {
          const increment = Math.min(entered, due);
          paymentHistory = [
            ...(booking?.payment_history || []),
            {
              amount: increment,
              date: new Date(),
              method: form.payment_method,
              txn_id: form.txn_id || "",
              notes: form.notes || "",
            },
          ];
          data.paid_amount = existingPaid + increment;
          data.payment_history = paymentHistory;
          data.payment_status =
            data.paid_amount >= calculatedTotal ? "paid" : "partial";
        } else {
          // entered === 0 -> preserve existing payment state (do not overwrite paid_amount/payment_history/status/txn)
          delete data.paid_amount;
          delete data.payment_history;
          delete data.payment_status;
          delete data.payment_method;
          delete data.txn_id;
        }

        await apiClient.entities.Booking.update(booking.id, data);
        toast.success("Booking updated successfully");
      } else {
        // New booking creation
        if (["paid", "partial"].includes(form.payment_status)) {
          const paymentAmount =
            form.payment_status === "partial"
              ? Number(form.paid_amount || 0)
              : Number(calculatedTotal || 0);
          paymentHistory = [
            {
              amount: paymentAmount,
              date: new Date(),
              method: form.payment_method,
              txn_id: form.txn_id || "",
              notes: form.notes || "",
            },
          ];
          data.paid_amount = paymentAmount;
          data.payment_history = paymentHistory;
        }

        await apiClient.entities.Booking.create(data);
        toast.success("Booking created successfully");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message || "Failed to save booking");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Booking" : "New Booking"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Turf</Label>
            <Select
              value={form.turf_id}
              onValueChange={(v) => set("turf_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select turf" />
              </SelectTrigger>
              <SelectContent>
                {turfs
                  .filter((t) => t.status === "active")
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Customer Name</Label>
              <Input
                value={form.customer_name}
                onChange={(e) => set("customer_name", e.target.value)}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={form.customer_phone}
                onChange={(e) => set("customer_phone", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Email (optional)</Label>
            <Input
              value={form.customer_email}
              onChange={(e) => set("customer_email", e.target.value)}
            />
          </div>
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Time</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={startHour12}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStartHour12(val);
                    const converted = to24(val, startMinute, startMeridiem);
                    if (converted !== null) set("start_hour", converted);
                  }}
                  placeholder="HH"
                />
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={startMinute}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStartMinute(val);
                    const converted = to24(startHour12, val, startMeridiem);
                    if (converted !== null) set("start_hour", converted);
                  }}
                  placeholder="MM"
                />
                <Select
                  value={startMeridiem}
                  onValueChange={(v) => {
                    setStartMeridiem(v);
                    const converted = to24(startHour12, startMinute, v);
                    if (converted !== null) set("start_hour", converted);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AM">AM</SelectItem>
                    <SelectItem value="PM">PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>End Time</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={endHour12}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEndHour12(val);
                    const converted = to24(val, endMinute, endMeridiem);
                    if (converted !== null) set("end_hour", converted);
                  }}
                  placeholder="HH"
                />
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={endMinute}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEndMinute(val);
                    const converted = to24(endHour12, val, endMeridiem);
                    if (converted !== null) set("end_hour", converted);
                  }}
                  placeholder="MM"
                />
                <Select
                  value={endMeridiem}
                  onValueChange={(v) => {
                    setEndMeridiem(v);
                    const converted = to24(endHour12, endMinute, v);
                    if (converted !== null) set("end_hour", converted);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AM">AM</SelectItem>
                    <SelectItem value="PM">PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {invalidTimeRange && (
            <div className="bg-amber-50 text-amber-700 text-xs px-3 py-2 rounded-lg">
              ⚠ End time must be later than start time.
            </div>
          )}

          {outsideTurfHours && (
            <div className="bg-amber-50 text-amber-700 text-xs px-3 py-2 rounded-lg">
              ⚠ Selected time is outside turf operating hours.
            </div>
          )}

          {conflicting && (
            <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded-lg">
              ⚠ This slot conflicts with an existing booking!
            </div>
          )}

          <div className="bg-emerald-50 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm text-emerald-700 font-medium">
              Estimated Price
            </span>
            <span className="text-lg font-bold text-emerald-800">
              ৳{totalPrice.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "confirmed",
                    "pending",
                    "cancelled",
                    "completed",
                    "no_show",
                  ].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment Status</Label>
              <Select
                value={form.payment_status}
                onValueChange={(v) => set("payment_status", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["paid", "unpaid", "partial", "refunded"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {["paid", "partial"].includes(form.payment_status) && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1">
              <div>
                <Label>Payment Method</Label>
                <Select
                  value={form.payment_method}
                  onValueChange={(v) => set("payment_method", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["bkash", "nagad", "rocket", "cash", "card", "other"].map(
                      (m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Transaction ID (TxnID)</Label>
                <Input
                  value={form.txn_id || ""}
                  onChange={(e) => set("txn_id", e.target.value)}
                  placeholder="e.g. 8K7L9M0"
                />
              </div>
            </div>
          )}

          {form.payment_status === "partial" && (
            <div className="grid grid-cols-2 gap-4 p-3 bg-amber-50 border border-amber-200 rounded-lg animate-in fade-in slide-in-from-top-1">
              <div>
                <Label className="text-amber-900">Total Amount</Label>
                <Input
                  type="number"
                  value={totalPrice}
                  disabled
                  className="bg-amber-50 text-amber-900 font-semibold"
                />
              </div>
              <div>
                <Label htmlFor="paid-amount" className="text-amber-900">
                  Paid Amount (৳) — amount to deduct from due
                </Label>
                <Input
                  id="paid-amount"
                  type="number"
                  value={form.paid_amount || 0}
                  onChange={(e) => {
                    const raw = Number(e.target.value) || 0;
                    const amount = Math.min(raw, dueAmount || 0);
                    set("paid_amount", amount);
                  }}
                  max={dueAmount || 0}
                  min={0}
                  placeholder={`Max ৳${dueAmount}`}
                  className="font-semibold border-amber-300 focus:border-amber-400"
                />
              </div>
              <div className="col-span-2">
                <div className="text-sm text-amber-900 font-semibold">
                  Remaining Balance:{" "}
                  <span className="text-lg">
                    ৳
                    {(totalPrice || 0) -
                      (booking?.paid_amount || 0) -
                      (form.paid_amount || 0)}
                  </span>
                </div>
              </div>
            </div>
          )}
          <div>
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Any special requests..."
            />
          </div>

          {isEdit && booking && <PaymentHistoryPanel booking={booking} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              saving ||
              conflicting ||
              invalidTimeRange ||
              outsideTurfHours ||
              !form.turf_id ||
              !form.customer_name ||
              !form.customer_phone
            }
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? "Update" : "Book"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
