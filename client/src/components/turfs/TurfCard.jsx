import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Zap } from "lucide-react";

const statusColors = {
  active: "bg-emerald-50 text-emerald-700",
  maintenance: "bg-amber-50 text-amber-700",
  inactive: "bg-gray-100 text-gray-500",
};

export default function TurfCard({ turf, onClick }) {
  return (
    <Card
      className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group"
      onClick={() => onClick(turf)}
    >
      <div className="h-40 bg-gray-100 relative overflow-hidden">
        {turf.image_url ? (
          <img src={turf.image_url} alt={turf.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100">
            <MapPin className="w-8 h-8 text-emerald-300" />
          </div>
        )}
        <Badge className={`absolute top-3 right-3 text-[10px] ${statusColors[turf.status] || ""}`}>
          {turf.status}
        </Badge>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-sm">{turf.name}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{turf.type?.replace(/-/g, " ")} · {turf.size || "N/A"}</p>
        {turf.location && (
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {turf.location}
          </p>
        )}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            {turf.opening_hour || 6}:00 – {turf.closing_hour || 23}:00
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-emerald-500" />
            <span className="text-sm font-bold text-gray-800">৳{turf.base_price}</span>
            <span className="text-[10px] text-gray-400">/hr</span>
          </div>
        </div>
      </div>
    </Card>
  );
}