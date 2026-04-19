import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, addDays, startOfWeek } from "date-fns";

const statusColors = {
  confirmed: "bg-emerald-500",
  pending: "bg-amber-500",
  cancelled: "bg-red-400",
  completed: "bg-blue-500",
  no_show: "bg-gray-400",
};

export default function BookingCalendar({ bookings, turfs, selectedDate, onDateSelect }) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 17 }, (_, i) => i + 6);

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Header */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-100">
            <div className="p-2" />
            {weekDays.map((d) => {
              const isToday = format(d, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
              const isSelected = format(d, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
              return (
                <button
                  key={d.toISOString()}
                  onClick={() => onDateSelect(d)}
                  className={`p-2 text-center transition-colors ${isSelected ? "bg-emerald-50" : ""}`}
                >
                  <p className="text-[10px] text-gray-400 uppercase">{format(d, "EEE")}</p>
                  <p className={`text-sm font-semibold mt-0.5 ${isToday ? "text-emerald-600" : "text-gray-700"}`}>
                    {format(d, "d")}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Time grid */}
          {hours.map((h) => (
            <div key={h} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-50">
              <div className="p-1 text-[10px] text-gray-400 text-right pr-2 pt-1">{h}:00</div>
              {weekDays.map((d) => {
                const dateStr = format(d, "yyyy-MM-dd");
                const slotBookings = bookings.filter(
                  (b) => b.date === dateStr && b.start_hour <= h && b.end_hour > h && b.status !== "cancelled"
                );
                return (
                  <div key={dateStr + h} className="min-h-[32px] border-l border-gray-50 px-0.5 py-0.5">
                    {slotBookings.map((b) => (
                      h === b.start_hour && (
                        <div
                          key={b.id}
                          className={`${statusColors[b.status]} text-white text-[9px] px-1.5 py-0.5 rounded truncate`}
                          style={{ height: `${(b.end_hour - b.start_hour) * 32 - 4}px` }}
                          title={`${b.customer_name} (${b.turf_name})`}
                        >
                          {b.customer_name}
                        </div>
                      )
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}