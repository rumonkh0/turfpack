import React from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

export default function PayoutFormDialog({ open, onOpenChange, onSaved, partner }) {
  const { register, handleSubmit, formState: { isSubmitting }, reset, setValue } = useForm({
    defaultValues: {
      amount: "",
      payment_method: "bank_transfer",
      payout_date: format(new Date(), "yyyy-MM-dd"),
      notes: "",
    }
  });

  const onSubmit = async (data) => {
    if (!partner) return;
    try {
      const payload = {
        user_id: partner._id || partner.id,
        amount: Number(data.amount) * 100, // Taka to Poisha
        payment_method: data.payment_method,
        payout_date: data.payout_date,
        notes: data.notes
      };
      await apiClient.entities.Partner.payouts.create(payload);
      toast.success("Payout recorded successfully");
      reset();
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error.message || "Failed to record payout");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Record Payout for {partner?.full_name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (৳)</Label>
            <Input id="amount" type="number" step="0.01" min="0" placeholder="0.00" {...register("amount", { required: true })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payout_date">Date</Label>
            <Input id="payout_date" type="date" {...register("payout_date", { required: true })} />
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select onValueChange={(val) => setValue("payment_method", val)} defaultValue="bank_transfer">
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
            <Input id="notes" placeholder="Transaction ID, etc." {...register("notes")} />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
              {isSubmitting ? "Saving..." : "Record Payout"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
