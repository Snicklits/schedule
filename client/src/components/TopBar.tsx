/**
 * TopBar — 60px fixed top navbar.
 *
 * Left:   page title (derived from route)
 * Center: pill search input + week navigation arrows
 * Right:  notification bell (with alert badge), messages icon, grid icon
 */

import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useAlerts } from "../contexts/AlertsContext.js";

function Icon({ path, className = "w-5 h-5" }: { path: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  bell:    "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  chat:    "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  grid:    "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  search:  "M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z",
  chevL:   "M15 18l-6-6 6-6",
  chevR:   "M9 18l6-6-6-6",
};

const PAGE_TITLES: Record<string, string> = {
  "/":          "Dashboard",
  "/schedule":  "Schedule Grid",
  "/generate":  "Generate Schedule",
  "/employees": "Employees",
  "/time-off":  "Time Off",
  "/hours":     "Hours Report",
  "/alerts":    "Alerts",
  "/settings":  "Settings",
};

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

function currentMonday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
  return d;
}

interface TopBarProps {
  weekStart?: Date;
  onWeekChange?: (d: Date) => void;
}

export function TopBar({ weekStart, onWeekChange }: TopBarProps) {
  const location = useLocation();
  const { violations, gaps } = useAlerts();
  const [searchVal, setSearchVal] = useState("");

  const week = weekStart ?? currentMonday();
  const alertBadge = violations.filter((v) => v.type === "BLOCKING").length + gaps.length;
  const pageTitle = PAGE_TITLES[location.pathname] ?? "ScheduleMgr";

  const canNavigate = !!onWeekChange;

  return (
    <header className="h-[60px] flex-shrink-0 bg-white border-b border-slate-200 flex items-center px-5 gap-4 z-10">
      {/* Left — Page title */}
      <div className="w-44 flex-shrink-0">
        <h1 className="text-base font-bold text-slate-900 truncate">{pageTitle}</h1>
      </div>

      {/* Center — Search + Week nav */}
      <div className="flex-1 flex items-center justify-center gap-3">
        {/* Search pill */}
        <div className="relative w-52">
          <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 pointer-events-none">
            <Icon path={ICONS.search} className="w-3.5 h-3.5" />
          </span>
          <input
            type="text"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder="Search…"
            className="w-full h-8 pl-8 pr-3 rounded-full bg-slate-100 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white transition-all"
          />
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => canNavigate && onWeekChange(addDays(week, -7))}
            disabled={!canNavigate}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-all"
          >
            <Icon path={ICONS.chevL} className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-slate-700 whitespace-nowrap select-none min-w-[130px] text-center">
            {formatWeekRange(week)}
          </span>
          <button
            onClick={() => canNavigate && onWeekChange(addDays(week, 7))}
            disabled={!canNavigate}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 transition-all"
          >
            <Icon path={ICONS.chevR} className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right — Icon buttons */}
      <div className="flex items-center gap-1.5">
        {/* Notification bell */}
        <button className="relative w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-all">
          <Icon path={ICONS.bell} className="w-5 h-5" />
          {alertBadge > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border border-white" />
          )}
        </button>
        <button className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-all">
          <Icon path={ICONS.chat} className="w-5 h-5" />
        </button>
        <button className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-all">
          <Icon path={ICONS.grid} className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}

/** Shared Card wrapper */
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 ${className}`}>
      {children}
    </div>
  );
}
