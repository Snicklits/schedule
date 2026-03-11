import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.js";
import { useCompany } from "../contexts/CompanyContext.js";
import { useState } from "react";

interface NavItem { to: string; icon: string; label: string }

const MAIN_LINKS: NavItem[] = [
  { to: "/", icon: "⊞", label: "Dashboard" },
  { to: "/schedule", icon: "📅", label: "Schedule" },
  { to: "/generate", icon: "⚡", label: "Generate" },
  { to: "/employees", icon: "👥", label: "Employees" },
];
const REPORT_LINKS: NavItem[] = [
  { to: "/time-off", icon: "🕐", label: "Time Off" },
  { to: "/hours", icon: "📊", label: "Hours" },
  { to: "/alerts", icon: "🔔", label: "Alerts" },
];
const EXTRA_LINKS: NavItem[] = [
  { to: "/events", icon: "📌", label: "Events" },
  { to: "/payroll", icon: "💷", label: "Payroll" },
];
const CONFIG_LINKS: NavItem[] = [
  { to: "/settings", icon: "⚙️", label: "Settings" },
  { to: "/company", icon: "🏢", label: "Company" },
];

function SideLink({ to, icon, label, exact }: { to: string; icon: string; label: string; exact?: boolean }) {
  return (
    <NavLink
      to={to}
      end={exact}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
          isActive ? "bg-indigo-600 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"
        }`
      }
    >
      <span>{icon}</span>{label}
    </NavLink>
  );
}

export function NavBar() {
  const { logout, employeeName, role } = useAuth();
  const { config } = useCompany();
  const [lightMode, setLightMode] = useState(false);
  const companyName = config?.company_name ?? "ScheduleMgr";
  const initials = (employeeName || "M").split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <nav className="w-56 bg-gray-900 text-white flex flex-col shrink-0 h-full overflow-y-auto">
      <div className="px-4 py-4 border-b border-gray-700">
        <div className="flex items-center gap-2 mb-0.5">
          {config?.logo_url
            ? <img src={config.logo_url} alt="logo" className="w-6 h-6 rounded object-contain bg-white" />
            : <div className="w-6 h-6 rounded bg-indigo-500 flex items-center justify-center text-xs font-bold">{companyName[0]}</div>
          }
          <span className="font-bold text-sm">{companyName}</span>
        </div>
        <p className="text-xs text-gray-400 pl-8">Manager Portal</p>
      </div>

      <div className="px-4 py-4 flex flex-col items-center border-b border-gray-700">
        <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center text-lg font-bold">{initials}</div>
        <p className="mt-2 font-semibold text-sm text-center">{employeeName || "Manager"}</p>
        <p className="text-xs text-gray-400 capitalize">{role.replace(/_/g, " ").toLowerCase()}</p>
      </div>

      <div className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1 px-1">MAIN</p>
          <div className="space-y-0.5">
            {MAIN_LINKS.map((l) => <SideLink key={l.to} {...l} exact={l.to === "/"} />)}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1 px-1">REPORTS</p>
          <div className="space-y-0.5">
            {REPORT_LINKS.map((l) => <SideLink key={l.to} {...l} />)}
          </div>
        </div>
        <div className="space-y-0.5">
          {EXTRA_LINKS.map((l) => <SideLink key={l.to} {...l} />)}
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1 px-1">CONFIGURATION</p>
          <div className="space-y-0.5">
            {CONFIG_LINKS.map((l) => <SideLink key={l.to} {...l} />)}
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-gray-700 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Light mode</span>
          <button
            onClick={() => setLightMode(!lightMode)}
            className={`w-9 h-5 rounded-full transition-colors relative ${lightMode ? "bg-indigo-500" : "bg-gray-600"}`}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transform transition-transform ${lightMode ? "left-4" : "left-0.5"}`} />
          </button>
        </div>
        <button onClick={logout} className="flex items-center gap-2 w-full text-sm text-gray-400 hover:text-white py-1">
          <span>↩</span> Sign out
        </button>
      </div>
    </nav>
  );
}

export function InitialsAvatarSmall({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) return <img src={avatarUrl} alt={name} className="w-8 h-8 rounded-full object-cover" />;
  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
      {initials}
    </div>
  );
}
