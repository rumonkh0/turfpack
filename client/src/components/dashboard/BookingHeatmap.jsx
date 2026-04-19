import React from "react";
import { Card } from "@/components/ui/card";

const hours = Array.from({ length: 18 }, (_, i) => i + 6);
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function BookingHeatmap({ bookings }) {
  const grid = {};
  days.forEach((d, di) => {
    hours.forEach((h) => {
      grid[`${di}-${h}`] = 0;
    });
  });

  bookings.forEach((b) => {
    if (!b.date) return;
    const d = new Date(b.date);
    const dayIdx = (d.getDay() + 6) % 7;
    for (let h = b.start_hour; h < b.end_hour; h++) {
      const key = `${dayIdx}-${h}`;
      if (grid[key] !== undefined) grid[key]++;
    }
  });

  const maxVal = Math.max(1, ...Object.values(grid));

  const getColor = (val) => {
    if (val === 0) return "bg-gray-50";
    const ratio = val / maxVal;
    if (ratio < 0.25) return "bg-emerald-100";
    if (ratio < 0.5) return "bg-emerald-200";
    if (ratio < 0.75) return "bg-emerald-400";
    return "bg-emerald-600";
  };

  return (
    <Card className="p-5 border-0 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">Booking Heatmap</h3>
      <div className="overflow-x-auto">
        <div className="min-w-[500px]">
          <div className="flex gap-1 mb-1 ml-10">
            {hours.map((h) => (
              <div key={h} className="flex-1 text-center text-[9px] text-gray-400">
                {h}:00
              </div>
            ))}
          </div>
          {days.map((day, di) => (
            <div key={day} className="flex items-center gap-1 mb-1">
              <span className="w-8 text-[10px] text-gray-400 text-right mr-1">{day}</span>
              {hours.map((h) => (
                <div
                  key={h}
                  className={`flex-1 h-5 rounded-sm ${getColor(grid[`${di}-${h}`])} transition-colors`}
                  title={`${day} ${h}:00 - ${grid[`${di}-${h}`]} bookings`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 justify-end">
        <span className="text-[10px] text-gray-400">Less</span>
        {["bg-gray-50", "bg-emerald-100", "bg-emerald-200", "bg-emerald-400", "bg-emerald-600"].map((c) => (
          <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
        ))}
        <span className="text-[10px] text-gray-400">More</span>
      </div>
    </Card>
  );
}