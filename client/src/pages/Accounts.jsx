import React, { useState } from "react";
import { apiClient } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Edit2 } from "lucide-react";
import AccountFormDialog from "@/components/accounting/AccountFormDialog";
import { useQueryClient } from "@tanstack/react-query";

export default function Accounts() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editAccount, setEditAccount] = useState(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => apiClient.entities.Account.list("code", 100),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chart of Accounts</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Manage your ledger accounts
          </p>
        </div>
        <Button 
          onClick={() => {
            setEditAccount(null);
            setShowForm(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Account
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-medium">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 whitespace-nowrap">Type</th>
                <th className="px-4 py-3 whitespace-nowrap">Normal Side</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="px-4 py-4">
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-10 w-full rounded" />
                      ))}
                    </div>
                  </td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No accounts found.
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => (
                  <tr
                    key={acc._id || acc.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-900 font-mono font-medium">
                      {acc.code}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">
                      {acc.name}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="capitalize text-xs">
                        {acc.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500 capitalize">
                      {acc.normal_side}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {acc.description}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setEditAccount(acc);
                          setShowForm(true);
                        }}
                      >
                        <Edit2 className="w-4 h-4 text-gray-500 hover:text-emerald-600" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AccountFormDialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditAccount(null);
        }}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["accounts"] })}
        editAccount={editAccount}
      />
    </div>
  );
}
