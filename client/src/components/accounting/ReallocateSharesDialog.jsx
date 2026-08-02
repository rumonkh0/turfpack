import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiClient } from "@/api/client";
import { useQuery } from "@tanstack/react-query";

export default function ReallocateSharesDialog({ open, onOpenChange, onSaved }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shares, setShares] = useState({});
  const [reason, setReason] = useState("");

  const { data: partners = [] } = useQuery({
    queryKey: ["partners"],
    queryFn: () => apiClient.entities.Partner.list(),
    enabled: open,
  });

  // Initialize local state when partners data loads
  useEffect(() => {
    if (open && partners.length > 0) {
      const initialShares = {};
      partners.forEach(p => {
        initialShares[p._id || p.id] = p.share_bp || 0;
      });
      setShares(initialShares);
      setReason("");
    }
  }, [open, partners]);

  const handleShareChange = (partnerId, value) => {
    setShares(prev => ({
      ...prev,
      [partnerId]: parseInt(value) || 0
    }));
  };

  const totalBP = Object.values(shares).reduce((a, b) => a + b, 0);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (totalBP !== 10000) {
      toast.error(`Total shares must equal 10000 BP (currently ${totalBP})`);
      return;
    }

    if (!reason.trim()) {
      toast.error("Please provide a reason for reallocation");
      return;
    }

    setIsSubmitting(true);
    try {
      const sharesArray = Object.keys(shares).map(userId => ({
        user_id: userId,
        share_bp: shares[userId]
      }));

      await apiClient.entities.Partner.reallocate({
        shares: sharesArray,
        reason
      });

      toast.success("Shares reallocated successfully");
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast.error(error.message || "Failed to reallocate shares");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reallocate Partner Shares</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 mt-4">
          <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-sm mb-4">
            Total shares must equal exactly <strong>10000 Base Points (BP)</strong>, which represents 100%. 
            Currently at: <span className={totalBP !== 10000 ? "text-red-600 font-bold" : "text-emerald-600 font-bold"}>{totalBP} BP</span>
          </div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
            {partners.map(partner => (
              <div key={partner._id || partner.id} className="flex items-center gap-4">
                <Label className="flex-1 truncate" title={partner.full_name}>
                  {partner.full_name}
                </Label>
                <div className="w-32 flex items-center gap-2">
                  <Input 
                    type="number" 
                    min="0" 
                    max="10000"
                    value={shares[partner._id || partner.id] ?? ""} 
                    onChange={(e) => handleShareChange(partner._id || partner.id, e.target.value)}
                  />
                  <span className="text-xs text-gray-500">BP</span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100">
            <Label htmlFor="reason">Reason for Reallocation</Label>
            <Input 
              id="reason" 
              placeholder="e.g. New partner joined, 60/40 split" 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || totalBP !== 10000} className="bg-emerald-600 hover:bg-emerald-700">
              {isSubmitting ? "Saving..." : "Confirm Reallocation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
