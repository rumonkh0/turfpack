import React, { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import IncomeFormDialog from "@/components/accounting/IncomeFormDialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Incomes() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: incomes = [], isLoading } = useQuery({
    queryKey: ["incomes"],
    queryFn: () => apiClient.entities.Income.list("-entry_date"),
  });

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this income? This will post a reversal journal entry.")) return;
    try {
      await apiClient.entities.Income.delete(id);
      toast.success("Income deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["incomes"] });
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    } catch (error) {
      toast.error(error.message || "Failed to delete income");
    }
  };

  const formatCurrency = (amountInPoisha) => {
    return `৳${(amountInPoisha / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incomes</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Log and manage manual incomes
          </p>
        </div>
        <Button 
          onClick={() => setShowForm(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" /> Record Income
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-medium">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Account Code</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="px-4 py-4">
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-10 w-full rounded" />
                      ))}
                    </div>
                  </td>
                </tr>
              ) : incomes.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No manual incomes logged yet.
                  </td>
                </tr>
              ) : (
                incomes.map((income) => (
                  <tr
                    key={income._id || income.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {income.entry_date
                        ? format(new Date(income.entry_date), "MMM d, yyyy")
                        : "N/A"}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {income.description}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {income.account_code}
                    </td>
                    <td className="px-4 py-3 text-gray-500 capitalize">
                      {income.payment_method}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 font-medium">
                      {formatCurrency(income.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDelete(income._id || income.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500 hover:text-red-700" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <IncomeFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["incomes"] });
          queryClient.invalidateQueries({ queryKey: ["ledger"] });
          queryClient.invalidateQueries({ queryKey: ["reports"] });
        }}
      />
    </div>
  );
}
