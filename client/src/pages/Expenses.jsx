import React, { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import ExpenseFormDialog from "@/components/accounting/ExpenseFormDialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Expenses() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => apiClient.entities.Expense.list("-entry_date"),
  });

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this expense? This will post a reversal journal entry.")) return;
    try {
      await apiClient.entities.Expense.delete(id);
      toast.success("Expense deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    } catch (error) {
      toast.error(error.message || "Failed to delete expense");
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
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Log and manage business expenses
          </p>
        </div>
        <Button 
          onClick={() => setShowForm(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" /> Record Expense
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
              ) : expenses.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No expenses logged yet.
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr
                    key={expense._id || expense.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {expense.entry_date
                        ? format(new Date(expense.entry_date), "MMM d, yyyy")
                        : "N/A"}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {expense.description}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {expense.account_code}
                    </td>
                    <td className="px-4 py-3 text-gray-500 capitalize">
                      {expense.payment_method}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 font-medium">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDelete(expense._id || expense.id)}
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

      <ExpenseFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["expenses"] });
          queryClient.invalidateQueries({ queryKey: ["ledger"] });
          queryClient.invalidateQueries({ queryKey: ["reports"] });
        }}
      />
    </div>
  );
}
