import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";
import {
  LayoutDashboard,
  Calendar,
  MapPin,
  CreditCard,
  Users,
  Trophy,
  Menu,
  ArrowLeftRight,
  Book,
  FileText,
  Briefcase,
  TrendingDown,
  TrendingUp,
  Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const standardNavItems = [
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Turfs", icon: MapPin, page: "Turfs" },
  { name: "Bookings", icon: Calendar, page: "Bookings" },
  { name: "Payments", icon: CreditCard, page: "Payments" },
  { name: "Customers", icon: Users, page: "Customers" },
  { name: "Tournaments", icon: Trophy, page: "Tournaments" },
];

const adminOnlyNavItems = [
  { name: "Reports", icon: FileText, page: "Reports" },
  { name: "Accounts", icon: Landmark, page: "Accounts" },
  { name: "Ledger", icon: Book, page: "Ledger" },
  { name: "Expenses", icon: TrendingDown, page: "Expenses" },
  { name: "Incomes", icon: TrendingUp, page: "Incomes" },
  { name: "Partners", icon: Briefcase, page: "Partners" },
  { name: "Users", icon: Users, page: "Users" },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const isDesktopApp =
    typeof navigator !== "undefined" &&
    navigator.userAgent.includes("Electron");
  
  let visibleNavItems = [...standardNavItems];
  if (user?.role === "admin") {
    visibleNavItems = [...visibleNavItems, ...adminOnlyNavItems];
  }

  if (isDesktopApp) {
    visibleNavItems = visibleNavItems.filter((item) => item.page !== "Users");
  }

  const openAdminDetails = () => {
    if (!user) return;
    const userId = user.id || user._id;
    if (!userId) return;
    navigate(`/Users?edit=${encodeURIComponent(userId)}&r=${Date.now()}`);
  };

  if (currentPageName === "PublicBooking") {
    return <>{children}</>;
  }

  // If not authenticated and not loading, only show content (to prevent sidebar flash on login/public pages)
  if (!isAuthenticated && !isLoadingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        {children}
      </div>
    );
  }

  const isAdmin = user?.role === "admin";
  const isAdminOnlyPage = adminOnlyNavItems.some(item => item.page === currentPageName);

  if (!isAdmin && isAdminOnlyPage && !isLoadingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
          <p className="text-gray-500 mt-2 mb-6">You don't have permission to access the {currentPageName} page.</p>
          <Button onClick={() => navigate('/')} className="w-full">Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <style>{`
        :root {
          --brand: #059669;
          --brand-dark: #047857;
          --brand-light: #d1fae5;
        }
      `}</style>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white border-r border-gray-200 
        transform transition-transform duration-200 ease-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0
        flex flex-col
      `}
      >
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">TS</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900 text-lg tracking-tight">
                TurfSlot
              </h1>
              <p className="text-[11px] text-gray-400 -mt-0.5">
                Management Platform
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  }
                `}
              >
                <item.icon
                  className={`w-[18px] h-[18px] ${isActive ? "text-emerald-600" : ""}`}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <Link
            to="/ProductsDashboard"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-violet-50 hover:text-violet-700 transition-all"
          >
            <ArrowLeftRight className="w-[18px] h-[18px]" />
            Switch to Products
          </Link>
        </div>

        <div className="p-3 border-t border-gray-100">
          {user && (
            <button
              type="button"
              onClick={openAdminDetails}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-emerald-50 transition-all text-left"
              title="Edit admin details"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden bg-emerald-100 flex items-center justify-center shrink-0">
                {user.image_url ? (
                  <img
                    src={user.image_url}
                    alt={user.full_name || "Admin"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-emerald-700 text-xs font-semibold">
                    {(user.full_name || "A")[0]?.toUpperCase() || "A"}
                  </span>
                )}
              </div>
              <span className="text-sm font-medium text-gray-700 truncate">
                {user.full_name || "Admin"}
              </span>
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 lg:px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden lg:block">
            <h2 className="text-sm font-semibold text-gray-800">
              {currentPageName}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification button commented out as requested
            <Button variant="ghost" size="icon" className="relative text-gray-400 hover:text-gray-600">
              <Bell className="w-[18px] h-[18px]" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full" />
            </Button>
            */}
            <div className="w-8 h-8 rounded-full overflow-hidden bg-emerald-50 flex items-center justify-center cursor-default">
              <div className="w-6 h-6 rounded-full overflow-hidden bg-emerald-50 flex items-center justify-center">
                {user?.image_url ? (
                  <img
                    src={user.image_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[10px] font-bold text-emerald-600">
                    {user?.full_name?.[0] || "U"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
