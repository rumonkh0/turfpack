import React, { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { apiClient } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

export default function ExpenseFormDialog({ open, onOpenChange, onSaved }) {
  const { register, handleSubmit, formState: { isSubmitting }, reset, setValue, watch } = useForm({
    defaultValues: {
      description: "",
      amount: "",
      account_code: "",
      payment_method: "cash",
      entry_date: format(new Date(), "yyyy-MM-dd"),
      notes: "",
    }
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiClient.entities.Account.list("code", 100),
    enabled: open,
  });

  const expenseAccounts = accounts.filter(a => a.type === "expense");

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        amount: Number(data.amount) * 100 // Convert Taka to Poisha
      };
      await apiClient.entities.Expense.create(payload);
      toast.success("Expense recorded successfully");
      reset();
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error.message || "Failed to record expense");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Record Expense</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" placeholder="e.g. Electricity Bill" {...register("description", { required: true })} />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (৳)</Label>
              <Input id="amount" type="number" step="0.01" min="0" placeholder="0.00" {...register("amount", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entry_date">Date</Label>
              <Input id="entry_date" type="date" {...register("entry_date", { required: true })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Expense Account</Label>
            <Select onValueChange={(val) => setValue("account_code", val)}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {expenseAccounts.map(acc => (
                  <SelectItem key={acc._id || acc.id} value={acc.code}>
                    {acc.code} - {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select onValueChange={(val) => setValue("payment_method", val)} defaultValue="cash">
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bkash">bKash</SelectItem>
                <SelectItem value="nagad">Nagad</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Input id="notes" placeholder="Invoice #, etc." {...register("notes")} />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
              {isSubmitting ? "Saving..." : "Record Expense"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
