import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/api/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const defaults = {
  name: "", type: "5-a-side", size: "", location: "", image_url: "", image_public_id: "",
  status: "active", base_price: 2000, peak_price: 3000, night_price: 2500,
  opening_hour: 6, closing_hour: 23, peak_hours_start: 17, peak_hours_end: 21,
  weekend_multiplier: 1.2, amenities: [],
};

export default function TurfFormDialog({ open, onOpenChange, turf, onSaved }) {
  const isEdit = !!turf;
  const [form, setForm] = useState(turf || defaults);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(turf ? { ...defaults, ...turf } : defaults);
    }
  }, [turf, open]);

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url, public_id } = await apiClient.integrations.Core.UploadFile({ file });
      setForm(prev => ({ ...prev, image_url: file_url, image_public_id: public_id }));
      toast.success("Image uploaded successfully");
    } catch (err) {
      toast.error(err.message || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const {
        name, type, size, location, image_url, image_public_id, status, base_price, peak_price,
        night_price, opening_hour, closing_hour, peak_hours_start, peak_hours_end,
        weekend_multiplier, amenities
      } = form;
      const payload = {
        name, type, size, location, image_url, image_public_id, status, base_price, peak_price,
        night_price, opening_hour, closing_hour, peak_hours_start, peak_hours_end,
        weekend_multiplier, amenities
      };

      if (isEdit) {
        await apiClient.entities.Turf.update(turf.id, payload);
        toast.success("Turf updated successfully");
      } else {
        await apiClient.entities.Turf.create(payload);
        toast.success("Turf created successfully");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message || "Failed to save turf");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Turf" : "Add New Turf"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Main Ground" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["5-a-side", "7-a-side", "11-a-side", "futsal", "multi-purpose"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Size</Label>
              <Input value={form.size} onChange={(e) => set("size", e.target.value)} placeholder="40x20m" />
            </div>
            <div className="col-span-2">
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Dhaka, Bangladesh" />
            </div>
            <div className="col-span-2">
              <Label>Image</Label>
              <Input type="file" accept="image/*" onChange={handleImageUpload} />
              {uploading && <p className="text-xs text-gray-400 mt-1">Uploading...</p>}
              {form.image_url && <img src={form.image_url} className="mt-2 h-24 rounded-lg object-cover" />}
            </div>
          </div>

          <div className="pt-2 border-t">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Pricing (BDT)</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Base / hr</Label>
                <Input type="number" value={form.base_price} onChange={(e) => set("base_price", Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Peak / hr</Label>
                <Input type="number" value={form.peak_price} onChange={(e) => set("peak_price", Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Night / hr</Label>
                <Input type="number" value={form.night_price} onChange={(e) => set("night_price", Number(e.target.value))} />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Schedule</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Opening Hour</Label>
                <Input type="number" min={0} max={23} value={form.opening_hour} onChange={(e) => set("opening_hour", Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Closing Hour</Label>
                <Input type="number" min={0} max={23} value={form.closing_hour} onChange={(e) => set("closing_hour", Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Peak Start</Label>
                <Input type="number" min={0} max={23} value={form.peak_hours_start} onChange={(e) => set("peak_hours_start", Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs">Peak End</Label>
                <Input type="number" min={0} max={23} value={form.peak_hours_end} onChange={(e) => set("peak_hours_end", Number(e.target.value))} />
              </div>
            </div>
          </div>

          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.name} className="bg-emerald-600 hover:bg-emerald-700">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
