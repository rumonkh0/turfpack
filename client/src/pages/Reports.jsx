import React, { useState } from "react";
import { apiClient } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

export default function Reports() {
  const [period, setPeriod] = useState("monthly");

  const { data: report, isLoading } = useQuery({
    queryKey: ["reports", "profit-loss", period],
    queryFn: () => apiClient.entities.Report.profitLoss({ period }),
  });

  const formatCurrency = (amountInPoisha) => {
    return `৳${((amountInPoisha || 0) / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Financial Profit & Loss Statement
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="bg-white border border-gray-200 text-sm rounded-lg px-3 py-2"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      ) : report ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-gray-500 text-sm font-medium">Total Income</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {formatCurrency(report.total_income)}
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-gray-500 text-sm font-medium">Total Expenses</h3>
            <p className="text-3xl font-bold text-red-600 mt-2">
              {formatCurrency(report.total_expense)}
            </p>
          </div>
          <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-100 shadow-sm">
            <h3 className="text-emerald-700 text-sm font-medium">Net Profit</h3>
            <p className="text-3xl font-bold text-emerald-700 mt-2">
              {formatCurrency(report.net_profit)}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 text-center rounded-xl border border-gray-200">
          <p className="text-gray-500">Could not load report data.</p>
        </div>
      )}

      {/* Additional details could go here, e.g. breakdown by account */}
    </div>
  );
}
