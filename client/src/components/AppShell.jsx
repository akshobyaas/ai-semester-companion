import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, LogOut, GraduationCap, Settings, Menu, X } from "lucide-react";
import { useAppStore } from "../store/useAppStore.js";

/**
 * Responsive: a persistent sidebar on md+ screens, collapsed behind a
 * hamburger + slide-in overlay below that — fixes the confirmed mobile
 * overflow gap (the old fixed w-60 sidebar squeezed content on narrow
 * screens with no way to hide it).
 */
export default function AppShell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    navigate("/auth");
  };

  const navLinkClass = (path) =>
    `flex items-center gap-3 px-4 py-3 rounded-2xl font-medium transition ${
      location.pathname === path ? "bg-primary-50 text-primary-700" : "text-ink-600 hover:bg-primary-50"
    }`;

  const SidebarContent = () => (
    <>
      <Link to="/dashboard" className="flex items-center gap-2 px-6 py-6 border-b border-primary-100">
        <div className="w-9 h-9 rounded-xl bg-primary-500 text-white flex items-center justify-center">
          <GraduationCap size={20} />
        </div>
        <span className="font-display font-bold text-ink-900">Semester AI</span>
      </Link>

      <nav className="flex-1 p-4 space-y-1">
        <Link to="/dashboard" className={navLinkClass("/dashboard")} onClick={() => setMobileOpen(false)}>
          <Home size={18} />
          My Courses
        </Link>
        <Link to="/settings" className={navLinkClass("/settings")} onClick={() => setMobileOpen(false)}>
          <Settings size={18} />
          Settings
        </Link>
      </nav>

      <div className="p-4 border-t border-primary-100">
        {user && (
          <div className="px-2 mb-2">
            <p className="text-sm font-medium text-ink-900 truncate">{user.full_name}</p>
            <p className="text-xs text-ink-400 truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-ink-600 hover:bg-red-50 hover:text-red-600 transition w-full"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-cream flex flex-col md:flex-row">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-primary-100 sticky top-0 z-20">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-500 text-white flex items-center justify-center">
            <GraduationCap size={16} />
          </div>
          <span className="font-display font-bold text-ink-900 text-sm">Semester AI</span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="p-2 rounded-xl text-ink-600 hover:bg-primary-50"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile slide-in overlay menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 max-w-[85%] bg-white flex flex-col h-full">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="absolute top-4 right-4 p-2 rounded-xl text-ink-600 hover:bg-primary-50"
            >
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Desktop persistent sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 bg-white border-r border-primary-100 flex-col">
        <SidebarContent />
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
    </div>
  );
}
