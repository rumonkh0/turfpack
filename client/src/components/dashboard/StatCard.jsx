import React from "react";
import { Card } from "@/components/ui/card";

export default function StatCard({ title, value, subtitle, icon: Icon, color = "emerald" }) {
  const colorMap = {
    emerald: { bg: "bg-emerald-50", icon: "text-emerald-600" },
    blue: { bg: "bg-blue-50", icon: "text-blue-600" },
    amber: { bg: "bg-amber-50", icon: "text-amber-600" },
    rose: { bg: "bg-rose-50", icon: "text-rose-600" },
    violet: { bg: "bg-violet-50", icon: "text-violet-600" },
  };
  const c = colorMap[color] || colorMap.emerald;

  return (
    <Card className="p-5 border-0 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
      </div>
    </Card>
  );
}