import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const statusColors = {
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
  no_show: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function RecentBookings({ bookings }) {
  const recent = bookings.slice(0, 6);

  return (
    <Card className="border-0 shadow-sm">
      <div className="p-5 border-b border-gray-50">
        <h3 className="text-sm font-semibold text-gray-800">Recent Bookings</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {recent.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-400">No bookings yet</div>
        )}
        {recent.map((b) => (
          <div key={b.id} className="px-5 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">{b.customer_name}</p>
              <p className="text-xs text-gray-400">
                {b.turf_name} · {b.date ? format(new Date(b.date), "MMM d") : ""} · {b.start_hour}:00–{b.end_hour}:00
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">৳{b.total_price?.toLocaleString() || 0}</span>
              <Badge variant="outline" className={`text-[10px] font-medium ${statusColors[b.status] || ""}`}>
                {b.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}