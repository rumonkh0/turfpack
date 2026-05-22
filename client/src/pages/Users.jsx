import React, { useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  Search,
  Shield,
  Trash2,
  MoreVertical,
  Edit,
  Loader2,
  Camera,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "react-hot-toast";

export default function UsersManagement() {
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "user",
    image_url: "",
    image_public_id: "",
  });
  const [uploading, setUploading] = useState(false);
  const desktopFormInitialized = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const editUserId = searchParams.get("edit");
  const editRefreshKey = searchParams.get("r");
  const isDesktop =
    typeof navigator !== "undefined" && /Electron/.test(navigator.userAgent);
  const { user: authUser, setUser } = useAuth();

  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.entities.User.list(),
  });

  const desktopSourceUser = isDesktop
    ? authUser || users.find((u) => u.role === "admin") || users[0] || null
    : null;

  console.log("[Users] Render. formData:", formData, "initialized:", desktopFormInitialized.current);

  // When users are loaded, pick the admin for editing
  useEffect(() => {
    console.log("[Users] useEffect fired", {
      isDesktop,
      desktopSourceUser: !!desktopSourceUser,
      initialized: desktopFormInitialized.current
    });
    if (isDesktop && desktopSourceUser && !desktopFormInitialized.current) {
      desktopFormInitialized.current = true;
      console.log("[Users] Initializing desktop form with:", desktopSourceUser);
      setEditingUser(desktopSourceUser);
      setFormData({
        full_name: desktopSourceUser.full_name || "",
        email: desktopSourceUser.email || "",
        password: "",
        role: desktopSourceUser.role || "user",
        image_url: desktopSourceUser.image_url || "",
        image_public_id: desktopSourceUser.image_public_id || "",
      });
    }
  }, [desktopSourceUser, isDesktop]);

  useEffect(() => {
    if (saveState !== "saved") return undefined;

    const timer = setTimeout(() => setSaveState("idle"), 1800);
    return () => clearTimeout(timer);
  }, [saveState]);

  // For web: handle edit param from URL
  useEffect(() => {
    if (!isDesktop && editUserId && users.length) {
      const userToEdit = users.find(
        (user) => (user.id || user._id) === editUserId,
      );

      if (userToEdit) {
        setEditingUser(userToEdit);
        setFormData({
          full_name: userToEdit.full_name || "",
          email: userToEdit.email,
          password: "",
          role: userToEdit.role,
          image_url: userToEdit.image_url || "",
          image_public_id: userToEdit.image_public_id || "",
        });
        setIsDialogOpen(true);
      }
    }
  }, [editUserId, editRefreshKey, users, isDesktop]);

  const mutation = useMutation({
    mutationFn: (/** @type {any} */ data) =>
      editingUser
        ? apiClient.entities.User.update(
            editingUser.id || editingUser._id,
            data,
          )
        : apiClient.entities.User.create(data),
    onSuccess: async (updatedUser) => {
      setSaveState("saved");

      if (isDesktop && updatedUser) {
        setUser(updatedUser);
      }

      queryClient.setQueryData(["users"], (currentUsers) => {
        const usersList = Array.isArray(currentUsers) ? currentUsers : [];
        return usersList.map((user) =>
          (user.id || user._id) === (updatedUser.id || updatedUser._id)
            ? updatedUser
            : user,
        );
      });

      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.refetchQueries({ queryKey: ["users"] });

      toast.success(editingUser ? "User updated" : "User created");

      // For desktop: refresh the admin user; for web: close dialog
      if (isDesktop && updatedUser) {
        setEditingUser(updatedUser);
        desktopFormInitialized.current = true;
        setFormData({
          full_name: updatedUser.full_name || "",
          email: updatedUser.email || "",
          password: "",
          role: updatedUser.role || "user",
          image_url: updatedUser.image_url || "",
          image_public_id: updatedUser.image_public_id || "",
        });
      } else {
        setIsDialogOpen(false);
        setEditingUser(null);
        setFormData({
          full_name: "",
          email: "",
          password: "",
          role: "user",
          image_url: "",
          image_public_id: "",
        });
      }
    },
    onError: (error) => {
      setSaveState("error");
      toast.error(error.message);
    },
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
      u.email?.toLowerCase().includes(search.toLowerCase()),
  );

  const handleEdit = (user) => {
    desktopFormInitialized.current = true;
    setEditingUser(user);
    setFormData({
      full_name: user.full_name || "",
      email: user.email,
      password: "",
      role: user.role,
      image_url: user.image_url || "",
      image_public_id: user.image_public_id || "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSaveState("saving");
    const formValues = new FormData(e.currentTarget);
    const payload = {
      ...formData,
      full_name: formValues.get("full_name") || formData.full_name,
      email: formValues.get("email") || formData.email,
    };
    // If password is empty: for updates remove it, for creates provide a default
    if (!payload.password) {
      if (!editingUser) {
        // Desktop and streamlined flows may omit password; set a safe default so create succeeds
        payload.password = "00000000";
      } else {
        delete payload.password;
      }
    }
    mutation.mutate(/** @type {any} */ (payload));
  };

  const handleDialogChange = (open) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingUser(null);
      setSearchParams({});
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url, public_id } =
        await apiClient.integrations.Core.UploadFile({ file });
      setFormData((prev) => ({
        ...prev,
        image_url: file_url,
        image_public_id: public_id,
      }));
      toast.success("Photo uploaded");
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Desktop: render only the edit form inline (no header, list or search)
  if (isDesktop) {
    const activeDesktopUser = editingUser || desktopSourceUser;

    console.log(
      "[Desktop] isLoading:",
      isLoading,
      "editingUser:",
      editingUser?.full_name,
      "users:",
      users.length,
    );

    // Show loading only while query/auth are in flight
    if (isLoading || !desktopSourceUser) {
      return (
        <div className="p-6 sm:py-10 sm:px-0 max-w-md mx-auto flex items-center justify-center min-h-96">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      );
    }

    // If query finished but no data, show error message
    if (!activeDesktopUser) {
      return (
        <div className="p-6 sm:py-10 sm:px-0 max-w-md mx-auto">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">
              Error: Could not load admin user. Check API connection.
            </p>
            <p className="text-xs text-red-600 mt-2">{!!editingUser}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="p-6 sm:py-10 sm:px-0 max-w-md mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {editingUser ? "Edit User" : "Edit Admin"}
          </h1>
          <p className="text-sm text-gray-500">
            Update profile and credentials
          </p>
          {saveState === "saved" && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Changes saved successfully.
            </div>
          )}
          {saveState === "error" && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Save failed. Please check the console or try again.
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input
              name="full_name"
              required
              value={formData.full_name || ""}
              onChange={(e) => {
                console.log("[Users] Name onChange called with:", e.target.value);
                setFormData((prev) => ({ ...prev, full_name: e.target.value }));
              }}
              placeholder="Ex: Sabbir Tanvir"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              name="email"
              required
              type="email"
              value={formData.email || ""}
              onChange={(e) => {
                console.log("[Users] Email onChange called with:", e.target.value);
                setFormData((prev) => ({ ...prev, email: e.target.value }));
              }}
              placeholder="email@turfslot.com"
              autoComplete="off"
            />
          </div>
          {/* password removed for desktop inline edit */}

          {/* Role selector hidden on desktop via earlier change */}

          <div className="space-y-2">
            <Label>Profile Photo</Label>
            <div className="flex items-center gap-4">
              <div className="relative group w-16 h-16 rounded-2xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center overflow-hidden">
                {formData.image_url ? (
                  <img
                    src={formData.image_url}
                    className="w-full h-full object-cover"
                  />
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
                <p className="text-[10px] text-gray-400 mt-1">
                  PNG, JPG up to 5MB
                </p>
              </div>
            </div>
          </div>
          <Button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8"
            disabled={mutation.isPending}
          >
            {mutation.isPending || saveState === "saving" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saveState === "saved" ? (
              "Saved"
            ) : editingUser ? (
              "Save Changes"
            ) : (
              "Save"
            )}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500">Manage admin and staff access</p>
        </div>
        {!isDesktop && (
          <Button
            onClick={() => {
              setEditingUser(null);
              setIsDialogOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            <UserPlus className="w-4 h-4" /> Add User
          </Button>
        )}
      </div>

      {!isDesktop && (
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
      )}

      {!isDesktop && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading
            ? [1, 2, 3].map((i) => (
                <Card key={i} className="h-40 animate-pulse bg-gray-50" />
              ))
            : filtered.map((user) => (
                <Card
                  key={user._id || user.id}
                  className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow group"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg overflow-hidden border border-emerald-100">
                          {user.image_url ? (
                            <img
                              src={user.image_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            user.full_name?.[0]?.toUpperCase()
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 truncate max-w-[150px]">
                            {user.full_name}
                          </h3>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400"
                          >
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
                              if (confirm("Are you sure?"))
                                deleteMutation.mutate(user._id || user.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-6 flex items-center justify-between">
                      <Badge
                        className={`
                  text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full
                  ${user.role === "admin" ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"}
                `}
                      >
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
      )}

      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit User" : "Add New User"}
            </DialogTitle>
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
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, full_name: e.target.value }))
                }
                placeholder="Ex: Sabbir Tanvir"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                required
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="email@turfslot.com"
              />
            </div>
            {/* password removed from dialog form */}
            {!isDesktop && (
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(val) =>
                    setFormData((prev) => ({ ...prev, role: val }))
                  }
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
            )}

            <div className="space-y-2">
              <Label>Profile Photo</Label>
              <div className="flex items-center gap-4">
                <div className="relative group w-16 h-16 rounded-2xl bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center overflow-hidden">
                  {formData.image_url ? (
                    <img
                      src={formData.image_url}
                      className="w-full h-full object-cover"
                    />
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
                  <p className="text-[10px] text-gray-400 mt-1">
                    PNG, JPG up to 5MB
                  </p>
                </div>
              </div>
            </div>
            <Button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : editingUser ? (
                "Save Changes"
              ) : (
                "Create User"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
