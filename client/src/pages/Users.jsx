import React, { useState } from "react";
import { apiClient } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Users, UserPlus, Search, Shield, Mail, Trash2, 
  MoreVertical, Edit, Loader2, CheckCircle2, Camera 
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "react-hot-toast";

export default function UsersManagement() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ full_name: "", email: "", password: "", role: "user", image_url: "", image_public_id: "" });
  const [uploading, setUploading] = useState(false);

  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.entities.User.list(),
  });

  const mutation = useMutation({
    mutationFn: (data) => 
      editingUser 
        ? apiClient.entities.User.update(editingUser.id || editingUser._id, data)
        : apiClient.entities.User.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setIsDialogOpen(false);
      setEditingUser(null);
      setFormData({ full_name: "", email: "", password: "", role: "user", image_url: "", image_public_id: "" });
      toast.success(editingUser ? "User updated" : "User created");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.entities.User.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User deleted");
    },
  });

  const filtered = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({ 
      full_name: user.full_name || "",
      email: user.email, 
      password: "", 
      role: user.role,
      image_url: user.image_url || "",
      image_public_id: user.image_public_id || ""
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...formData };
    if (editingUser && (payload.password === "" || !payload.password)) {
      delete payload.password;
    }
    mutation.mutate(payload);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url, public_id } = await apiClient.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, image_url: file_url, image_public_id: public_id }));
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500">Manage admin and staff access</p>
        </div>
        <Button 
          onClick={() => { setEditingUser(null); setIsDialogOpen(true); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        >
          <UserPlus className="w-4 h-4" /> Add User
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="Search users..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-gray-50 border-gray-100 focus:bg-white transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          [1, 2, 3].map(i => <Card key={i} className="h-40 animate-pulse bg-gray-50" />)
        ) : filtered.map((user) => (
          <Card key={user._id || user.id} className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow group">
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg overflow-hidden border border-emerald-100">
                    {user.image_url ? (
                      <img src={user.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      user.full_name?.[0]?.toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 truncate max-w-[150px]">
                      {user.full_name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <Mail className="w-3 h-3" />
                      {user.email}
                    </div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(user)}>
                      <Edit className="w-4 h-4 mr-2" /> Edit Details
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-red-600"
                      onClick={() => {
                        if(confirm("Are you sure?")) deleteMutation.mutate(user._id || user.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete User
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <Badge className={`
                  text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full
                  ${user.role === 'admin' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}
                `}>
                  {user.role}
                </Badge>
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Shield className="w-3 h-3" />
                  System Access
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
            <DialogDescription>
              Set permissions and credentials for system access.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input 
                required
                value={formData.full_name}
                onChange={e => setFormData({...formData, full_name: e.target.value})}
                placeholder="Ex: Sabbir Tanvir"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                required
                type="email"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                placeholder="email@turfslot.com"
              />
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label>Password</Label>
                <Input 
                  required
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  placeholder="Min 6 characters"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Role</Label>
              <Select 
                value={formData.role} 
                onValueChange={val => setFormData({...formData, role: val})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Manager</SelectItem>
                  <SelectItem value="admin">Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Profile Photo</Label>
              <div className="flex items-center gap-4">
                <div className="relative group w-16 h-16 rounded-2xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center overflow-hidden">
                  {formData.image_url ? (
                    <img src={formData.image_url} className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-6 h-6 text-gray-300" />
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <Input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageUpload}
                    className="cursor-pointer text-xs"
                    disabled={uploading}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">PNG, JPG up to 5MB</p>
                </div>
              </div>
            </div>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingUser ? "Save Changes" : "Create User")}
              </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
