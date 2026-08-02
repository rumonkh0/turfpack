import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function PartnerHistoryDialog({ open, onOpenChange, partner }) {
  const [activeTab, setActiveTab] = useState("payouts");

  const { data: payouts = [], isLoading: loadingPayouts } = useQuery({
    queryKey: ["payouts"],
    queryFn: () => apiClient.entities.Partner.payouts.list(),
    enabled: open,
  });

  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["reallocation_history"],
    queryFn: () => apiClient.entities.Partner.history(),
    enabled: open,
  });

  const formatCurrency = (amountInPoisha) => {
    return `৳${((amountInPoisha || 0) / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
    })}`;
  };

  const filteredPayouts = partner 
    ? payouts.filter(p => p.user_id === (partner._id || partner.id))
    : payouts;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {partner ? `History for ${partner.full_name}` : "Global Partner History"}
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 mt-4 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="payouts">Payouts</TabsTrigger>
            <TabsTrigger value="reallocations">Reallocations</TabsTrigger>
          </TabsList>
          
          <TabsContent value="payouts" className="flex-1 overflow-auto mt-4">
            <div className="bg-white rounded-lg border border-gray-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-medium">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    {!partner && <th className="px-4 py-3">Partner</th>}
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingPayouts ? (
                    <tr>
                      <td colSpan={partner ? 3 : 4} className="px-4 py-4">
                        <Skeleton className="h-10 w-full" />
                      </td>
                    </tr>
                  ) : filteredPayouts.length === 0 ? (
                    <tr>
                      <td colSpan={partner ? 3 : 4} className="px-4 py-8 text-center text-gray-400">
                        No payouts found.
                      </td>
                    </tr>
                  ) : (
                    filteredPayouts.map((p) => (
                      <tr key={p._id || p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600">
                          {p.payout_date ? format(new Date(p.payout_date), "MMM d, yyyy") : "N/A"}
                        </td>
                        {!partner && (
                          <td className="px-4 py-3 text-gray-900 font-medium">
                            {p.user?.full_name || "Unknown"}
                          </td>
                        )}
                        <td className="px-4 py-3 capitalize text-gray-500">
                          {p.payment_method}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          {formatCurrency(p.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="reallocations" className="flex-1 overflow-auto mt-4">
            <div className="space-y-4">
              {loadingHistory ? (
                <Skeleton className="h-32 w-full rounded-xl" />
              ) : history.length === 0 ? (
                <div className="text-center text-gray-400 py-8 bg-gray-50 rounded-lg">
                  No share reallocations recorded yet.
                </div>
              ) : (
                history.map((entry) => (
                  <div key={entry._id || entry.id} className="bg-white p-4 rounded-xl border border-gray-200">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900">{entry.reason}</h4>
                        <p className="text-xs text-gray-500 mt-1">
                          {entry.created_at ? format(new Date(entry.created_at), "MMM d, yyyy h:mm a") : "N/A"} 
                          {' '}• by {entry.created_by?.full_name || "Admin"}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
                      {entry.shares?.map((share, idx) => (
                        <div key={idx} className="bg-gray-50 p-2 rounded border border-gray-100 flex justify-between items-center text-sm">
                          <span className="text-gray-600 truncate mr-2" title={share.user?.full_name}>
                            {share.user?.full_name || "Unknown"}
                          </span>
                          <Badge variant="outline" className="bg-white whitespace-nowrap">
                            {share.share_bp} BP
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
