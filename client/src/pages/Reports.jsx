import React, { useState } from "react";
import { apiClient } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { useLocation } from "react-router-dom";

export default function Reports() {
  const location = useLocation();
  const [period, setPeriod] = useState("monthly");
  const [activeTab, setActiveTab] = useState(location.state?.tab || "pnl");

  const { data: pnl, isLoading: pnlLoading } = useQuery({
    queryKey: ["reports", "profit-loss", period],
    queryFn: () => apiClient.entities.Report.profitLoss({ period }),
  });

  const { data: cash, isLoading: cashLoading } = useQuery({
    queryKey: ["reports", "cash-position"],
    queryFn: () => apiClient.entities.Report.cashPosition(),
  });

  const { data: receivables, isLoading: recLoading } = useQuery({
    queryKey: ["reports", "receivables"],
    queryFn: () => apiClient.entities.Report.receivables(),
  });

  const { data: partnerShares, isLoading: sharesLoading } = useQuery({
    queryKey: ["reports", "partner-shares", period],
    queryFn: () => apiClient.entities.Report.partnerShares({ period }),
  });

  const formatCurrency = (amountInPoisha) => {
    return `৳${((amountInPoisha || 0) / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
    })}`;
  };

  const renderBreakdownTable = (title, items, total) => (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">{title} Breakdown</h3>
        <span className="font-bold text-gray-900">{formatCurrency(total)}</span>
      </div>
      <table className="w-full text-sm text-left">
        <thead className="bg-white border-b border-gray-100 text-gray-500 font-medium">
          <tr>
            <th className="px-6 py-3">Account</th>
            <th className="px-6 py-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items?.length === 0 ? (
            <tr>
              <td colSpan="2" className="px-6 py-8 text-center text-gray-400">No data available.</td>
            </tr>
          ) : (
            items?.map((item) => (
              <tr key={item.account_code} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-gray-700">
                  <span className="text-gray-400 mr-2 text-xs font-mono">{item.account_code}</span>
                  {item.name}
                </td>
                <td className="px-6 py-3 text-right font-medium text-gray-900">
                  {formatCurrency(item.amount || item.balance)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
          <p className="text-sm text-gray-400 mt-0.5">Comprehensive accounting statements</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="bg-white border border-gray-200 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <TabsList className="bg-white border border-gray-200 p-1 rounded-lg">
          <TabsTrigger value="pnl" className="rounded-md px-4 py-2 text-sm font-medium data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 transition-all">Profit & Loss</TabsTrigger>
          <TabsTrigger value="cash" className="rounded-md px-4 py-2 text-sm font-medium data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 transition-all">Cash Position</TabsTrigger>
          <TabsTrigger value="receivables" className="rounded-md px-4 py-2 text-sm font-medium data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 transition-all">Receivables</TabsTrigger>
          <TabsTrigger value="shares" className="rounded-md px-4 py-2 text-sm font-medium data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 transition-all">Partner Shares</TabsTrigger>
        </TabsList>

        {/* PROFIT & LOSS TAB */}
        <TabsContent value="pnl" className="space-y-6 outline-none">
          {pnlLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </div>
          ) : pnl ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm transition-transform hover:-translate-y-1">
                  <h3 className="text-gray-500 text-sm font-medium">Total Income</h3>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(pnl.revenue.total)}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm transition-transform hover:-translate-y-1">
                  <h3 className="text-gray-500 text-sm font-medium">Total Expenses</h3>
                  <p className="text-3xl font-bold text-red-600 mt-2">{formatCurrency(pnl.expenses.total)}</p>
                </div>
                <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-100 shadow-sm transition-transform hover:-translate-y-1">
                  <h3 className="text-emerald-700 text-sm font-medium">Net Profit</h3>
                  <p className="text-3xl font-bold text-emerald-700 mt-2">{formatCurrency(pnl.net_profit)}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {renderBreakdownTable("Revenue", pnl.revenue.breakdown, pnl.revenue.total)}
                {renderBreakdownTable("Expenses", pnl.expenses.breakdown, pnl.expenses.total)}
              </div>
            </>
          ) : (
            <div className="bg-white p-12 text-center rounded-xl border border-gray-200">
              <p className="text-gray-500">Could not load P&L data.</p>
            </div>
          )}
        </TabsContent>

        {/* CASH POSITION TAB */}
        <TabsContent value="cash" className="space-y-6 outline-none">
          {cashLoading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : cash ? (
            <div className="max-w-3xl">
              <div className="mb-6 bg-blue-50 p-6 rounded-xl border border-blue-100">
                <h3 className="text-blue-800 text-sm font-medium mb-1">Total Liquidity (As of {format(new Date(cash.as_of), "MMMM d, yyyy")})</h3>
                <p className="text-3xl font-bold text-blue-900">{formatCurrency(cash.total)}</p>
              </div>
              {renderBreakdownTable("Cash & Bank Accounts", cash.accounts, cash.total)}
            </div>
          ) : (
            <div className="bg-white p-12 text-center rounded-xl border border-gray-200">
              <p className="text-gray-500">Could not load cash position.</p>
            </div>
          )}
        </TabsContent>

        {/* RECEIVABLES TAB */}
        <TabsContent value="receivables" className="space-y-6 outline-none">
          {recLoading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : receivables ? (
            <div className="max-w-4xl">
              <div className="mb-6 bg-amber-50 p-6 rounded-xl border border-amber-100">
                <h3 className="text-amber-800 text-sm font-medium mb-1">Total Outstanding (As of {format(new Date(receivables.as_of), "MMMM d, yyyy")})</h3>
                <p className="text-3xl font-bold text-amber-900">{formatCurrency(receivables.total_outstanding)}</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <h3 className="font-semibold text-gray-900">Unpaid Bookings</h3>
                </div>
                <table className="w-full text-sm text-left">
                  <thead className="bg-white border-b border-gray-100 text-gray-500 font-medium">
                    <tr>
                      <th className="px-6 py-3">Customer</th>
                      <th className="px-6 py-3 text-right">Total Price</th>
                      <th className="px-6 py-3 text-right">Paid</th>
                      <th className="px-6 py-3 text-right">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {receivables.bookings?.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-6 py-8 text-center text-gray-400">No outstanding receivables.</td>
                      </tr>
                    ) : (
                      receivables.bookings?.map((b) => (
                        <tr key={b.booking_id} className="hover:bg-gray-50">
                          <td className="px-6 py-3 font-medium text-gray-900">{b.customer_name}</td>
                          <td className="px-6 py-3 text-right text-gray-500">{formatCurrency(b.total_price)}</td>
                          <td className="px-6 py-3 text-right text-gray-500">{formatCurrency(b.paid)}</td>
                          <td className="px-6 py-3 text-right font-medium text-amber-600">{formatCurrency(b.outstanding)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 text-center rounded-xl border border-gray-200">
              <p className="text-gray-500">Could not load receivables.</p>
            </div>
          )}
        </TabsContent>

        {/* PARTNER SHARES TAB */}
        <TabsContent value="shares" className="space-y-6 outline-none">
          {sharesLoading ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : partnerShares ? (
            <div className="max-w-4xl">
              <div className="mb-6 bg-emerald-50 p-6 rounded-xl border border-emerald-100 flex justify-between items-center">
                <div>
                  <h3 className="text-emerald-800 text-sm font-medium mb-1">Distributable Net Profit</h3>
                  <p className="text-3xl font-bold text-emerald-900">{formatCurrency(partnerShares.net_profit)}</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <h3 className="font-semibold text-gray-900">Partner Distributions</h3>
                </div>
                <table className="w-full text-sm text-left">
                  <thead className="bg-white border-b border-gray-100 text-gray-500 font-medium">
                    <tr>
                      <th className="px-6 py-3">Partner</th>
                      <th className="px-6 py-3">Share (%)</th>
                      <th className="px-6 py-3 text-right">Gross Share</th>
                      <th className="px-6 py-3 text-right">Already Paid</th>
                      <th className="px-6 py-3 text-right">Owed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {partnerShares.shares?.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-8 text-center text-gray-400">No partner shares calculated.</td>
                      </tr>
                    ) : (
                      partnerShares.shares?.map((s) => (
                        <tr key={s.user_id} className="hover:bg-gray-50">
                          <td className="px-6 py-3 font-medium text-gray-900">{s.full_name}</td>
                          <td className="px-6 py-3 text-emerald-600 font-medium">{s.effective_pct.toFixed(2)}%</td>
                          <td className="px-6 py-3 text-right text-gray-900">{formatCurrency(s.gross_share)}</td>
                          <td className="px-6 py-3 text-right text-gray-500">{formatCurrency(s.paid_out)}</td>
                          <td className="px-6 py-3 text-right font-medium text-amber-600">{formatCurrency(s.outstanding)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 text-center rounded-xl border border-gray-200">
              <p className="text-gray-500">Could not load partner shares.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
