import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { LayoutDashboard, Package, ShoppingCart, Menu, LogOut, ChevronDown, Bell, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/ProductsDashboard" },
  { name: "Products", icon: Package, path: "/ProductsList" },
  { name: "Orders", icon: ShoppingCart, path: "/OrdersList" },
];

export default function ProductsLayout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isAuthenticated, logout, isLoadingAuth } = useAuth();

  // If not authenticated and not loading, only show content
  if (!isAuthenticated && !isLoadingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white border-r border-gray-200
        transform transition-transform duration-200 ease-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
        flex flex-col
      `}>
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">PS</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-lg tracking-tight">ProductStore</h1>
              <p className="text-[11px] text-gray-400 -mt-0.5">Management Platform</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = currentPageName === item.path.replace("/", "");
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${isActive ? "bg-violet-50 text-violet-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"}
                `}
              >
                <item.icon className={`w-[18px] h-[18px] ${isActive ? "text-violet-600" : ""}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Switch mode */}
        <div className="p-3 border-t border-gray-100">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-emerald-50 hover:text-emerald-700 transition-all"
          >
            <ArrowLeftRight className="w-[18px] h-[18px]" />
            Switch to Turf Management
          </Link>
        </div>

        <div className="p-3 border-t border-gray-100">
          {user && (
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-violet-100 flex items-center justify-center shrink-0">
                {user.image_url ? (
                  <img src={user.image_url} alt={user.full_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-violet-700 text-xs font-semibold">
                    {user.full_name?.[0] || user.email?.[0]?.toUpperCase() || "U"}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{user.full_name || "User"}</p>
                <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 lg:px-6 h-14 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700">
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden lg:block">
            <h2 className="text-sm font-semibold text-gray-800">{currentPageName}</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Notification button commented out as requested
            <Button variant="ghost" size="icon" className="relative text-gray-400 hover:text-gray-600">
              <Bell className="w-[18px] h-[18px]" />
            </Button>
            */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-gray-500 gap-1 hover:bg-gray-100">
                  <div className="w-6 h-6 rounded-full overflow-hidden bg-violet-50 flex items-center justify-center">
                    {user?.image_url ? (
                      <img src={user.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold text-violet-600">
                        {user?.full_name?.[0] || "U"}
                      </span>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => logout()} className="text-red-600 focus:text-red-600 cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
