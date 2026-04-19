import React, { useState } from "react";
import { apiClient } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import TurfCard from "@/components/turfs/TurfCard";
import TurfFormDialog from "@/components/turfs/TurfFormDialog";

export default function Turfs() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editTurf, setEditTurf] = useState(null);

  const { data: turfs = [], isLoading } = useQuery({
    queryKey: ["turfs"],
    queryFn: () => apiClient.entities.Turf.list("-created_date"),
  });

  const handleEdit = (turf) => {
    setEditTurf(turf);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Turfs</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage your football turfs</p>
        </div>
        <Button
          onClick={() => { setEditTurf(null); setShowForm(true); }}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Turf
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : turfs.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400">No turfs yet. Add your first turf to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {turfs.map((turf) => (
            <TurfCard key={turf.id} turf={turf} onClick={handleEdit} />
          ))}
        </div>
      )}

      <TurfFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        turf={editTurf}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["turfs"] })}
      />
    </div>
  );
}
