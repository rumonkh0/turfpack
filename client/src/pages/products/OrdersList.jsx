import React, { useState } from "react";
import { apiClient } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, ShoppingCart, Printer } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import NewOrderDialog from "@/components/products/NewOrderDialog";
import { printInvoice } from "@/components/products/SalesPOS";

const statusColors = {
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-emerald-50 text-emerald-700",
  delivered: "bg-blue-50 text-blue-700",
  cancelled: "bg-red-50 text-red-700",
};

const payColors = {
  paid: "bg-emerald-50 text-emerald-700",
  unpaid: "bg-red-50 text-red-700",
  partial: "bg-amber-50 text-amber-700",
};

const methodIcons = {
  bkash: "🟪", nagad: "🟧", rocket: "🟣", cash: "💵", card: "💳", other: "📱",
};

export default function OrdersList() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => apiClient.entities.Order.list("-created_date", 500),
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiClient.entities.Product.list("-created_date"),
  });

  const updateOrderStatus = async (order, newStatus) => {
    const oldStatus = order.status;
    if (oldStatus === newStatus) return;

    try {
      await apiClient.entities.Order.update(order.id, { status: newStatus });

      if (oldStatus !== "cancelled" && newStatus === "cancelled") {
        for (const item of order.items || []) {
          const product = products.find((p) => p.id === item.product_id);
          if (product) {
            await apiClient.entities.Product.update(item.product_id, {
              stock: (product.stock || 0) + item.quantity,
            });
          }
        }
      } else if (oldStatus === "cancelled" && newStatus !== "cancelled") {
        for (const item of order.items || []) {
          const product = products.find((p) => p.id === item.product_id);
          if (product) {
            await apiClient.entities.Product.update(item.product_id, {
              stock: Math.max(0, (product.stock || 0) - item.quantity),
            });
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (err) {
      console.error("[OrdersList] Error updating order status:", err);
    }
  };

  const updateOrderPaymentStatus = async (order, newPaymentStatus) => {
    try {
      await apiClient.entities.Order.update(order.id, { payment_status: newPaymentStatus });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (err) {
      console.error("[OrdersList] Error updating payment status:", err);
    }
  };

  const filtered = orders.filter((o) => {
    const matchSearch = !search || o.customer_name?.toLowerCase().includes(search.toLowerCase()) || o.customer_phone?.includes(search);
    const matchStatus = filterStatus === "all" || o.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-400 mt-0.5">{orders.length} total orders</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-violet-600 hover:bg-violet-700">
          <Plus className="w-4 h-4 mr-2" /> New Order
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-64" />
        </div>
        <Tabs value={filterStatus} onValueChange={setFilterStatus}>
          <TabsList className="bg-gray-100">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="confirmed" className="text-xs">Confirmed</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs">Pending</TabsTrigger>
            <TabsTrigger value="delivered" className="text-xs">Delivered</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingCart className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">No orders yet. Create your first order.</p>
        </div>
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {["Customer", "Items", "Total", "Method", "Status", "Payment", "Date", ""].map((h, idx) => (
                    <th key={idx} className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-800">{o.customer_name || "Walk-in"}</p>
                      {o.customer_phone && <p className="text-xs text-gray-400">{o.customer_phone}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600">{o.items?.length || 0} item(s)</p>
                      <p className="text-xs text-gray-400 truncate max-w-[120px]">
                        {o.items?.map((i) => i.product_name).join(", ")}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">৳{o.total_amount?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{methodIcons[o.payment_method] || ""} {o.payment_method}</td>
                    <td className="px-4 py-3">
                      <select
                        value={o.status}
                        onChange={(e) => updateOrderStatus(o, e.target.value)}
                        className={`text-[10px] font-semibold rounded-md border px-2 py-0.5 capitalize cursor-pointer focus:outline-none focus:ring-1 focus:ring-violet-500 shadow-sm border-transparent transition-all select-none ${statusColors[o.status] || ""}`}
                      >
                        <option value="pending" className="bg-white text-gray-800">Pending</option>
                        <option value="confirmed" className="bg-white text-gray-800">Confirmed</option>
                        <option value="delivered" className="bg-white text-gray-800">Delivered</option>
                        <option value="cancelled" className="bg-white text-gray-800">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={o.payment_status}
                        onChange={(e) => updateOrderPaymentStatus(o, e.target.value)}
                        className={`text-[10px] font-semibold rounded-md border px-2 py-0.5 capitalize cursor-pointer focus:outline-none focus:ring-1 focus:ring-violet-500 shadow-sm border-transparent transition-all select-none ${payColors[o.payment_status] || ""}`}
                      >
                        <option value="paid" className="bg-white text-gray-800">Paid</option>
                        <option value="unpaid" className="bg-white text-gray-800">Unpaid</option>
                        <option value="partial" className="bg-white text-gray-800">Partial</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {o.created_date ? format(new Date(o.created_date), "MMM d, HH:mm") : ""}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                        onClick={() => {
                          const invoiceNo = o.id ? `INV-${o.id.toString().slice(-6)}` : `INV-${new Date(o.created_date).getTime().toString().slice(-6)}`;
                          const date = o.created_date ? format(new Date(o.created_date), "dd MMM yyyy, hh:mm a") : "";
                          printInvoice({
                            items: o.items || [],
                            customer: {
                              name: o.customer_name,
                              phone: o.customer_phone,
                              address: ""
                            },
                            employee: o.notes?.replace("Served by: ", "") || "Admin",
                            paymentMethod: o.payment_method,
                            total: o.total_amount,
                            invoiceNo,
                            date,
                            status: o.status,
                            paymentStatus: o.payment_status
                          });
                        }}
                      >
                        <Printer className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <NewOrderDialog
        open={showForm}
        onOpenChange={setShowForm}
        products={products}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["orders"] });
          queryClient.invalidateQueries({ queryKey: ["products"] });
        }}
      />
    </div>
  );
}
