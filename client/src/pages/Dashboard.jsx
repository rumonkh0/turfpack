import React from "react";
import { apiClient } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { Calendar, CreditCard, MapPin, Users, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import StatCard from "@/components/dashboard/StatCard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import BookingHeatmap from "@/components/dashboard/BookingHeatmap";
import RecentBookings from "@/components/dashboard/RecentBookings";

export default function Dashboard() {
  const { data: bookings = [], isLoading: lb } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => apiClient.entities.Booking.list("-created_date", 200),
  });
  const { data: payments = [], isLoading: lp } = useQuery({
    queryKey: ["payments"],
    queryFn: () => apiClient.entities.Payment.list("-created_date", 200),
  });
  const { data: turfs = [], isLoading: lt } = useQuery({
    queryKey: ["turfs"],
    queryFn: () => apiClient.entities.Turf.list(),
  });

  const isLoading = lb || lp || lt;

  const today = new Date().toISOString().split("T")[0];
  const todayBookings = bookings.filter((b) => b.date === today);
  const totalRevenue = payments
    .filter((p) => p.status === "completed")
    .reduce((s, p) => s + (p.amount || 0), 0);
  const uniqueCustomers = new Set(bookings.map((b) => b.customer_phone)).size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-0.5">Overview of your turf business</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Today's Bookings"
            value={todayBookings.length}
            subtitle={`${bookings.length} total`}
            icon={Calendar}
            color="emerald"
          />
          <StatCard
            title="Total Revenue"
            value={`৳${totalRevenue.toLocaleString()}`}
            subtitle={`${payments.filter((p) => p.status === "completed").length} payments`}
            icon={CreditCard}
            color="blue"
          />
          <StatCard
            title="Active Turfs"
            value={turfs.filter((t) => t.status === "active").length}
            subtitle={`${turfs.length} total`}
            icon={MapPin}
            color="amber"
          />
          <StatCard
            title="Customers"
            value={uniqueCustomers}
            subtitle="unique customers"
            icon={Users}
            color="violet"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RevenueChart payments={payments} />
        <BookingHeatmap bookings={bookings} />
      </div>

      <RecentBookings bookings={bookings} />
    </div>
  );
}
