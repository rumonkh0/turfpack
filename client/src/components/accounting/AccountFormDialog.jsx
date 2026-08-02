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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AccountFormDialog({ open, onOpenChange, onSaved, editAccount }) {
  const { register, handleSubmit, formState: { isSubmitting }, reset, setValue } = useForm({
    defaultValues: {
      code: "",
      name: "",
      type: "expense",
      normal_side: "debit",
      description: "",
    }
  });

  useEffect(() => {
    if (open) {
      if (editAccount) {
        reset({
          code: editAccount.code || "",
          name: editAccount.name || "",
          type: editAccount.type || "expense",
          normal_side: editAccount.normal_side || "debit",
          description: editAccount.description || "",
        });
        setValue("type", editAccount.type || "expense");
        setValue("normal_side", editAccount.normal_side || "debit");
      } else {
        reset({
          code: "",
          name: "",
          type: "expense",
          normal_side: "debit",
          description: "",
        });
        setValue("type", "expense");
        setValue("normal_side", "debit");
      }
    }
  }, [open, editAccount, reset, setValue]);

  const onSubmit = async (data) => {
    try {
      if (editAccount) {
        await apiClient.entities.Account.update(editAccount._id || editAccount.id, data);
        toast.success("Account updated successfully");
      } else {
        await apiClient.entities.Account.create(data);
        toast.success("Account created successfully");
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error.message || `Failed to ${editAccount ? "update" : "create"} account`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editAccount ? "Edit Account" : "Add New Account"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="code">Account Code</Label>
            <Input id="code" placeholder="e.g. 6007" {...register("code", { required: true })} />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="name">Account Name</Label>
            <Input id="name" placeholder="e.g. Transport" {...register("name", { required: true })} />
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select onValueChange={(val) => setValue("type", val)} defaultValue="expense">
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asset">Asset</SelectItem>
                <SelectItem value="liability">Liability</SelectItem>
                <SelectItem value="equity">Equity</SelectItem>
                <SelectItem value="revenue">Revenue</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Normal Side</Label>
            <Select onValueChange={(val) => setValue("normal_side", val)} defaultValue="debit">
              <SelectTrigger>
                <SelectValue placeholder="Select normal side" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="debit">Debit</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input id="description" {...register("description")} />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
              {isSubmitting ? "Saving..." : (editAccount ? "Update Account" : "Save Account")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
