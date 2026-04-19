import React, { useState } from "react";
import { apiClient } from "@/api/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Package, Pencil, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ProductFormDialog from "@/components/products/ProductFormDialog";

const statusColors = {
  active: "bg-emerald-50 text-emerald-700",
  inactive: "bg-gray-100 text-gray-500",
  out_of_stock: "bg-red-50 text-red-700",
};

const categoryColors = {
  food: "bg-orange-50 text-orange-700",
  beverage: "bg-blue-50 text-blue-700",
  clothing: "bg-pink-50 text-pink-700",
  medicine: "bg-red-50 text-red-700",
  equipment: "bg-gray-100 text-gray-600",
  accessories: "bg-purple-50 text-purple-700",
  other: "bg-gray-100 text-gray-500",
};

export default function ProductsList() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => apiClient.entities.Product.list("-created_date"),
  });

  const categories = ["all", ...new Set(products.map((p) => p.category).filter(Boolean))];

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.includes(search);
    const matchCat = filterCat === "all" || p.category === filterCat;
    return matchSearch && matchCat;
  });

  const handleDelete = async (id) => {
    if (!confirm("Delete this product?")) return;
    await apiClient.entities.Product.delete(id);
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-sm text-gray-400 mt-0.5">{products.length} products in inventory</p>
        </div>
        <Button onClick={() => { setEditProduct(null); setShowForm(true); }} className="bg-violet-600 hover:bg-violet-700">
          <Plus className="w-4 h-4 mr-2" /> Add Product
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-64" />
        </div>
        <Tabs value={filterCat} onValueChange={setFilterCat}>
          <TabsList className="bg-gray-100 flex-wrap h-auto">
            {categories.map((c) => (
              <TabsTrigger key={c} value={c} className="text-xs capitalize">{c}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">No products found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <Card key={p.id} className="border-0 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
              <div className="h-32 bg-gray-50 flex items-center justify-center relative">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-10 h-10 text-gray-200" />
                )}
                <Badge className={`absolute top-2 right-2 text-[10px] ${statusColors[p.status] || ""}`}>
                  {p.status?.replace(/_/g, " ")}
                </Badge>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{p.name}</h3>
                    <Badge className={`text-[10px] mt-1 ${categoryColors[p.category] || ""}`}>{p.category}</Badge>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditProduct(p); setShowForm(true); }} className="p-1 hover:bg-gray-100 rounded-lg">
                      <Pencil className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-1 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <div>
                    <span className="text-lg font-bold text-gray-900">৳{p.price?.toLocaleString()}</span>
                    {p.cost_price > 0 && <span className="text-[10px] text-gray-400 block">Cost: ৳{p.cost_price}</span>}
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${p.stock <= (p.low_stock_alert || 5) ? "text-amber-600" : "text-gray-700"}`}>
                      {p.stock} {p.unit}
                    </p>
                    <p className="text-[10px] text-gray-400">in stock</p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ProductFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        product={editProduct}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["products"] })}
      />
    </div>
  );
}
