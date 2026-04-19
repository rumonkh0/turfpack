import React, { useState } from "react";
import { apiClient } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, ShoppingCart, AlertTriangle, TrendingUp, Printer, LayoutDashboard } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";
import SalesPOS from "@/components/products/SalesPOS";

function StatCard({ title, value, subtitle, icon: Icon, color }) {
  const colors = {
    violet: { bg: "bg-violet-50", icon: "text-violet-600" },
    blue: { bg: "bg-blue-50", icon: "text-blue-600" },
    amber: { bg: "bg-amber-50", icon: "text-amber-600" },
    rose: { bg: "bg-rose-50", icon: "text-rose-600" },
  };
  const c = colors[color] || colors.violet;
  return (
    <Card className="p-5 border-0 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
      </div>
    </Card>
  );
}

export default function ProductsDashboard() {
  const [tab, setTab] = useState("dashboard"); // "dashboard" | "pos"

  const { data: products = [], isLoading: lp } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiClient.entities.Product.list("-created_date", 500),
  });
  const { data: orders = [], isLoading: lo } = useQuery({
    queryKey: ["orders"],
    queryFn: () => apiClient.entities.Order.list("-created_date", 500),
  });

  const isLoading = lp || lo;

  const totalRevenue = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((s, o) => s + (o.total_amount || 0), 0);

  const lowStockProducts = products.filter(
    (p) => p.stock !== undefined && p.low_stock_alert !== undefined && p.stock <= p.low_stock_alert && p.status !== "inactive"
  );

  const todayStr = new Date().toISOString().split("T")[0];
  const todayOrders = orders.filter((o) => o.created_date?.startsWith(todayStr));

  // Last 7 days sales chart
  const salesData = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    const ds = d.toISOString().split("T")[0];
    const dayOrders = orders.filter((o) => o.created_date?.startsWith(ds) && o.status !== "cancelled");
    return {
      date: format(d, "EEE"),
      revenue: dayOrders.reduce((s, o) => s + (o.total_amount || 0), 0),
      orders: dayOrders.length,
    };
  });

  // Top products by quantity sold
  const productSales = {};
  orders.filter((o) => o.status !== "cancelled").forEach((o) => {
    (o.items || []).forEach((item) => {
      productSales[item.product_name] = (productSales[item.product_name] || 0) + (item.quantity || 0);
    });
  });
  const topProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    const printDate = format(new Date(), "dd MMM yyyy, hh:mm a");

    const todayRevenue = salesData[salesData.length - 1]?.revenue || 0;
    const activeProducts = products.filter((p) => p.status === "active");

    const lowStockRows = lowStockProducts.map((p) =>
      `<tr><td>${p.name}</td><td>${p.category}</td><td style="color:#d97706;font-weight:600">${p.stock} ${p.unit}</td><td>${p.low_stock_alert}</td></tr>`
    ).join("");

    const topProductRows = topProducts.map(([name, qty], i) =>
      `<tr><td>${i + 1}</td><td>${name}</td><td>${qty}</td></tr>`
    ).join("");

    const recentOrders = orders.slice(0, 10);
    const orderRows = recentOrders.map((o) =>
      `<tr>
        <td>${o.customer_name || "Walk-in"}</td>
        <td>${o.items?.length || 0} item(s)</td>
        <td>৳${(o.total_amount || 0).toLocaleString()}</td>
        <td>${o.payment_method || ""}</td>
        <td><span class="badge ${o.status}">${o.status}</span></td>
        <td>${o.created_date ? format(new Date(o.created_date), "dd MMM, HH:mm") : ""}</td>
      </tr>`
    ).join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Products Dashboard Report</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; background: #fff; padding: 32px; font-size: 13px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #7c3aed; }
          .brand { display: flex; align-items: center; gap: 12px; }
          .brand-icon { width: 44px; height: 44px; background: #7c3aed; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 16px; }
          .brand-name { font-size: 20px; font-weight: 700; color: #111; }
          .brand-sub { font-size: 11px; color: #9ca3af; margin-top: 1px; }
          .report-meta { text-align: right; font-size: 11px; color: #6b7280; }
          .report-title { font-size: 22px; font-weight: 700; color: #7c3aed; }
          .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 28px; }
          .stat { background: #f5f3ff; border-radius: 12px; padding: 16px; }
          .stat-label { font-size: 10px; text-transform: uppercase; color: #7c3aed; font-weight: 600; letter-spacing: 0.05em; }
          .stat-value { font-size: 24px; font-weight: 700; color: #111; margin: 4px 0; }
          .stat-sub { font-size: 10px; color: #9ca3af; }
          section { margin-bottom: 28px; }
          h2 { font-size: 14px; font-weight: 700; color: #374151; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f9fafb; text-align: left; padding: 8px 12px; font-size: 10px; font-weight: 600; text-transform: uppercase; color: #9ca3af; border-bottom: 1px solid #e5e7eb; }
          td { padding: 8px 12px; font-size: 12px; border-bottom: 1px solid #f3f4f6; color: #374151; }
          tr:last-child td { border-bottom: none; }
          .badge { padding: 2px 8px; border-radius: 99px; font-size: 10px; font-weight: 600; }
          .badge.confirmed { background: #d1fae5; color: #065f46; }
          .badge.pending { background: #fef3c7; color: #92400e; }
          .badge.delivered { background: #dbeafe; color: #1e40af; }
          .badge.cancelled { background: #fee2e2; color: #991b1b; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 10px; color: #9ca3af; }
          @media print { body { padding: 16px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">
            <div class="brand-icon">PS</div>
            <div>
              <div class="brand-name">ProductStore</div>
              <div class="brand-sub">Management Platform</div>
            </div>
          </div>
          <div class="report-meta">
            <div class="report-title">Dashboard Report</div>
            <div style="margin-top:4px">Generated: ${printDate}</div>
          </div>
        </div>

        <div class="stats">
          <div class="stat">
            <div class="stat-label">Active Products</div>
            <div class="stat-value">${activeProducts.length}</div>
            <div class="stat-sub">${products.length} total</div>
          </div>
          <div class="stat">
            <div class="stat-label">Total Orders</div>
            <div class="stat-value">${orders.length}</div>
            <div class="stat-sub">Today: ${todayOrders.length}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Total Revenue</div>
            <div class="stat-value">৳${totalRevenue.toLocaleString()}</div>
            <div class="stat-sub">Today: ৳${todayRevenue.toLocaleString()}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Low Stock Items</div>
            <div class="stat-value">${lowStockProducts.length}</div>
            <div class="stat-sub">need restocking</div>
          </div>
        </div>

        ${topProducts.length > 0 ? `
        <section>
          <h2>Top Selling Products</h2>
          <table>
            <thead><tr><th>#</th><th>Product</th><th>Qty Sold</th></tr></thead>
            <tbody>${topProductRows}</tbody>
          </table>
        </section>` : ""}

        <section>
          <h2>Recent Orders (Last 10)</h2>
          ${recentOrders.length === 0
            ? `<p style="color:#9ca3af;font-size:12px;padding:16px 0">No orders yet.</p>`
            : `<table>
                <thead><tr><th>Customer</th><th>Items</th><th>Total</th><th>Method</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>${orderRows}</tbody>
              </table>`
          }
        </section>

        ${lowStockProducts.length > 0 ? `
        <section>
          <h2>Low Stock Alerts</h2>
          <table>
            <thead><tr><th>Product</th><th>Category</th><th>Stock</th><th>Alert Level</th></tr></thead>
            <tbody>${lowStockRows}</tbody>
          </table>
        </section>` : ""}

        <div class="footer">TurfSlot · ProductStore Management Platform · ${printDate}</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Overview of your products & sales</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setTab("dashboard")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${tab === "dashboard" ? "bg-white text-violet-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" /> Overview
            </button>
            <button
              onClick={() => setTab("pos")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${tab === "pos" ? "bg-white text-violet-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <ShoppingCart className="w-3.5 h-3.5" /> Sell / POS
            </button>
          </div>
          {tab === "dashboard" && (
            <Button onClick={handlePrint} variant="outline" className="gap-2 border-violet-200 text-violet-700 hover:bg-violet-50">
              <Printer className="w-4 h-4" /> Print Report
            </Button>
          )}
        </div>
      </div>

      {tab === "pos" && <SalesPOS products={products} />}

      {tab === "dashboard" && (
        <>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total Products" value={products.filter(p => p.status === "active").length} subtitle={`${products.length} total`} icon={Package} color="violet" />
              <StatCard title="Today's Orders" value={todayOrders.length} subtitle={`${orders.length} total`} icon={ShoppingCart} color="blue" />
              <StatCard title="Total Revenue" value={`৳${totalRevenue.toLocaleString()}`} subtitle="all time" icon={TrendingUp} color="amber" />
              <StatCard title="Low Stock" value={lowStockProducts.length} subtitle="need restocking" icon={AlertTriangle} color="rose" />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2 p-5 border-0 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Revenue (Last 7 Days)</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesData}>
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} formatter={(v) => [`৳${v.toLocaleString()}`, "Revenue"]} />
                    <Area type="monotone" dataKey="revenue" stroke="#7c3aed" strokeWidth={2} fill="url(#salesGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5 border-0 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Top Products</h3>
              {topProducts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No sales yet</p>
              ) : (
                <div className="space-y-3">
                  {topProducts.map(([name, qty], i) => (
                    <div key={name} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-violet-50 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-violet-600">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{name}</p>
                      </div>
                      <span className="text-sm font-semibold text-gray-600">{qty} sold</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {lowStockProducts.length > 0 && (
            <Card className="border-0 shadow-sm">
              <div className="p-5 border-b border-gray-50 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-gray-800">Low Stock Alerts</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {lowStockProducts.map((p) => (
                  <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.category}</p>
                    </div>
                    <Badge className="bg-amber-50 text-amber-700 text-[10px]">
                      {p.stock} {p.unit} left
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
