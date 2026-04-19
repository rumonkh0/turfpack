import React, { useState, useMemo } from "react";
import { apiClient } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Zap, CheckCircle2, Loader2 } from "lucide-react";
import { format, addDays } from "date-fns";

function calcPrice(turf, date, startHour, endHour) {
  if (!turf || !date) return 0;
  const d = new Date(date);
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  let total = 0;
  for (let h = startHour; h < endHour; h++) {
    let rate = turf.base_price || 0;
    if (h >= (turf.peak_hours_start || 17) && h < (turf.peak_hours_end || 21)) rate = turf.peak_price || rate;
    if (h >= 21 || h < 6) rate = turf.night_price || rate;
    if (isWeekend) rate = Math.round(rate * (turf.weekend_multiplier || 1.2));
    total += rate;
  }
  return total;
}

export default function PublicBooking() {
  const [step, setStep] = useState(1);
  const [selectedTurf, setSelectedTurf] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [startHour, setStartHour] = useState(null);
  const [endHour, setEndHour] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [booked, setBooked] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: turfs = [] } = useQuery({
    queryKey: ["turfs"],
    queryFn: () => apiClient.entities.Turf.list(),
  });
  const { data: bookings = [] } = useQuery({
    queryKey: ["pub-bookings"],
    queryFn: () => apiClient.entities.Booking.list("-created_date", 1000),
  });

  const activeTurfs = turfs.filter((t) => t.status === "active");

  const bookedSlots = useMemo(() => {
    if (!selectedTurf) return new Set();
    const s = new Set();
    bookings
      .filter((b) => b.turf_id === selectedTurf.id && b.date === selectedDate && b.status !== "cancelled")
      .forEach((b) => {
        for (let h = b.start_hour; h < b.end_hour; h++) s.add(h);
      });
    return s;
  }, [selectedTurf, selectedDate, bookings]);

  const hours = selectedTurf
    ? Array.from({ length: (selectedTurf.closing_hour || 23) - (selectedTurf.opening_hour || 6) }, (_, i) => i + (selectedTurf.opening_hour || 6))
    : [];

  const price = useMemo(
    () => (startHour !== null && endHour !== null ? calcPrice(selectedTurf, selectedDate, startHour, endHour) : 0),
    [selectedTurf, selectedDate, startHour, endHour]
  );

  const handleBook = async () => {
    setSaving(true);
    await apiClient.entities.Booking.create({
      turf_id: selectedTurf.id,
      turf_name: selectedTurf.name,
      customer_name: form.name,
      customer_phone: form.phone,
      customer_email: form.email,
      date: selectedDate,
      start_hour: startHour,
      end_hour: endHour,
      duration_hours: endHour - startHour,
      total_price: price,
      status: "pending",
      payment_status: "unpaid",
    });
    setSaving(false);
    setBooked(true);
  };

  if (booked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center border-0 shadow-lg">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
          <p className="text-gray-500 mb-4">
            {selectedTurf.name} · {format(new Date(selectedDate), "EEEE, MMM d")} · {startHour}:00 – {endHour}:00
          </p>
          <p className="text-2xl font-bold text-emerald-600 mb-6">৳{price.toLocaleString()}</p>
          <Button onClick={() => { setBooked(false); setStep(1); setSelectedTurf(null); setStartHour(null); setEndHour(null); }} className="bg-emerald-600 hover:bg-emerald-700">
            Book Another Slot
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">TS</span>
          </div>
          <h1 className="font-bold text-gray-900 text-lg">TurfSlot</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 py-8">
        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${step >= s ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-400"}`}>
                {s}
              </div>
              <span className={`text-xs hidden sm:inline ${step >= s ? "text-emerald-700" : "text-gray-400"}`}>
                {s === 1 ? "Select Turf" : s === 2 ? "Pick Slot" : "Your Details"}
              </span>
              {s < 3 && <div className={`w-8 h-px ${step > s ? "bg-emerald-400" : "bg-gray-200"}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Select Turf */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Choose a Turf</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeTurfs.map((t) => (
                <Card
                  key={t.id}
                  className={`overflow-hidden border-0 shadow-sm cursor-pointer transition-all hover:shadow-md ${selectedTurf?.id === t.id ? "ring-2 ring-emerald-500" : ""}`}
                  onClick={() => setSelectedTurf(t)}
                >
                  <div className="h-32 bg-gray-100">
                    {t.image_url ? (
                      <img src={t.image_url} alt={t.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100">
                        <MapPin className="w-6 h-6 text-emerald-300" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-gray-900 text-sm">{t.name}</h3>
                    <p className="text-xs text-gray-400">{t.type?.replace(/-/g, " ")} · {t.size}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" />{t.opening_hour || 6}:00–{t.closing_hour || 23}:00</span>
                      <span className="text-sm font-bold text-emerald-600">৳{t.base_price}/hr</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            {selectedTurf && (
              <div className="mt-6 flex justify-end">
                <Button onClick={() => setStep(2)} className="bg-emerald-600 hover:bg-emerald-700">Continue</Button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Pick Slot */}
        {step === 2 && selectedTurf && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Pick Your Slot</h2>
            <div className="mb-4">
              <Label>Date</Label>
              <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                {Array.from({ length: 14 }, (_, i) => {
                  const d = addDays(new Date(), i);
                  const ds = d.toISOString().split("T")[0];
                  const isSelected = ds === selectedDate;
                  return (
                    <button
                      key={ds}
                      onClick={() => { setSelectedDate(ds); setStartHour(null); setEndHour(null); }}
                      className={`flex-shrink-0 w-14 py-2 rounded-xl text-center transition-all ${isSelected ? "bg-emerald-600 text-white shadow-md" : "bg-white border hover:border-emerald-300"}`}
                    >
                      <p className="text-[10px]">{format(d, "EEE")}</p>
                      <p className="text-sm font-bold">{format(d, "d")}</p>
                      <p className="text-[10px]">{format(d, "MMM")}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mb-4">
              <Label className="mb-2 block">Available Slots</Label>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-9 gap-2">
                {hours.map((h) => {
                  const isBooked = bookedSlots.has(h);
                  const isStart = startHour === h;
                  const inRange = startHour !== null && endHour !== null && h >= startHour && h < endHour;
                  return (
                    <button
                      key={h}
                      disabled={isBooked}
                      onClick={() => {
                        if (startHour === null || (endHour !== null)) {
                          setStartHour(h);
                          setEndHour(h + 1);
                        } else if (h > startHour && !Array.from({ length: h - startHour }, (_, i) => startHour + i).some((sh) => bookedSlots.has(sh))) {
                          setEndHour(h + 1);
                        } else {
                          setStartHour(h);
                          setEndHour(h + 1);
                        }
                      }}
                      className={`py-2 rounded-lg text-xs font-medium transition-all ${
                        isBooked
                          ? "bg-red-50 text-red-300 cursor-not-allowed line-through"
                          : inRange
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-white border hover:border-emerald-300 text-gray-600"
                      }`}
                    >
                      {h}:00
                    </button>
                  );
                })}
              </div>
            </div>

            {startHour !== null && endHour !== null && (
              <Card className="bg-emerald-50 border-emerald-200 p-4 mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-emerald-800">
                      {startHour}:00 – {endHour}:00 ({endHour - startHour}hr)
                    </p>
                    <p className="text-xs text-emerald-600">{format(new Date(selectedDate), "EEEE, MMMM d")}</p>
                  </div>
                  <p className="text-xl font-bold text-emerald-700">৳{price.toLocaleString()}</p>
                </div>
              </Card>
            )}

            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button
                onClick={() => setStep(3)}
                disabled={startHour === null}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Details */}
        {step === 3 && (
          <div className="max-w-md mx-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Your Details</h2>
            <Card className="p-5 border-0 shadow-sm space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX" />
              </div>
              <div>
                <Label>Email (optional)</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
              </div>

              <Card className="bg-gray-50 p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Booking Summary</h4>
                <div className="space-y-1 text-sm">
                  <p className="flex justify-between"><span className="text-gray-500">Turf</span><span className="font-medium">{selectedTurf?.name}</span></p>
                  <p className="flex justify-between"><span className="text-gray-500">Date</span><span className="font-medium">{format(new Date(selectedDate), "MMM d, yyyy")}</span></p>
                  <p className="flex justify-between"><span className="text-gray-500">Time</span><span className="font-medium">{startHour}:00 – {endHour}:00</span></p>
                  <div className="border-t pt-1 mt-1">
                    <p className="flex justify-between"><span className="text-gray-700 font-semibold">Total</span><span className="text-lg font-bold text-emerald-600">৳{price.toLocaleString()}</span></p>
                  </div>
                </div>
              </Card>
            </Card>

            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button
                onClick={handleBook}
                disabled={saving || !form.name || !form.phone}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm Booking
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
