import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/api/client";
import { Loader2, Plus, Trash2, Search } from "lucide-react";
import { format } from "date-fns";
import { printInvoice } from "./SalesPOS";

export default function NewOrderDialog({
  open,
  onOpenChange,
  products,
  onSaved,
}) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [status, setStatus] = useState("confirmed");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [savingAction, setSavingAction] = useState(null); // 'confirm' or 'confirm-print'

  const filteredProducts = products.filter(
    (p) =>
      p.status === "active" &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const addItem = (product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id
            ? {
                ...i,
                quantity: i.quantity + 1,
                subtotal: (i.quantity + 1) * i.unit_price,
              }
            : i,
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: product.price,
          subtotal: product.price,
        },
      ];
    });
  };

  const updateQty = (pid, qty) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => i.product_id !== pid));
    } else {
      setItems((prev) =>
        prev.map((i) =>
          i.product_id === pid
            ? { ...i, quantity: qty, subtotal: qty * i.unit_price }
            : i,
        ),
      );
    }
  };

  const total = useMemo(
    () => items.reduce((s, i) => s + i.subtotal, 0),
    [items],
  );

  const handleSave = async (shouldPrint = false) => {
    setSavingAction(shouldPrint ? "confirm-print" : "confirm");
    const invoiceNo = `INV-${Date.now().toString().slice(-6)}`;
    const date = format(new Date(), "dd MMM yyyy, hh:mm a");
    const invoiceData = {
      items: [...items],
      customer: { ...customer },
      employee: "Admin",
      paymentMethod,
      total,
      invoiceNo,
      date,
      status,
      paymentStatus,
    };

    // 1. Print if requested
    if (shouldPrint) {
      printInvoice(invoiceData);
    }

    try {
      // 2. Perform DB writes in the background
      await apiClient.entities.Order.create({
        customer_name: customer.name,
        customer_phone: customer.phone,
        items,
        total_amount: total,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        status: status,
      });
      // Update stock (only if order is active/not cancelled)
      if (status !== "cancelled") {
        for (const item of items) {
          const product = products.find((p) => p.id === item.product_id);
          if (product) {
            await apiClient.entities.Product.update(item.product_id, {
              stock: Math.max(0, (product.stock || 0) - item.quantity),
            });
          }
        }
      }
    } catch (err) {
      console.error("[NewOrderDialog] Error saving order:", err);
    }

    // 3. Reset states after focus has stabilized on print preview
    setTimeout(() => {
      setSavingAction(null);
      setItems([]);
      setCustomer({ name: "", phone: "" });
      setStatus("confirmed");
      setPaymentStatus("paid");
      onSaved();
      onOpenChange(false);
    }, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Order</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-6">
          {/* Product picker */}
          <div>
            <Label className="mb-2 block">Add Products</Label>
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addItem(p)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-violet-50 border border-transparent hover:border-violet-200 transition-all text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {p.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {p.category} · Stock: {p.stock}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-violet-700">
                      ৳{p.price}
                    </span>
                    <Plus className="w-4 h-4 text-violet-500" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Cart */}
          <div>
            <Label className="mb-2 block">Order Items</Label>
            {items.length === 0 ? (
              <div className="h-24 flex items-center justify-center text-sm text-gray-400 border border-dashed rounded-lg">
                Add products from the left
              </div>
            ) : (
              <div className="space-y-2 mb-3">
                {items.map((item) => (
                  <div
                    key={item.product_id}
                    className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2"
                  >
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-800">
                        {item.product_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        ৳{item.unit_price} × {item.quantity}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">
                      ৳{item.subtotal}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          updateQty(item.product_id, item.quantity - 1)
                        }
                        className="w-5 h-5 rounded bg-gray-200 text-xs font-bold hover:bg-gray-300"
                      >
                        -
                      </button>
                      <span className="text-xs w-5 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQty(item.product_id, item.quantity + 1)
                        }
                        className="w-5 h-5 rounded bg-gray-200 text-xs font-bold hover:bg-gray-300"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() =>
                        setItems((p) =>
                          p.filter((i) => i.product_id !== item.product_id),
                        )
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                ))}
                <div className="flex justify-between items-center px-3 py-2 bg-violet-50 rounded-lg">
                  <span className="text-sm font-semibold text-violet-800">
                    Total
                  </span>
                  <span className="text-lg font-bold text-violet-700">
                    ৳{total.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-3 mt-3 pt-3 border-t">
              <div>
                <Label className="text-xs">Customer Name</Label>
                <Input
                  value={customer.name}
                  onChange={(e) =>
                    setCustomer({ ...customer, name: e.target.value })
                  }
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label className="text-xs">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["cash", "bkash", "nagad", "rocket", "card", "other"].map(
                      (m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Order Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Payment Status</Label>
                  <Select
                    value={paymentStatus}
                    onValueChange={setPaymentStatus}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={savingAction}
          >
            Cancel
          </Button>
          <Button
            onClick={() => handleSave(false)}
            disabled={savingAction || items.length === 0}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {savingAction === "confirm" && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Confirm Order
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={savingAction || items.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {savingAction === "confirm-print" && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Confirm & Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
