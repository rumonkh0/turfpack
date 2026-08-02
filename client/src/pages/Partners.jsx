import React, { useState } from "react";
import { apiClient } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, History, Banknote } from "lucide-react";
import PartnerFormDialog from "@/components/accounting/PartnerFormDialog";
import ReallocateSharesDialog from "@/components/accounting/ReallocateSharesDialog";
import PayoutFormDialog from "@/components/accounting/PayoutFormDialog";
import PartnerHistoryDialog from "@/components/accounting/PartnerHistoryDialog";
import { useQueryClient } from "@tanstack/react-query";

export default function Partners() {
  const queryClient = useQueryClient();
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [editPartner, setEditPartner] = useState(null);
  const [showReallocateForm, setShowReallocateForm] = useState(false);
  const [payoutPartner, setPayoutPartner] = useState(null);
  const [historyPartner, setHistoryPartner] = useState(null); // null means global history, specific object means filter by partner
  const [showHistory, setShowHistory] = useState(false);

  const { data: partners = [], isLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: () => apiClient.entities.Partner.list(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partners</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Manage partners and shares
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              setHistoryPartner(null);
              setShowHistory(true);
            }}
          >
            <History className="w-4 h-4 mr-2" /> View History
          </Button>
          <Button variant="outline" onClick={() => setShowReallocateForm(true)}>
            Reallocate Shares
          </Button>
          <Button 
            onClick={() => {
              setEditPartner(null);
              setShowPartnerForm(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Partner
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-medium">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 whitespace-nowrap">Share (BP)</th>
                <th className="px-4 py-3 whitespace-nowrap">Share (%)</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="px-4 py-4">
                    <div className="space-y-3">
                      {[1, 2].map((i) => (
                        <Skeleton key={i} className="h-10 w-full rounded" />
                      ))}
                    </div>
                  </td>
                </tr>
              ) : partners.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No partners found.
                  </td>
                </tr>
              ) : (
                partners.map((partner) => (
                  <tr
                    key={partner._id || partner.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {partner.full_name}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {partner.email}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {partner.share_bp} BP
                    </td>
                    <td className="px-4 py-3 text-emerald-600 font-medium">
                      {((partner.share_bp || 0) / 100).toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-emerald-600"
                          onClick={() => setPayoutPartner(partner)}
                        >
                          <Banknote className="w-4 h-4 mr-1" /> Payout
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setHistoryPartner(partner);
                            setShowHistory(true);
                          }}
                        >
                          View Payouts
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setEditPartner(partner);
                            setShowPartnerForm(true);
                          }}
                        >
                          <Edit2 className="w-4 h-4 text-gray-500 hover:text-emerald-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PartnerFormDialog
        open={showPartnerForm}
        onOpenChange={(open) => {
          setShowPartnerForm(open);
          if (!open) setEditPartner(null);
        }}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["partners"] })}
        editPartner={editPartner}
      />
      
      <ReallocateSharesDialog
        open={showReallocateForm}
        onOpenChange={setShowReallocateForm}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["partners"] })}
      />

      <PayoutFormDialog
        open={!!payoutPartner}
        onOpenChange={(open) => {
          if (!open) setPayoutPartner(null);
        }}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["partners"] });
          queryClient.invalidateQueries({ queryKey: ["ledger"] });
          queryClient.invalidateQueries({ queryKey: ["reports"] });
        }}
        partner={payoutPartner}
      />

      <PartnerHistoryDialog
        open={showHistory}
        onOpenChange={setShowHistory}
        partner={historyPartner}
      />
    </div>
  );
}
