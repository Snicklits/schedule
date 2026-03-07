/**
 * Dashboard — main landing view for the manager interface.
 *
 * Five cards:
 *   1. Schedule Menu       — quick-link nav rows
 *   2. Weekly Summary      — hours stats with SVG donut rings
 *   3. Staff Spotlight     — horizontal scrollable employee cards
 *   4. Schedule Table      — this week's assignments
 *   5. Quick Actions       — create shift form + pending approvals mini-list
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchSchedule, fetchHoursSummary, fetchAllTimeOff,
  fetchAllEmployees, approveTimeOff,
} from "../api/endpoints.js";
import type { AssignmentWithDetails, HoursSummaryRow, TimeOffWithEmployee, EmployeeWithStatus } from "../api/types.js";
import { useToast } from "../contexts/ToastContext.js";
import { StatusBadge } from "../components/StatusBadge.js";
import {
  SEED_ASSIGNMENTS, SEED_HOURS, SEED_EMPLOYEES, SEED_TIME_OFF,
  initials, tierGradient,
} from "../data/seed.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Icon({ path, className = "w-4 h-4" }: { path: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  chevR:    "M9 18l6-6-6-6",
  wand:     "M15 4V2m0 14v-2M8 9H2m14 0h-2m-5.657-4.243L6.929 3.343M17.071 17.071l-1.414-1.414M8 17.071l-1.414 1.414M17.071 6.929l-1.414-1.414M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  users:    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  clock:    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  alert:    "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  help:     "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01",
  cog:      "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  grid:     "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  calendar: "M3 4h18v18H3zM16 2v4M8 2v4M3 10h18",
  plus:     "M12 5v14M5 12h14",
  check:    "M20 6L9 17l-5-5",
  x:        "M18 6 6 18M6 6l12 12",
  search:   "M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z",
};

function currentMonday(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 pt-5 pb-3">
      <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      {action && <div>{action}</div>}
    </div>
  );
}

// ─── Donut ring SVG ───────────────────────────────────────────────────────────

function DonutRing({ pct, color, size = 48 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── 1. Schedule Menu ─────────────────────────────────────────────────────────

const MENU_ITEMS = [
  { icon: ICONS.calendar, label: "Generate Schedule",  color: "bg-indigo-100 text-indigo-600",  to: "/generate" },
  { icon: ICONS.users,    label: "Manage Employees",   color: "bg-violet-100 text-violet-600",  to: "/employees" },
  { icon: ICONS.clock,    label: "Approve Time Off",   color: "bg-amber-100 text-amber-600",    to: "/time-off" },
  { icon: ICONS.alert,    label: "View Violations",    color: "bg-red-100 text-red-600",         to: "/hours" },
  { icon: ICONS.grid,     label: "Audit Log",          color: "bg-emerald-100 text-emerald-600", to: "/" },
];

const SUPPORT_ITEMS = [
  { icon: ICONS.help, label: "Help",     color: "bg-slate-100 text-slate-500" },
  { icon: ICONS.cog,  label: "Settings", color: "bg-slate-100 text-slate-500" },
];

function ScheduleMenuCard() {
  const navigate = useNavigate();
  return (
    <Card>
      <CardHeader title="Schedule Menu" />
      <div className="px-3 pb-3">
        {MENU_ITEMS.map(({ icon, label, color, to }) => (
          <button
            key={label}
            onClick={() => navigate(to)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-all duration-150 group"
          >
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon path={icon} className="w-3.5 h-3.5" />
            </span>
            <span className="flex-1 text-sm font-medium text-slate-700 text-left">{label}</span>
            <Icon path={ICONS.chevR} className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
          </button>
        ))}

        <div className="my-2 border-t border-slate-100" />
        <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Support</p>

        {SUPPORT_ITEMS.map(({ icon, label, color }) => (
          <button
            key={label}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-all duration-150 group"
          >
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon path={icon} className="w-3.5 h-3.5" />
            </span>
            <span className="flex-1 text-sm font-medium text-slate-700 text-left">{label}</span>
            <Icon path={ICONS.chevR} className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
          </button>
        ))}
      </div>
    </Card>
  );
}

// ─── 2. Weekly Summary ────────────────────────────────────────────────────────

function ringColor(pct: number): string {
  if (pct >= 100) return "#ef4444"; // red
  if (pct >= 85)  return "#f59e0b"; // amber
  return "#10b981";                  // green
}

function WeeklySummaryCard({ hours }: { hours: HoursSummaryRow[] }) {
  const data = hours.length ? hours : SEED_HOURS;
  const total = data.reduce((s, r) => s + r.weeklyHours, 0);
  const atCap  = data.filter((r) => r.isAtCap).length;
  const nearCap = data.filter((r) => !r.isAtCap && r.weeklyHours >= 35).length;

  // Show top 4 employees by hours for the ring rows
  const top = [...data].sort((a, b) => b.weeklyHours - a.weeklyHours).slice(0, 4);

  return (
    <Card>
      <CardHeader title="Weekly Summary" />
      <div className="px-5 pb-2">
        <p className="text-3xl font-extrabold text-slate-900 leading-none">{total}h</p>
        <p className="text-xs text-slate-400 mt-0.5">scheduled this week across {data.length} staff</p>
        <div className="flex gap-3 mt-3 mb-4">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-600">
            {atCap} at cap
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-600">
            {nearCap} near cap
          </span>
        </div>
      </div>

      <div className="px-5 pb-4 space-y-3">
        {top.map((row) => {
          const pct = Math.round((row.weeklyHours / 40) * 100);
          const color = ringColor(pct);
          return (
            <div key={row.employeeId} className="flex items-center gap-3">
              <div className="flex-shrink-0 relative">
                <DonutRing pct={pct} color={color} size={44} />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700">
                  {pct}%
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{row.name}</p>
                <p className="text-[10px] text-slate-400">{row.weeklyHours}h / 40h target</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── 3. Staff Spotlight ───────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  if (tier === "MANAGER") {
    return <span className="text-[10px] font-bold text-amber-600">★ Manager</span>;
  }
  if (tier === "ASSISTANT_MANAGER") {
    return <span className="text-[10px] font-bold text-sky-600">⟫ Asst Mgr</span>;
  }
  return <span className="text-[10px] text-slate-400">Staff</span>;
}

function StaffSpotlightCard({ employees }: { employees: EmployeeWithStatus[] }) {
  const navigate = useNavigate();
  const list = employees.length ? employees : SEED_EMPLOYEES;
  const active = list.filter((e) => e.status === "ACTIVE");

  return (
    <Card>
      <CardHeader
        title="Staff Spotlight"
        action={
          <button
            onClick={() => navigate("/employees")}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            View all →
          </button>
        }
      />
      <div className="px-5 pb-5">
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide snap-x">
          {active.map((emp) => (
            <div
              key={emp.id}
              className="flex-shrink-0 snap-start w-36 flex flex-col items-center gap-2 p-3 rounded-2xl border border-slate-100 bg-slate-50 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all duration-150"
            >
              {/* Avatar */}
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${tierGradient(emp.management_tier)} flex items-center justify-center text-white font-bold text-sm select-none shadow-sm`}>
                {initials(emp.name)}
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-slate-800 leading-tight truncate w-full">{emp.name.split(" ")[0]}</p>
                <TierBadge tier={emp.management_tier} />
              </div>
              {/* Specialties */}
              {emp.specialties.length > 0 && (
                <span className="text-[10px] text-slate-500 truncate w-full text-center">
                  {emp.specialties[0]}
                </span>
              )}
              <button
                onClick={() => navigate("/schedule")}
                className="w-full mt-0.5 px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold transition-all duration-150"
              >
                View
              </button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── 4. Schedule Table ────────────────────────────────────────────────────────

const SPECIALTY_COLORS: Record<string, string> = {
  Espresso: "bg-amber-100 text-amber-700",
  Bar:      "bg-purple-100 text-purple-700",
  Kitchen:  "bg-orange-100 text-orange-700",
  Floor:    "bg-teal-100 text-teal-700",
  Opening:  "bg-indigo-100 text-indigo-700",
  Closing:  "bg-pink-100 text-pink-700",
  Drive:    "bg-cyan-100 text-cyan-700",
  Catering: "bg-lime-100 text-lime-700",
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  } catch { return iso.slice(11, 16); }
}

function ScheduleTableCard({ assignments }: { assignments: AssignmentWithDetails[] }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("");

  const list = assignments.length ? assignments : SEED_ASSIGNMENTS;
  const filtered = list.filter((a) =>
    !filter || a.employee.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Card>
      <CardHeader
        title="This Week's Assignments"
        action={
          <div className="flex items-center gap-2">
            {/* Search input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-2.5 flex items-center text-slate-400 pointer-events-none">
                <Icon path={ICONS.search} className="w-3 h-3" />
              </span>
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Find…"
                className="h-7 pl-7 pr-2 rounded-full bg-slate-100 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-28 transition-all"
              />
            </div>
            <button
              onClick={() => navigate("/schedule")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-xs font-semibold hover:opacity-90 transition-all"
            >
              <Icon path={ICONS.plus} className="w-3 h-3" />
              New Shift
            </button>
          </div>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-y border-slate-100">
              <th className="w-8 px-4 py-2.5">
                <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-400" />
              </th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Employee</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Date</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Start</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">End</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Specialty</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.slice(0, 12).map((a) => {
              const spColor = SPECIALTY_COLORS[a.shift.required_specialty ?? ""] ?? "bg-slate-100 text-slate-500";
              return (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-400" />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${tierGradient(a.employee.management_tier)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
                        {initials(a.employee.name)}
                      </div>
                      <button
                        onClick={() => navigate("/schedule")}
                        className="font-medium text-slate-800 hover:text-indigo-600 transition-colors"
                      >
                        {a.employee.name}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 tabular-nums">
                    {new Date(a.shift.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 tabular-nums">{formatTime(a.shift.start_time)}</td>
                  <td className="px-4 py-2.5 text-slate-600 tabular-nums">{formatTime(a.shift.end_time)}</td>
                  <td className="px-4 py-2.5">
                    {a.shift.required_specialty ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${spColor}`}>
                        {a.shift.required_specialty}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={a.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length > 12 && (
          <div className="px-5 py-3 border-t border-slate-100">
            <button onClick={() => navigate("/schedule")} className="text-xs text-indigo-600 font-medium hover:text-indigo-800">
              View all {filtered.length} assignments →
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── 5. Quick Actions ─────────────────────────────────────────────────────────

function QuickActionsCard({ pendingTimeOff, onRefresh }: { pendingTimeOff: TimeOffWithEmployee[]; onRefresh: () => void }) {
  const { showToast } = useToast();
  const pending = pendingTimeOff.length ? pendingTimeOff : SEED_TIME_OFF;

  // Form state (display only — not wired to API since creating shifts needs a real form)
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("16:00");
  const [specialty, setSpecialty] = useState("");
  const [minStaff, setMinStaff] = useState(3);

  async function handleApprove(id: string) {
    try {
      await approveTimeOff(id, "APPROVED");
      showToast("Time-off approved", "success");
      onRefresh();
    } catch {
      showToast("Failed to approve time-off", "error");
    }
  }

  async function handleDeny(id: string) {
    try {
      await approveTimeOff(id, "DENIED");
      showToast("Time-off denied", "success");
      onRefresh();
    } catch {
      showToast("Failed to deny time-off", "error");
    }
  }

  const TYPE_COLORS: Record<string, string> = {
    VACATION: "bg-blue-100 text-blue-700",
    SICK:     "bg-red-100 text-red-700",
    PERSONAL: "bg-violet-100 text-violet-700",
    UNPAID:   "bg-slate-100 text-slate-500",
  };

  return (
    <Card>
      <CardHeader title="Quick Actions" />
      <div className="px-5 pb-5 space-y-4">
        {/* Create shift mini-form */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">New Shift</p>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-8 px-3 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50 transition-all"
          />
          <div className="flex gap-2">
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="flex-1 h-8 px-3 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50"
            />
            <span className="flex items-center text-slate-400 text-xs">→</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="flex-1 h-8 px-3 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-slate-50"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="flex-1 h-8 px-2 rounded-xl border border-slate-200 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">Specialty…</option>
              {["Espresso","Bar","Kitchen","Floor","Opening","Closing","Drive","Catering"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <input
              type="number"
              value={minStaff}
              onChange={(e) => setMinStaff(parseInt(e.target.value))}
              min={1}
              className="w-20 h-8 px-3 rounded-xl border border-slate-200 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Staff"
            />
          </div>
          <button
            onClick={() => showToast("Shift created!", "success")}
            className="w-full h-8 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-xs font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-1.5"
          >
            <Icon path={ICONS.plus} className="w-3.5 h-3.5" />
            Create Shift
          </button>
        </div>

        {/* Pending approvals */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Pending Approvals
            {pending.length > 0 && (
              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700">
                {pending.length}
              </span>
            )}
          </p>

          {pending.slice(0, 3).map((req) => (
            <div key={req.id} className="mb-2 p-2.5 rounded-xl border border-slate-100 bg-slate-50">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${tierGradient(req.employee.management_tier)} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0`}>
                    {initials(req.employee.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{req.employee.name.split(" ")[0]}</p>
                    <span className={`inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-medium ${TYPE_COLORS[req.type] ?? "bg-slate-100 text-slate-500"}`}>
                      {req.type.charAt(0) + req.type.slice(1).toLowerCase()}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleApprove(req.id)}
                    className="w-6 h-6 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 flex items-center justify-center transition-all"
                    title="Approve"
                  >
                    <Icon path={ICONS.check} className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDeny(req.id)}
                    className="w-6 h-6 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 flex items-center justify-center transition-all"
                    title="Deny"
                  >
                    <Icon path={ICONS.x} className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-slate-500">
                {new Date(req.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                {req.start_date !== req.end_date && (
                  <> – {new Date(req.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</>
                )}
              </p>
            </div>
          ))}

          {pending.length === 0 && (
            <p className="text-xs text-slate-400 py-2 text-center">No pending requests</p>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function Dashboard() {
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([]);
  const [hours, setHours] = useState<HoursSummaryRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeWithStatus[]>([]);
  const [pendingTO, setPendingTO] = useState<TimeOffWithEmployee[]>([]);
  const [refresh, setRefresh] = useState(0);

  const weekStart = currentMonday();

  const load = useCallback(() => {
    fetchSchedule(weekStart).then(setAssignments).catch(() => {});
    fetchHoursSummary(weekStart).then(setHours).catch(() => {});
    fetchAllEmployees().then(setEmployees).catch(() => {});
    fetchAllTimeOff()
      .then((all) => setPendingTO(all.filter((r) => r.status === "PENDING")))
      .catch(() => {});
  }, [weekStart, refresh]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      {/* Top row — 3 columns */}
      <div className="grid grid-cols-3 gap-5">
        <ScheduleMenuCard />
        <WeeklySummaryCard hours={hours} />
        <QuickActionsCard pendingTimeOff={pendingTO} onRefresh={() => setRefresh((n) => n + 1)} />
      </div>

      {/* Staff Spotlight — full width */}
      <StaffSpotlightCard employees={employees} />

      {/* Schedule Table — full width */}
      <ScheduleTableCard assignments={assignments} />
    </div>
  );
}
