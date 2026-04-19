import React, { useState } from "react";
import { apiClient } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Search, Plus, Loader2, CreditCard, Banknote, Smartphone } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import StatCard from "@/components/dashboard/StatCard";

const statusColors = {
  completed: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-700",
  refunded: "bg-gray-100 text-gray-600",
};

const methodIcons = {
  bkash: "🟪", nagad: "🟧", rocket: "🟣", cash: "💵", card: "💳", other: "📱",
};

export default function Payments() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    booking_id: "", amount: 0, method: "bkash", status: "completed",
    transaction_id: "", customer_name: "", customer_phone: "", notes: "",
  });

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: () => apiClient.entities.Payment.list("-created_date", 500),
  });
  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => apiClient.entities.Booking.list("-created_date", 500),
  });

  const totalCompleted = payments.filter((p) => p.status === "completed").reduce((s, p) => s + (p.amount || 0), 0);
  const totalPending = payments.filter((p) => p.status === "pending").reduce((s, p) => s + (p.amount || 0), 0);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    await apiClient.entities.Payment.create(form);
    if (form.booking_id && form.status === "completed") {
      await apiClient.entities.Booking.update(form.booking_id, { payment_status: "paid", payment_method: form.method });
    }
    setSaving(false);
    setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ["payments"] });
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
  };

  const filtered = payments.filter((p) => {
    const matchSearch = !search ||
      p.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.transaction_id?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-400 mt-0.5">{payments.length} transactions</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" /> Record Payment
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Collected" value={`৳${totalCompleted.toLocaleString()}`} icon={CreditCard} color="emerald" />
        <StatCard title="Pending" value={`৳${totalPending.toLocaleString()}`} icon={Banknote} color="amber" />
        <StatCard title="Transactions" value={payments.length} icon={Smartphone} color="blue" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search payments..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-64" />
        </div>
        <Tabs value={filterStatus} onValueChange={setFilterStatus}>
          <TabsList className="bg-gray-100">
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="completed" className="text-xs">Completed</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs">Pending</TabsTrigger>
            <TabsTrigger value="refunded" className="text-xs">Refunded</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : (
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {["Customer", "Amount", "Method", "Transaction ID", "Status", "Date"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-400">No payments found</td></tr>
                )}
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-800">{p.customer_name || "—"}</p>
                      <p className="text-xs text-gray-400">{p.customer_phone}</p>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">৳{p.amount?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {methodIcons[p.method] || ""} {p.method}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{p.transaction_id || "—"}</td>
                    <td className="px-4 py-3">
                      <Badge className={`text-[10px] ${statusColors[p.status] || ""}`}>{p.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {p.created_date ? format(new Date(p.created_date), "MMM d, HH:mm") : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Booking</Label>
              <Select value={form.booking_id} onValueChange={(v) => {
                const bk = bookings.find((b) => b.id === v);
                set("booking_id", v);
                if (bk) {
                  set("amount", bk.total_price || 0);
                  set("customer_name", bk.customer_name);
                  set("customer_phone", bk.customer_phone);
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Select booking" /></SelectTrigger>
                <SelectContent>
                  {bookings.filter((b) => b.payment_status !== "paid").map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.customer_name} – {b.date} {b.start_hour}:00 (৳{b.total_price})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Amount (BDT)</Label>
                <Input type="number" value={form.amount} onChange={(e) => set("amount", Number(e.target.value))} />
              </div>
              <div>
                <Label>Method</Label>
                <Select value={form.method} onValueChange={(v) => set("method", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["bkash", "nagad", "rocket", "cash", "card", "other"].map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Transaction ID</Label>
              <Input value={form.transaction_id} onChange={(e) => set("transaction_id", e.target.value)} placeholder="e.g. TRX12345" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.amount} className="bg-emerald-600 hover:bg-emerald-700">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
