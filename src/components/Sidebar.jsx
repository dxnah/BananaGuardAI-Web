import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import {
  LayoutDashboard, ScanLine, Video, Map, Users,
  Bell, Settings, LogOut
} from "lucide-react";

const links = [
  { to: "/",              icon: <LayoutDashboard size={18} />, label: "Dashboard" },
  { to: "/detections",    icon: <ScanLine size={18} />,        label: "UAV Detections" },
  { to: "/live",          icon: <Video size={18} />,           label: "Live" },
  { to: "/map",           icon: <Map size={18} />,             label: "Farm Map" },
  { to: "/farmers",       icon: <Users size={18} />,           label: "Farmers" },
  { to: "/notifications", icon: <Bell size={18} />,            label: "Notifications" },
  { to: "/settings",      icon: <Settings size={18} />,        label: "Settings" },
];

function getInitials(username = "") {
  const parts = username.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
}

export default function Sidebar({ admin, onLogout }) {
  const [showConfirm, setShowConfirm] = useState(false);

  const initials    = getInitials(admin?.username || "");
  const displayName = admin?.username || "Admin";

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-forest flex flex-col z-50">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Link to="/">
            <img src="/src/assets/icon.bgai.png" alt="BananaGuard AI" className="w-10 h-10" />
          </Link>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">BananaGuard AI</p>
            <p className="text-white/50 text-xs">Talakag Banana Farm</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`
            }
          >
            {l.icon}
            {l.label}
          </NavLink>
        ))}
      </nav>

      {/* User Profile */}
      <div className="px-4 py-5 border-t border-white/10">
        <button
          onClick={() => setShowConfirm(true)}
          className="w-full flex items-center gap-3 hover:bg-white/10 rounded-lg px-2 py-1.5 transition-all group"
        >
          <div className="w-9 h-9 rounded-full bg-amber flex items-center justify-center text-white font-semibold text-xs shrink-0">
            {initials}
          </div>
          <div className="flex-1 overflow-hidden text-left">
            <p className="text-white text-xs font-medium truncate capitalize">{displayName}</p>
            <p className="text-white/50 text-xs">Admin</p>
          </div>
          <LogOut size={14} className="text-white/30 group-hover:text-white/70 shrink-0 transition-colors" />
        </button>
      </div>

      {/* Logout Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-xs shadow-xl p-6 text-center">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogOut size={20} className="text-red-500" />
            </div>
            <h2 className="text-base font-semibold text-charcoal mb-1">Sign out?</h2>
            <p className="text-sm text-gray-400 mb-6">
              You'll need to log in again to access the admin panel.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onLogout}
                className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}