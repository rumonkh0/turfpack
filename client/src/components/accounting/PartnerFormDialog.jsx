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

export default function PartnerFormDialog({ open, onOpenChange, onSaved, editPartner }) {
  const { register, handleSubmit, formState: { isSubmitting }, reset } = useForm({
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
    }
  });

  useEffect(() => {
    if (open) {
      if (editPartner) {
        reset({
          full_name: editPartner.full_name || "",
          email: editPartner.email || "",
          password: "",
        });
      } else {
        reset({
          full_name: "",
          email: "",
          password: "",
        });
      }
    }
  }, [open, editPartner, reset]);

  const onSubmit = async (data) => {
    try {
      if (editPartner) {
        // If password is empty during edit, don't send it
        const payload = { ...data };
        if (!payload.password) {
          delete payload.password;
        }
        await apiClient.entities.Partner.update(editPartner._id || editPartner.id, payload);
        toast.success("Partner updated successfully");
      } else {
        await apiClient.entities.Partner.create(data);
        toast.success("Partner created successfully");
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error.message || `Failed to ${editPartner ? "update" : "create"} partner`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editPartner ? "Edit Partner" : "Add New Partner"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input id="full_name" placeholder="John Doe" {...register("full_name", { required: true })} />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" type="email" placeholder="john@example.com" {...register("email", { required: true })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{editPartner ? "New Password (Optional)" : "Password"}</Label>
            <Input id="password" type="password" placeholder="••••••••" {...register("password", { required: !editPartner })} />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700">
              {isSubmitting ? "Saving..." : (editPartner ? "Update Partner" : "Create Partner")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
