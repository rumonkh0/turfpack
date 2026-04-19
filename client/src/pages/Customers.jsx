import React, { useState, useMemo } from "react";
import { apiClient } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Star, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import StatCard from "@/components/dashboard/StatCard";

export default function Customers() {
  const [search, setSearch] = useState("");

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => apiClient.entities.Booking.list("-created_date", 1000),
  });

  const customers = useMemo(() => {
    const map = {};
    bookings.forEach((b) => {
      const key = b.customer_phone;
      if (!key) return;
      if (!map[key]) {
        map[key] = {
          name: b.customer_name,
          phone: key,
          email: b.customer_email,
          bookings: 0,
          totalSpent: 0,
          lastBooking: b.date,
        };
      }
      map[key].bookings++;
      map[key].totalSpent += b.total_price || 0;
      if (b.date > (map[key].lastBooking || "")) map[key].lastBooking = b.date;
      if (b.customer_name && !map[key].name) map[key].name = b.customer_name;
    });
    return Object.values(map).sort((a, b) => b.bookings - a.bookings);
  }, [bookings]);

  const filtered = customers.filter(
    (c) =>
      !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search)
  );

  const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);
  const avgBookings = customers.length ? (bookings.length / customers.length).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="text-sm text-gray-400 mt-0.5">Your customer database from bookings</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Customers" value={customers.length} icon={Users} color="violet" />
        <StatCard title="Avg. Bookings/Customer" value={avgBookings} icon={Calendar} color="blue" />
        <StatCard title="Total Revenue" value={`৳${totalRevenue.toLocaleString()}`} icon={Star} color="emerald" />
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {["Customer", "Phone", "Bookings", "Total Spent", "Last Booking", "Tier"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-400">No customers found</td></tr>
                )}
                {filtered.map((c) => {
                  const tier = c.bookings >= 10 ? "VIP" : c.bookings >= 5 ? "Regular" : "New";
                  const tierColor = tier === "VIP" ? "bg-amber-50 text-amber-700" : tier === "Regular" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500";
                  return (
                    <tr key={c.phone} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                            <span className="text-xs font-semibold text-emerald-600">{c.name?.[0]?.toUpperCase() || "?"}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{c.name || "Unknown"}</p>
                            {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.phone}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{c.bookings}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-800">৳{c.totalSpent.toLocaleString()}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{c.lastBooking || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] ${tierColor}`}>{tier}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
