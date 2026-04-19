import React, { useState, useMemo } from "react";
import { apiClient } from "@/api/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Minus, Trash2, Printer, ShoppingCart, Package, User, Phone, Users } from "lucide-react";
import { format } from "date-fns";

const EMPLOYEES = ["Employee 1", "Employee 2", "Employee 3"];
const PAYMENT_METHODS = ["cash", "bkash", "nagad", "rocket", "card", "other"];
const categoryColors = {
  food: "bg-orange-50 text-orange-700 border-orange-100",
  beverage: "bg-blue-50 text-blue-700 border-blue-100",
  clothing: "bg-pink-50 text-pink-700 border-pink-100",
  medicine: "bg-red-50 text-red-700 border-red-100",
  equipment: "bg-gray-100 text-gray-600 border-gray-200",
  accessories: "bg-purple-50 text-purple-700 border-purple-100",
  other: "bg-gray-100 text-gray-500 border-gray-200",
};

function printInvoice({ items, customer, employee, paymentMethod, total, invoiceNo, date }) {
  const w = window.open("", "_blank");
  const rows = items.map((i) =>
    `<tr>
      <td>${i.product_name}</td>
      <td style="text-align:center">${i.quantity}</td>
      <td style="text-align:right">৳${i.unit_price.toLocaleString()}</td>
      <td style="text-align:right">৳${i.subtotal.toLocaleString()}</td>
    </tr>`
  ).join("");

  w.document.write(`<!DOCTYPE html><html><head><title>Invoice #${invoiceNo}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Segoe UI',Arial,sans-serif; color:#111; padding:32px; font-size:13px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; padding-bottom:16px; border-bottom:2px solid #7c3aed; }
    .brand-icon { width:40px; height:40px; background:#7c3aed; border-radius:10px; display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:14px; margin-bottom:6px; }
    .brand-name { font-size:18px; font-weight:700; }
    .brand-sub { font-size:10px; color:#9ca3af; }
    .invoice-title { font-size:22px; font-weight:700; color:#7c3aed; text-align:right; }
    .invoice-no { font-size:11px; color:#6b7280; text-align:right; margin-top:3px; }
    .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:24px; }
    .info-box { background:#f9fafb; border-radius:10px; padding:14px; }
    .info-label { font-size:10px; text-transform:uppercase; color:#7c3aed; font-weight:600; letter-spacing:.05em; margin-bottom:6px; }
    .info-val { font-size:13px; font-weight:600; color:#111; }
    .info-sub { font-size:11px; color:#6b7280; margin-top:2px; }
    table { width:100%; border-collapse:collapse; margin-bottom:20px; }
    thead tr { background:#f5f3ff; }
    th { padding:10px 12px; font-size:11px; text-transform:uppercase; color:#7c3aed; font-weight:600; letter-spacing:.04em; }
    td { padding:10px 12px; font-size:12px; border-bottom:1px solid #f3f4f6; }
    .total-row { background:#f5f3ff; }
    .total-row td { font-weight:700; font-size:14px; color:#7c3aed; border:none; padding:12px; }
    .footer { margin-top:32px; padding-top:14px; border-top:1px solid #e5e7eb; display:flex; justify-content:space-between; font-size:10px; color:#9ca3af; }
    .thank-you { text-align:center; margin-top:20px; font-size:13px; color:#7c3aed; font-weight:600; }
    @media print { body { padding:16px; } button { display:none !important; } }
  </style>
  </head><body>
  <div class="header">
    <div>
      <div class="brand-icon">PS</div>
      <div class="brand-name">ProductStore</div>
      <div class="brand-sub">Management Platform</div>
    </div>
    <div>
      <div class="invoice-title">INVOICE</div>
      <div class="invoice-no">#${invoiceNo}</div>
      <div class="invoice-no" style="margin-top:6px">${date}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="info-label">Bill To</div>
      <div class="info-val">${customer.name || "Walk-in Customer"}</div>
      ${customer.phone ? `<div class="info-sub">📞 ${customer.phone}</div>` : ""}
      ${customer.address ? `<div class="info-sub">📍 ${customer.address}</div>` : ""}
    </div>
    <div class="info-box">
      <div class="info-label">Transaction Info</div>
      <div class="info-val">Served by: ${employee || "—"}</div>
      <div class="info-sub">Payment: ${paymentMethod}</div>
      <div class="info-sub">Status: PAID</div>
    </div>
  </div>

  <table>
    <thead><tr>
      <th style="text-align:left">Product</th>
      <th style="text-align:center">Qty</th>
      <th style="text-align:right">Unit Price</th>
      <th style="text-align:right">Subtotal</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="3" style="text-align:right">TOTAL</td>
        <td style="text-align:right">৳${total.toLocaleString()}</td>
      </tr>
    </tfoot>
  </table>

  <div class="thank-you">Thank you for your purchase! 🙏</div>
  <div class="footer">
    <span>ProductStore · TurfSlot Platform</span>
    <span>Invoice #${invoiceNo} · ${date}</span>
  </div>
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

export default function SalesPOS({ products }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [items, setItems] = useState([]);
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "" });
  const [employee, setEmployee] = useState(EMPLOYEES[0]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [saving, setSaving] = useState(false);
  const [lastInvoice, setLastInvoice] = useState(null);

  const categories = ["all", ...new Set(products.map((p) => p.category).filter(Boolean))];

  const filtered = products.filter((p) => {
    const active = p.status === "active" && p.stock > 0;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "all" || p.category === filterCat;
    return active && matchSearch && matchCat;
  });

  const addItem = (product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        const newQty = existing.quantity + 1;
        if (newQty > product.stock) return prev; // don't exceed stock
        return prev.map((i) => i.product_id === product.id
          ? { ...i, quantity: newQty, subtotal: newQty * i.unit_price }
          : i
        );
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.price,
        subtotal: product.price,
      }];
    });
  };

  const updateQty = (pid, qty) => {
    const product = products.find((p) => p.id === pid);
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.product_id !== pid));
    } else if (product && qty <= product.stock) {
      setItems((prev) => prev.map((i) =>
        i.product_id === pid ? { ...i, quantity: qty, subtotal: qty * i.unit_price } : i
      ));
    }
  };

  const total = useMemo(() => items.reduce((s, i) => s + i.subtotal, 0), [items]);

  const handleConfirm = async () => {
    setSaving(true);
    const invoiceNo = `INV-${Date.now().toString().slice(-6)}`;
    const date = format(new Date(), "dd MMM yyyy, hh:mm a");

    await apiClient.entities.Order.create({
      customer_name: customer.name,
      customer_phone: customer.phone,
      items,
      total_amount: total,
      payment_method: paymentMethod,
      payment_status: "paid",
      status: "confirmed",
      notes: `Served by: ${employee}`,
    });

    for (const item of items) {
      const product = products.find((p) => p.id === item.product_id);
      if (product) {
        await apiClient.entities.Product.update(item.product_id, {
          stock: Math.max(0, (product.stock || 0) - item.quantity),
        });
      }
    }

    const invoiceData = { items: [...items], customer: { ...customer }, employee, paymentMethod, total, invoiceNo, date };
    setLastInvoice(invoiceData);
    printInvoice(invoiceData);

    setItems([]);
    setCustomer({ name: "", phone: "", address: "" });
    setPaymentMethod("cash");
    setSaving(false);
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* LEFT: Product Grid */}
      <div className="lg:col-span-2 space-y-3">
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search products by name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Product Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-300">
            <Package className="w-12 h-12 mb-2" />
            <p className="text-sm">No products available</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((p) => {
              const inCart = items.find((i) => i.product_id === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => addItem(p)}
                  className={`relative rounded-xl border-2 p-3 text-left transition-all hover:shadow-md active:scale-95 ${
                    inCart
                      ? "border-violet-400 bg-violet-50 shadow-sm"
                      : "border-gray-100 bg-white hover:border-violet-200"
                  }`}
                >
                  {inCart && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">{inCart.quantity}</span>
                    </div>
                  )}
                  <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center mb-2">
                    {p.image_url
                      ? <img src={p.image_url} className="w-10 h-10 rounded-lg object-cover" />
                      : <Package className="w-5 h-5 text-gray-300" />
                    }
                  </div>
                  <p className="text-xs font-semibold text-gray-800 leading-tight mb-1 truncate">{p.name}</p>
                  <p className="text-[11px] font-bold text-violet-700">৳{p.price.toLocaleString()}</p>
                  <Badge className={`text-[9px] mt-1 ${categoryColors[p.category] || ""}`}>{p.category}</Badge>
                  <p className={`text-[9px] mt-1 ${p.stock <= (p.low_stock_alert || 5) ? "text-amber-500 font-semibold" : "text-gray-400"}`}>
                    Stock: {p.stock} {p.unit}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* RIGHT: Cart + Customer + Invoice */}
      <div className="flex flex-col gap-3">
        {/* Employee */}
        <Card className="p-4 border-0 shadow-sm">
          <Label className="text-xs text-gray-500 flex items-center gap-1 mb-2"><Users className="w-3.5 h-3.5" /> Served By</Label>
          <Select value={employee} onValueChange={setEmployee}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EMPLOYEES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
        </Card>

        {/* Cart */}
        <Card className="p-4 border-0 shadow-sm flex-1">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="w-4 h-4 text-violet-600" />
            <span className="text-sm font-semibold text-gray-800">Cart</span>
            {items.length > 0 && (
              <button onClick={() => setItems([])} className="ml-auto text-[10px] text-red-400 hover:text-red-600">Clear all</button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="h-28 flex flex-col items-center justify-center text-gray-300 border border-dashed rounded-lg">
              <ShoppingCart className="w-8 h-8 mb-1" />
              <p className="text-xs">Click products to add</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {items.map((item) => (
                <div key={item.product_id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{item.product_name}</p>
                    <p className="text-[10px] text-gray-400">৳{item.unit_price} × {item.quantity}</p>
                  </div>
                  <span className="text-xs font-semibold text-gray-700">৳{item.subtotal.toLocaleString()}</span>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => updateQty(item.product_id, item.quantity - 1)} className="w-5 h-5 rounded bg-gray-200 text-xs font-bold hover:bg-red-100 hover:text-red-600 flex items-center justify-center">
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                    <span className="text-[10px] w-5 text-center font-medium">{item.quantity}</span>
                    <button onClick={() => updateQty(item.product_id, item.quantity + 1)} className="w-5 h-5 rounded bg-gray-200 text-xs font-bold hover:bg-violet-100 hover:text-violet-600 flex items-center justify-center">
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <button onClick={() => setItems((p) => p.filter((i) => i.product_id !== item.product_id))}>
                    <Trash2 className="w-3 h-3 text-red-400 hover:text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div className="mt-3 flex justify-between items-center bg-violet-50 rounded-lg px-3 py-2.5">
              <span className="text-sm font-bold text-violet-800">Total</span>
              <span className="text-xl font-bold text-violet-700">৳{total.toLocaleString()}</span>
            </div>
          )}
        </Card>

        {/* Customer Info */}
        <Card className="p-4 border-0 shadow-sm">
          <Label className="text-xs text-gray-500 flex items-center gap-1 mb-3"><User className="w-3.5 h-3.5" /> Customer Info</Label>
          <div className="space-y-2">
            <Input
              placeholder="Customer name (optional)"
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
              className="text-sm"
            />
            <div className="relative">
              <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Phone number"
                value={customer.phone}
                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                className="text-sm pl-8"
              />
            </div>
            <Input
              placeholder="Address (optional)"
              value={customer.address}
              onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
              className="text-sm"
            />
          </div>
        </Card>

        {/* Payment */}
        <Card className="p-4 border-0 shadow-sm">
          <Label className="text-xs text-gray-500 mb-2 block">Payment Method</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={`py-1.5 rounded-lg text-xs font-medium capitalize transition-all border ${
                  paymentMethod === m
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:border-violet-300 hover:bg-violet-50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </Card>

        {/* Confirm & Print */}
        <Button
          onClick={handleConfirm}
          disabled={saving || items.length === 0}
          className="w-full bg-violet-600 hover:bg-violet-700 h-11 text-sm font-semibold gap-2"
        >
          <Printer className="w-4 h-4" />
          {saving ? "Processing..." : "Confirm & Print Invoice"}
        </Button>

        {lastInvoice && (
          <button
            onClick={() => printInvoice(lastInvoice)}
            className="w-full text-xs text-violet-600 hover:text-violet-800 underline text-center"
          >
            Re-print last invoice
          </button>
        )}
      </div>
    </div>
  );
}
