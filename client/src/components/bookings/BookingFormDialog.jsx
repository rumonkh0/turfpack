import React, { useState, useMemo, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/api/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function calcPrice(turf, date, startHour, endHour) {
  if (!turf || !date) return 0;
  const d = new Date(date);
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  let total = 0;
  for (let h = startHour; h < endHour; h++) {
    let rate = turf.base_price || 0;
    if (h >= (turf.peak_hours_start || 17) && h < (turf.peak_hours_end || 21)) {
      rate = turf.peak_price || rate;
    }
    if (h >= 21 || h < 6) {
      rate = turf.night_price || rate;
    }
    if (isWeekend) {
      rate = Math.round(rate * (turf.weekend_multiplier || 1.2));
    }
    total += rate;
  }
  return total;
}

export default function BookingFormDialog({ open, onOpenChange, turfs, existingBookings, onSaved, booking }) {
  const isEdit = !!booking;
  const [form, setForm] = useState({
    turf_id: "", customer_name: "", customer_phone: "", customer_email: "",
    date: new Date().toISOString().split("T")[0],
    start_hour: 17, end_hour: 18, status: "confirmed", payment_status: "unpaid",
    payment_method: "bkash", notes: "", is_recurring: false, promo_code: "",
    txn_id: "",
  });
  const [saving, setSaving] = useState(false);

  const defaults = useMemo(() => ({
    turf_id: "", customer_name: "", customer_phone: "", customer_email: "",
    date: new Date().toISOString().split("T")[0],
    start_hour: 17, end_hour: 18, status: "confirmed", payment_status: "unpaid",
    payment_method: "bkash", notes: "", is_recurring: false, promo_code: "",
    txn_id: "",
  }), []);

  useEffect(() => {
    if (open) {
      setForm(booking ? { ...defaults, ...booking } : defaults);
    }
  }, [booking, open, defaults]);

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const selectedTurf = turfs.find((t) => t.id === form.turf_id);
  const hours = selectedTurf
    ? Array.from({ length: (selectedTurf.closing_hour || 23) - (selectedTurf.opening_hour || 6) }, (_, i) => i + (selectedTurf.opening_hour || 6))
    : Array.from({ length: 17 }, (_, i) => i + 6);

  const isHourBooked = (h) => {
    if (!form.turf_id || !form.date) return false;
    return existingBookings.some((b) => {
      // Handle turf_id being either a string ID or a populated object
      const b_turf_id = (typeof b.turf_id === 'object' ? (b.turf_id?._id || b.turf_id?.id) : b.turf_id);
      
      // Ensure date comparison is robust (only the YYYY-MM-DD part)
      const b_date = b.date?.split('T')[0];
      const f_date = form.date?.split('T')[0];

      return (
        b.id !== booking?.id &&
        b_turf_id === form.turf_id &&
        b_date === f_date &&
        b.status !== "cancelled" &&
        h >= b.start_hour &&
        h < b.end_hour
      );
    });
  };

  const totalPrice = useMemo(
    () => calcPrice(selectedTurf, form.date, form.start_hour, form.end_hour),
    [selectedTurf, form.date, form.start_hour, form.end_hour]
  );

  const conflicting = useMemo(() => {
    for (let h = form.start_hour; h < form.end_hour; h++) {
      if (isHourBooked(h)) return true;
    }
    return false;
  }, [form.turf_id, form.date, form.start_hour, form.end_hour, existingBookings, booking?.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        ...form,
        turf_name: selectedTurf?.name || "",
        total_price: totalPrice,
        duration_hours: form.end_hour - form.start_hour,
      };
      if (isEdit) {
        await apiClient.entities.Booking.update(booking.id, data);
        toast.success("Booking updated successfully");
      } else {
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
            <Select value={form.turf_id} onValueChange={(v) => set("turf_id", v)}>
              <SelectTrigger><SelectValue placeholder="Select turf" /></SelectTrigger>
              <SelectContent>
                {turfs.filter((t) => t.status === "active").map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Customer Name</Label>
              <Input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Email (optional)</Label>
            <Input value={form.customer_email} onChange={(e) => set("customer_email", e.target.value)} />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Hour</Label>
              <Select value={String(form.start_hour)} onValueChange={(v) => set("start_hour", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {hours.map((h) => {
                    const booked = isHourBooked(h);
                    return (
                      <SelectItem key={h} value={String(h)} disabled={booked}>
                        {h}:00 {booked ? "(Booked)" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>End Hour</Label>
              <Select value={String(form.end_hour)} onValueChange={(v) => set("end_hour", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {hours.filter((h) => h > form.start_hour).map((h) => {
                    // Check if any hour between start and this end is booked
                    let hasBookedSlot = false;
                    for (let i = form.start_hour; i < h; i++) {
                      if (isHourBooked(i)) {
                        hasBookedSlot = true;
                        break;
                      }
                    }
                    return (
                      <SelectItem key={h} value={String(h)} disabled={hasBookedSlot}>
                        {h}:00 {hasBookedSlot ? "(Unavailable)" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {conflicting && (
            <div className="bg-red-50 text-red-700 text-xs px-3 py-2 rounded-lg">
              ⚠ This slot conflicts with an existing booking!
            </div>
          )}

          <div className="bg-emerald-50 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm text-emerald-700 font-medium">Estimated Price</span>
            <span className="text-lg font-bold text-emerald-800">৳{totalPrice.toLocaleString()}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["confirmed", "pending", "cancelled", "completed", "no_show"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment Status</Label>
              <Select value={form.payment_status} onValueChange={(v) => set("payment_status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["paid", "unpaid", "partial", "refunded"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {["paid", "partial"].includes(form.payment_status) && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1">
              <div>
                <Label>Payment Method</Label>
                <Select value={form.payment_method} onValueChange={(v) => set("payment_method", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["bkash", "nagad", "rocket", "cash", "card", "other"].map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
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
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any special requests..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving || conflicting || !form.turf_id || !form.customer_name || !form.customer_phone}
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
