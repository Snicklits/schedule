/**
 * Sidebar — fixed 220px left sidebar for the manager interface.
 *
 * Phase 9 additions:
 *   - Loads company branding (name + logo) on mount
 *   - New nav links: Events, Payroll, Company Settings
 */

import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.js";
import { useAlerts } from "../contexts/AlertsContext.js";
import { useState, useEffect } from "react";
import { fetchCompanyConfig } from "../api/endpoints.js";
import type { CompanyConfig } from "../api/types.js";

// ─── Icons (inline SVG wrappers) ─────────────────────────────────────────────

function Icon({ path, className = "w-4 h-4" }: { path: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  grid:      "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  wand:      "M15 4V2m0 14v-2M8 9H2m14 0h-2m-5.657-4.243L6.929 3.343M17.071 17.071l-1.414-1.414M8 17.071l-1.414 1.414M17.071 6.929l-1.414-1.414M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  users:     "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  clock:     "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  calendar:  "M3 4h18v18H3zM16 2v4M8 2v4M3 10h18",
  chart:     "M18 20V10M12 20V4M6 20v-6",
  cog:       "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  logout:    "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  sun:       "M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 5a7 7 0 1 0 0 14A7 7 0 0 0 12 5z",
  alert:     "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  star:      "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  cash:      "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  building:  "M3 21h18M5 21V7l7-4 7 4v14M9 21V12h6v9",
};

interface NavItemProps {
  to: string;
  iconPath: string;
  label: string;
  badge?: number;
}

function NavItem({ to, iconPath, label, badge }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 group ${
          isActive
            ? "bg-indigo-50 text-indigo-700"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`flex-shrink-0 transition-colors ${isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"}`}>
            <Icon path={iconPath} className="w-4 h-4" />
          </span>
          <span className="flex-1">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span className="flex-shrink-0 h-5 min-w-[1.25rem] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
          {isActive && !badge && (
            <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500" />
          )}
        </>
      )}
    </NavLink>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 select-none">
      {label}
    </p>
  );
}

export function Sidebar() {
  const { logout } = useAuth();
  const { violations, gaps } = useAlerts();
  const navigate = useNavigate();
  const [company, setCompany] = useState<CompanyConfig | null>(null);

  useEffect(() => {
    fetchCompanyConfig().then(setCompany).catch(() => {});
  }, []);

  const alertCount = violations.filter((v) => v.type === "BLOCKING").length + gaps.length;
  const totalStaff = 13; // approximate — sidebar stat

  const companyName = company?.company_name ?? "ScheduleMgr";
  const logoUrl = company?.logo_url;

  return (
    <aside className="w-[220px] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col h-full overflow-y-auto">
      {/* ── Brand ── */}
      <div className="px-4 pt-5 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="w-8 h-8 rounded-lg object-contain flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Icon path={ICONS.grid} className="w-4 h-4 text-white" />
            </div>
          )}
          <div className="leading-tight min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{companyName}</p>
            <p className="text-[10px] text-slate-400">Manager Portal</p>
          </div>
        </div>
      </div>

      {/* ── Avatar block ── */}
      <div className="px-4 py-4 border-b border-slate-100">
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-lg select-none shadow-sm">
            JR
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-900">Jordan Rivera</p>
            <p className="text-xs text-slate-400">Store Manager</p>
          </div>
          {/* 3-item stat row */}
          <div className="w-full grid grid-cols-3 gap-1 pt-1">
            {[
              { label: "Staff", value: totalStaff },
              { label: "Shifts", value: 24 },
              { label: "Alerts", value: alertCount },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col items-center p-1.5 rounded-lg bg-slate-50">
                <span className="text-sm font-bold text-slate-800">{value}</span>
                <span className="text-[10px] text-slate-400">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 py-2">
        <SectionLabel label="Main" />
        <div className="space-y-0.5">
          <NavItem to="/" iconPath={ICONS.grid} label="Dashboard" />
          <NavItem to="/schedule" iconPath={ICONS.calendar} label="Schedule" />
          <NavItem to="/generate" iconPath={ICONS.wand} label="Generate" />
          <NavItem to="/employees" iconPath={ICONS.users} label="Employees" />
        </div>

        <SectionLabel label="Reports" />
        <div className="space-y-0.5">
          <NavItem to="/time-off" iconPath={ICONS.clock} label="Time Off" />
          <NavItem to="/hours" iconPath={ICONS.chart} label="Hours" />
          <NavItem to="/alerts" iconPath={ICONS.alert} label="Alerts" badge={alertCount} />
          <NavItem to="/events" iconPath={ICONS.star} label="Events" />
          <NavItem to="/payroll" iconPath={ICONS.cash} label="Payroll" />
        </div>

        <SectionLabel label="Configuration" />
        <div className="space-y-0.5">
          <NavItem to="/settings" iconPath={ICONS.cog} label="Settings" />
          <NavItem to="/company" iconPath={ICONS.building} label="Company" />
        </div>
      </nav>

      {/* ── Bottom ── */}
      <div className="px-3 py-3 border-t border-slate-100 space-y-1">
        {/* Light/dark toggle (visual only) */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 text-xs text-slate-500">
          <span className="flex items-center gap-2">
            <Icon path={ICONS.sun} className="w-3.5 h-3.5" />
            Light mode
          </span>
          <button className="w-8 h-4 rounded-full bg-slate-200 flex items-center px-0.5 transition-all">
            <span className="w-3 h-3 rounded-full bg-white shadow-sm block" />
          </button>
        </div>

        <button
          onClick={() => { logout(); navigate("/"); }}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-150"
        >
          <Icon path={ICONS.logout} className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
