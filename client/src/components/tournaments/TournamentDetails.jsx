import React, { useState } from "react";
import { ArrowLeft, Users, Settings, Trophy, Calendar, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import TeamManager from "./TeamManager";

const statusColors = {
  upcoming: "bg-blue-50 text-blue-700 border-blue-200",
  registration_open: "bg-emerald-50 text-emerald-700 border-emerald-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-gray-100 text-gray-600 border-gray-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

export default function TournamentDetails({ tournament, onBack, onUpdate }) {
  const [activeTab, setActiveTab] = useState("teams");

  if (!tournament) return null;

  const totalCollected = tournament.teams?.reduce((acc, team) => {
    return acc + (team.paid ? tournament.entry_fee : 0);
  }, 0) || 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header section */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{tournament.name}</h1>
            <Badge className={`text-xs border ${statusColors[tournament.status] || ""}`}>
              {tournament.status?.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">{tournament.turf_name} · {tournament.format?.replace(/_/g, " ")}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 border-0 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Registered Teams</p>
            <p className="text-lg font-bold text-gray-900">{tournament.teams?.length || 0} <span className="text-gray-400 text-sm">/ {tournament.max_teams}</span></p>
          </div>
        </Card>
        
        <Card className="p-4 border-0 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Prize Pool</p>
            <p className="text-lg font-bold text-gray-900">৳{tournament.prize_pool?.toLocaleString()}</p>
          </div>
        </Card>

        <Card className="p-4 border-0 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Fees Collected</p>
            <p className="text-lg font-bold text-gray-900">৳{totalCollected.toLocaleString()}</p>
          </div>
        </Card>

        <Card className="p-4 border-0 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Start Date</p>
            <p className="text-lg font-bold text-gray-900">
              {tournament.start_date ? format(new Date(tournament.start_date), "MMM d, yyyy") : "TBD"}
            </p>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("teams")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "teams" ? "border-emerald-600 text-emerald-700" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Team Registration
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "settings" ? "border-emerald-600 text-emerald-700" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Tournament Settings
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === "teams" && (
          <TeamManager tournament={tournament} onUpdate={onUpdate} />
        )}
        {activeTab === "settings" && (
          <Card className="p-6 border-0 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500 mb-4">Settings Management coming soon</h3>
            {/* We can build out editing the tournament basics here if requested */}
            <p className="text-sm text-gray-400">
              For now, you can manage the tournament teams and entry fees from the Team Registration tab.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
