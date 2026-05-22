import React from "react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Calendar } from "lucide-react";

const methodIcons = {
  bkash: "🟪",
  nagad: "🟧",
  rocket: "🟣",
  cash: "💵",
  card: "💳",
  other: "📱",
};

export default function PaymentHistoryPanel({ booking }) {
  if (
    booking.payment_status !== "partial" ||
    !booking.payment_history?.length
  ) {
    return null;
  }

  const remainingBalance =
    (booking.total_price || 0) - (booking.paid_amount || 0);

  return (
    <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-50/50 border border-blue-200 rounded-lg">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-blue-900 text-sm">
            Payment History
          </h4>
          <Badge variant="outline" className="text-blue-700 border-blue-300">
            {booking.payment_history.length} payment
            {booking.payment_history.length > 1 ? "s" : ""}
          </Badge>
        </div>

        <div className="space-y-2">
          {booking.payment_history.map((payment, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 bg-white rounded border border-blue-100"
            >
              <div className="flex items-center gap-3 flex-1">
                <span className="text-xl">
                  {methodIcons[payment.method] || "💳"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 capitalize">
                    {payment.method}
                  </p>
                  {payment.txn_id && (
                    <p className="text-xs text-gray-500">
                      TxnID: {payment.txn_id}
                    </p>
                  )}
                  {payment.date && (
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(payment.date), "MMM d, yyyy")}
                    </p>
                  )}
                  {payment.notes && (
                    <p className="text-xs text-gray-600 italic mt-1">
                      {payment.notes}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-blue-700">৳{payment.amount}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-blue-200 pt-2 mt-3">
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="text-gray-700">Total Paid:</span>
            <span className="font-semibold text-blue-700">
              ৳{booking.paid_amount || 0}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-700">Remaining Balance:</span>
            <span
              className={`font-semibold ${remainingBalance > 0 ? "text-red-600" : "text-green-600"}`}
            >
              ৳{remainingBalance}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
