import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Shield, Loader2, DollarSign } from "lucide-react";
import { apiClient } from "@/api/client";
import { toast } from "sonner";

export default function TeamManager({ tournament, onUpdate }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", captain_name: "", captain_phone: "", paid: false });
  const [processing, setProcessing] = useState(null);

  const teams = tournament.teams || [];
  const isFull = teams.length >= tournament.max_teams;

  const handleAdd = async () => {
    if (!form.name || !form.captain_name) return toast.error("Team name and captain required");
    if (isFull) return toast.error("Tournament is full");
    
    setProcessing("add");
    try {
      const newTeams = [...teams, { ...form }];
      const updated = await apiClient.entities.Tournament.update(tournament.id, { teams: newTeams });
      onUpdate(updated);
      setForm({ name: "", captain_name: "", captain_phone: "", paid: false });
      setAdding(false);
      toast.success("Team added successfully");
    } catch (err) {
      toast.error(err.message || "Failed to add team");
    } finally {
      setProcessing(null);
    }
  };

  const handleRemove = async (index) => {
    if (!confirm("Remove this team?")) return;
    setProcessing(`remove-${index}`);
    try {
      const newTeams = teams.filter((_, i) => i !== index);
      const updated = await apiClient.entities.Tournament.update(tournament.id, { teams: newTeams });
      onUpdate(updated);
      toast.success("Team removed");
    } catch (err) {
      toast.error("Failed to remove team");
    } finally {
      setProcessing(null);
    }
  };

  const togglePaid = async (index) => {
    setProcessing(`paid-${index}`);
    try {
      const newTeams = [...teams];
      newTeams[index] = { ...newTeams[index], paid: !newTeams[index].paid };
      const updated = await apiClient.entities.Tournament.update(tournament.id, { teams: newTeams });
      onUpdate(updated);
      toast.success(newTeams[index].paid ? "Marked as paid" : "Marked as unpaid");
    } catch (err) {
      toast.error("Failed to update status");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Registered Teams</h2>
        <Button 
          onClick={() => setAdding(!adding)} 
          disabled={isFull}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Team
        </Button>
      </div>

      {adding && (
        <Card className="p-4 border-emerald-100 bg-emerald-50/50 mb-4 animate-in fade-in slide-in-from-top-2">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <Label className="text-emerald-900">Team Name</Label>
              <Input 
                value={form.name} 
                onChange={e => setForm({...form, name: e.target.value})} 
                placeholder="FC Barcelona"
                className="bg-white"
              />
            </div>
            <div>
              <Label className="text-emerald-900">Captain Name</Label>
              <Input 
                value={form.captain_name} 
                onChange={e => setForm({...form, captain_name: e.target.value})} 
                placeholder="Lionel Messi"
                className="bg-white"
              />
            </div>
            <div>
              <Label className="text-emerald-900">Contact Number</Label>
              <Input 
                value={form.captain_phone} 
                onChange={e => setForm({...form, captain_phone: e.target.value})} 
                placeholder="01700000000"
                className="bg-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleAdd} disabled={processing === "add"} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                {processing === "add" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Team"}
              </Button>
              <Button variant="ghost" onClick={() => setAdding(false)} className="text-gray-500">Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {teams.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Shield className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No teams registered yet</p>
          <p className="text-sm text-gray-400 mt-1">Click 'Add Team' to register the first participant.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden border-0 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="px-4 py-3">Team</th>
                  <th className="px-4 py-3">Captain</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Payment Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {teams.map((team, index) => (
                  <tr key={index} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {team.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {team.captain_name}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {team.captain_phone || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => togglePaid(index)}
                        disabled={processing === `paid-${index}`}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          team.paid 
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" 
                            : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                        }`}
                      >
                        {processing === `paid-${index}` ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <DollarSign className="w-3 h-3" />
                        )}
                        {team.paid ? "Paid" : "Unpaid"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(index)}
                        disabled={processing === `remove-${index}`}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        {processing === `remove-${index}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
