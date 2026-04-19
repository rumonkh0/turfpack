import React, { useState } from "react";
import { apiClient } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react";
import { format, addDays, subDays } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import BookingFormDialog from "@/components/bookings/BookingFormDialog";
import BookingCalendar from "@/components/bookings/BookingCalendar";

const statusColors = {
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
  no_show: "bg-gray-100 text-gray-600 border-gray-200",
};

const payColors = {
  paid: "bg-emerald-50 text-emerald-700",
  unpaid: "bg-red-50 text-red-700",
  partial: "bg-amber-50 text-amber-700",
  refunded: "bg-gray-100 text-gray-600",
};

export default function Bookings() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editBooking, setEditBooking] = useState(null);
  const [view, setView] = useState("list");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: bookings = [], isLoading: lb } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => apiClient.entities.Booking.list("-created_date", 500),
  });
  const { data: turfs = [] } = useQuery({
    queryKey: ["turfs"],
    queryFn: () => apiClient.entities.Turf.list(),
  });

  const filtered = bookings.filter((b) => {
    const matchSearch = !search || 
      b.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.customer_phone?.includes(search) ||
      b.turf_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || b.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-sm text-gray-400 mt-0.5">{bookings.length} total bookings</p>
        </div>
        <Button onClick={() => { setEditBooking(null); setShowForm(true); }} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" /> New Booking
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search bookings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <Tabs value={filterStatus} onValueChange={setFilterStatus}>
            <TabsList className="bg-gray-100">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="confirmed" className="text-xs">Confirmed</TabsTrigger>
              <TabsTrigger value="pending" className="text-xs">Pending</TabsTrigger>
              <TabsTrigger value="completed" className="text-xs">Completed</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("list")}
            className={view === "list" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant={view === "calendar" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("calendar")}
            className={view === "calendar" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {view === "calendar" && (
        <div className="flex items-center gap-3 mb-2">
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(subDays(selectedDate, 7))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-gray-700">
            Week of {format(selectedDate, "MMM d, yyyy")}
          </span>
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(addDays(selectedDate, 7))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())}>Today</Button>
        </div>
      )}

      {lb ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : view === "calendar" ? (
        <BookingCalendar
          bookings={filtered}
          turfs={turfs}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
        />
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {["Customer", "Turf", "Date & Time", "Price", "Status", "Payment"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-400">No bookings found</td></tr>
                )}
                {filtered.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-gray-50/50 cursor-pointer transition-colors"
                    onClick={() => { setEditBooking(b); setShowForm(true); }}
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-800">{b.customer_name}</p>
                      <p className="text-xs text-gray-400">{b.customer_phone}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{b.turf_name}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-700">{b.date ? format(new Date(b.date), "MMM d, yyyy") : ""}</p>
                      <p className="text-xs text-gray-400">{b.start_hour}:00 – {b.end_hour}:00</p>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">৳{b.total_price?.toLocaleString() || 0}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`text-[10px] ${statusColors[b.status] || ""}`}>{b.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-[10px] ${payColors[b.payment_status] || ""}`}>{b.payment_status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <BookingFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        turfs={turfs}
        existingBookings={bookings}
        booking={editBooking}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["bookings"] })}
      />
    </div>
  );
}
