import React from "react";
import { apiClient } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { Calendar, CreditCard, MapPin, Users, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import StatCard from "@/components/dashboard/StatCard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import BookingHeatmap from "@/components/dashboard/BookingHeatmap";
import RecentBookings from "@/components/dashboard/RecentBookings";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: dashboard, isLoading: ld } = useQuery({
    queryKey: ["dashboard_stats"],
    queryFn: () => apiClient.entities.Report.dashboard({ period: "monthly" }),
  });

  const { data: bookings = [], isLoading: lb } = useQuery({
    queryKey: ["bookings", "dashboard"],
    queryFn: () => apiClient.entities.Booking.list("-created_at", 300),
  });

  const { data: payments = [], isLoading: lp } = useQuery({
    queryKey: ["payments", "dashboard"],
    queryFn: () => apiClient.entities.Payment.list("-created_at", 300),
  });

  const { data: turfs = [], isLoading: lt } = useQuery({
    queryKey: ["turfs"],
    queryFn: () => apiClient.entities.Turf.list(),
  });

  const isLoading = ld || lb || lp || lt;

  const formatCurrency = (amountInPoisha) => {
    return `৳${((amountInPoisha || 0) / 100).toLocaleString("en-US", {
      minimumFractionDigits: 0,
    })}`;
  };

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
            title="Net Profit (Monthly)"
            value={formatCurrency(dashboard?.net_profit)}
            subtitle="Current month"
            icon={TrendingUp}
            color="emerald"
            onClick={() => navigate("/reports", { state: { tab: "pnl" } })}
          />
          <StatCard
            title="Total Revenue (Monthly)"
            value={formatCurrency(dashboard?.total_revenue)}
            subtitle="Current month"
            icon={CreditCard}
            color="blue"
            onClick={() => navigate("/reports", { state: { tab: "pnl" } })}
          />
          <StatCard
            title="Total Cash on Hand"
            value={formatCurrency(dashboard?.total_cash)}
            subtitle="Across all accounts"
            icon={Calendar}
            color="amber"
            onClick={() => navigate("/reports", { state: { tab: "cash" } })}
          />
          <StatCard
            title="Outstanding Receivables"
            value={formatCurrency(dashboard?.total_receivables)}
            subtitle="Unpaid bookings"
            icon={Users}
            color="violet"
            onClick={() => navigate("/reports", { state: { tab: "receivables" } })}
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
