import React from "react";
import { Card } from "@/components/ui/card";
import { formatTime } from "@/lib/utils";
import { startOfWeek, addDays, format } from "date-fns";

const hours = Array.from({ length: 12 }, (_, i) => 6 + (i * 1.5));

export default function BookingHeatmap({ bookings }) {
  const weekStart = addDays(new Date(), -1); // Yesterday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const grid = {};
  weekDays.forEach((d, di) => {
    hours.forEach((h) => {
      grid[`${di}-${h}`] = 0;
    });
  });

  bookings.forEach((b) => {
    if (!b.date) return;
    const bDate = b.date.split("T")[0];
    const dayIdx = weekDays.findIndex((d) => format(d, "yyyy-MM-dd") === bDate);
    if (dayIdx === -1) return; // Ignore bookings outside current week

    for (let h = b.start_hour; h < b.end_hour; h += 1.5) {
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
          <div className="flex gap-1 mb-1 ml-14">
            {hours.map((h) => (
              <div key={h} className="flex-1 text-center text-[8px] text-gray-400 flex flex-col leading-tight">
                <span>{formatTime(h).replace(' ', '')}</span>
                <span className="text-[6px]">-</span>
                <span>{formatTime(h+1.5).replace(' ', '')}</span>
              </div>
            ))}
          </div>
          {weekDays.map((d, di) => (
            <div key={d.toISOString()} className="flex items-center gap-1 mb-1">
              <div className="w-12 text-[9px] text-gray-400 text-right mr-1 leading-tight flex-shrink-0">
                <span className="font-semibold text-gray-600">{format(d, "EEE")}</span><br/>
                {format(d, "MMM d")}
              </div>
              {hours.map((h) => (
                <div
                  key={h}
                  className={`flex-1 h-8 rounded-sm ${getColor(grid[`${di}-${h}`])} transition-colors`}
                  title={`${format(d, "MMM d")} ${formatTime(h)} - ${formatTime(h+1.5)}: ${grid[`${di}-${h}`]} bookings`}
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