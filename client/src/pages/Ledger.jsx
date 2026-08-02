import React, { useState } from "react";
import { apiClient } from "@/api/client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function Ledger() {
  const [expandedId, setExpandedId] = useState(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["ledger"],
    queryFn: () => apiClient.entities.Ledger.list("-entry_date"),
  });

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const formatCurrency = (amountInPoisha) => {
    return `৳${(amountInPoisha / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ledger</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            General Ledger Journal Entries
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 font-medium">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 whitespace-nowrap">Ref Type</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Total Debit</th>
                <th className="px-4 py-3 whitespace-nowrap text-right">Total Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="5" className="px-4 py-4">
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-10 w-full rounded" />
                      ))}
                    </div>
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    No journal entries found.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const id = entry._id || entry.id;
                  const isExpanded = expandedId === id;
                  const totalDebit = entry.lines?.reduce((sum, line) => sum + (line.debit || 0), 0) || 0;
                  const totalCredit = entry.lines?.reduce((sum, line) => sum + (line.credit || 0), 0) || 0;

                  return (
                    <React.Fragment key={id}>
                      <tr
                        onClick={() => toggleExpand(id)}
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                          isExpanded ? "bg-gray-50/80" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {entry.entry_date
                            ? format(new Date(entry.entry_date), "MMM d, yyyy")
                            : "N/A"}
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium">
                          {entry.description}
                        </td>
                        <td className="px-4 py-3 text-gray-500 capitalize">
                          {entry.reference_type}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 font-medium">
                          {formatCurrency(totalDebit)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 font-medium">
                          {formatCurrency(totalCredit)}
                        </td>
                      </tr>
                      {isExpanded && entry.lines && entry.lines.length > 0 && (
                        <tr className="bg-gray-50/50">
                          <td colSpan="5" className="px-4 py-3">
                            <div className="pl-6 border-l-2 border-emerald-500/30 my-2">
                              <table className="w-full text-xs text-left">
                                <thead className="text-gray-400 font-medium">
                                  <tr>
                                    <th className="pb-2">Account</th>
                                    <th className="pb-2 text-right">Debit</th>
                                    <th className="pb-2 text-right">Credit</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {entry.lines.map((line, idx) => (
                                    <tr key={idx}>
                                      <td className="py-1 text-gray-700">
                                        <span className="text-gray-400 mr-2">
                                          {line.account_code}
                                        </span>
                                        {line.account_name}
                                      </td>
                                      <td className="py-1 text-right text-gray-900">
                                        {line.debit > 0
                                          ? formatCurrency(line.debit)
                                          : "-"}
                                      </td>
                                      <td className="py-1 text-right text-gray-900">
                                        {line.credit > 0
                                          ? formatCurrency(line.credit)
                                          : "-"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
