import React, { useState } from "react";
import { apiClient } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Plus, Trophy, Users, Calendar, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors = {
  upcoming: "bg-blue-50 text-blue-700",
  registration_open: "bg-emerald-50 text-emerald-700",
  in_progress: "bg-amber-50 text-amber-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-50 text-red-700",
};

export default function Tournaments() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", turf_id: "", turf_name: "", start_date: "", end_date: "",
    max_teams: 8, entry_fee: 5000, prize_pool: 20000, status: "upcoming",
    format: "knockout", description: "", rules: "", teams: [],
  });

  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ["tournaments"],
    queryFn: () => apiClient.entities.Tournament.list("-created_date"),
  });
  const { data: turfs = [] } = useQuery({
    queryKey: ["turfs"],
    queryFn: () => apiClient.entities.Turf.list(),
  });

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const t = turfs.find((t) => t.id === form.turf_id);
    await apiClient.entities.Tournament.create({ ...form, turf_name: t?.name || "" });
    setSaving(false);
    setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ["tournaments"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tournaments</h1>
          <p className="text-sm text-gray-400 mt-0.5">Organize and manage tournaments</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" /> Create Tournament
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : tournaments.length === 0 ? (
        <div className="text-center py-20">
          <Trophy className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">No tournaments yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tournaments.map((t) => (
            <Card key={t.id} className="border-0 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{t.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{t.turf_name} · {t.format}</p>
                </div>
                <Badge className={`text-[10px] ${statusColors[t.status] || ""}`}>
                  {t.status?.replace(/_/g, " ")}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <Calendar className="w-4 h-4 mx-auto text-gray-400 mb-1" />
                  <p className="text-xs font-medium text-gray-700">
                    {t.start_date ? format(new Date(t.start_date), "MMM d") : "TBD"}
                  </p>
                  <p className="text-[10px] text-gray-400">Start</p>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <Users className="w-4 h-4 mx-auto text-gray-400 mb-1" />
                  <p className="text-xs font-medium text-gray-700">
                    {t.teams?.length || 0}/{t.max_teams}
                  </p>
                  <p className="text-[10px] text-gray-400">Teams</p>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <Trophy className="w-4 h-4 mx-auto text-amber-400 mb-1" />
                  <p className="text-xs font-medium text-gray-700">৳{t.prize_pool?.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400">Prize</p>
                </div>
              </div>
              {t.description && (
                <p className="text-xs text-gray-500 line-clamp-2">{t.description}</p>
              )}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                <span className="text-xs text-gray-400">Entry: ৳{t.entry_fee?.toLocaleString()}/team</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Tournament</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tournament Name</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Champions Cup 2026" />
            </div>
            <div>
              <Label>Turf</Label>
              <Select value={form.turf_id} onValueChange={(v) => set("turf_id", v)}>
                <SelectTrigger><SelectValue placeholder="Select turf" /></SelectTrigger>
                <SelectContent>
                  {turfs.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} /></div>
              <div><Label>End Date</Label><Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Max Teams</Label><Input type="number" value={form.max_teams} onChange={(e) => set("max_teams", Number(e.target.value))} /></div>
              <div><Label>Entry Fee (৳)</Label><Input type="number" value={form.entry_fee} onChange={(e) => set("entry_fee", Number(e.target.value))} /></div>
              <div><Label>Prize Pool (৳)</Label><Input type="number" value={form.prize_pool} onChange={(e) => set("prize_pool", Number(e.target.value))} /></div>
            </div>
            <div>
              <Label>Format</Label>
              <Select value={form.format} onValueChange={(v) => set("format", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="knockout">Knockout</SelectItem>
                  <SelectItem value="league">League</SelectItem>
                  <SelectItem value="group_stage">Group Stage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name || !form.turf_id} className="bg-emerald-600 hover:bg-emerald-700">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
