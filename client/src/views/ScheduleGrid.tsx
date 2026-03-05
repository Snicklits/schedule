import { useState, useEffect, useCallback } from "react";
import { fetchSchedule, fetchEmployees, reassignAssignment, fetchHoursSummary } from "../api/endpoints.js";
import type { AssignmentWithDetails, Employee, ManagementTier, HoursSummaryRow } from "../api/types.js";
import { ErrorBanner } from "../components/ErrorBanner.js";
import { Modal } from "../components/Modal.js";
import { useToast } from "../contexts/ToastContext.js";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── Specialty color map ──────────────────────────────────────────────────────

const SPECIALTY_COLORS: Record<string, { bg: string; border: string }> = {
  Espresso:  { bg: "bg-amber-50",   border: "border-amber-300" },
  Bar:       { bg: "bg-purple-50",  border: "border-purple-300" },
  Kitchen:   { bg: "bg-orange-50",  border: "border-orange-300" },
  Floor:     { bg: "bg-teal-50",    border: "border-teal-300" },
  Opening:   { bg: "bg-indigo-50",  border: "border-indigo-300" },
  Closing:   { bg: "bg-pink-50",    border: "border-pink-300" },
  Drive:     { bg: "bg-cyan-50",    border: "border-cyan-300" },
  Catering:  { bg: "bg-lime-50",    border: "border-lime-300" },
};

function specialtyColor(specialty: string | null) {
  if (!specialty) return { bg: "bg-blue-50", border: "border-blue-200" };
  return SPECIALTY_COLORS[specialty] ?? { bg: "bg-blue-50", border: "border-blue-200" };
}

// ─── Coverage helpers ─────────────────────────────────────────────────────────

interface CoverageInfo {
  borderCls: string;
  badge: React.ReactNode;
}

function coverageInfo(
  assignments: AssignmentWithDetails[],
  shiftId: string,
  requiresMgmt: boolean,
  isPeak: boolean
): CoverageInfo {
  if (!requiresMgmt) return { borderCls: "", badge: null };

  const tiers = assignments
    .filter((a) => a.shift_id === shiftId)
    .map((a) => a.employee.management_tier as ManagementTier);

  const hasManager = tiers.includes("MANAGER");
  const hasAM = tiers.includes("ASSISTANT_MANAGER");

  if (hasManager) {
    return {
      borderCls: "border-green-400",
      badge: (
        <span className="text-xs bg-green-100 text-green-700 border border-green-300 rounded px-1">
          🟢 MGR
        </span>
      ),
    };
  }
  if (hasAM && !isPeak) {
    return {
      borderCls: "border-blue-400",
      badge: (
        <span className="text-xs bg-blue-100 text-blue-700 border border-blue-300 rounded px-1">
          🔵 AM
        </span>
      ),
    };
  }
  if (hasAM && isPeak) {
    return {
      borderCls: "border-yellow-400",
      badge: (
        <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-400 rounded px-1">
          🟡 ⚠ Peak/AM
        </span>
      ),
    };
  }
  return {
    borderCls: "border-red-400",
    badge: (
      <span className="text-xs bg-red-50 text-red-700 border border-red-400 rounded px-1">
        🔴 ⚠ No Mgmt
      </span>
    ),
  };
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function currentMonday(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function addDays(base: string, n: number): string {
  const d = new Date(base + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function computeStreak(employeeId: string, assignments: AssignmentWithDetails[], weekStart: string): number {
  const dates = assignments
    .filter((a) => a.employee_id === employeeId)
    .map((a) => a.shift.date.slice(0, 10))
    .sort();
  if (dates.length === 0) return 0;
  let streak = 0;
  for (let i = 6; i >= 0; i--) {
    if (dates.includes(addDays(weekStart, i))) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DrawerState {
  assignmentId: string;
  shiftId: string;
  shiftLabel: string;
  preselectedEmployeeId?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScheduleGrid() {
  const [weekStart, setWeekStart] = useState(currentMonday);
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [hoursSummary, setHoursSummary] = useState<HoursSummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [newEmployeeId, setNewEmployeeId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [coverageWarning, setCoverageWarning] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null); // "empId|date"
  const { showToast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchSchedule(weekStart), fetchEmployees(), fetchHoursSummary(weekStart)])
      .then(([asgn, emps, hours]) => {
        setAssignments(asgn);
        setEmployees(emps);
        setHoursSummary(hours);
      })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
        setError(e.response?.data?.error?.message ?? e.message ?? "Failed to load schedule");
      })
      .finally(() => setLoading(false));
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  const scheduleEmployees = Array.from(
    new Map(assignments.map((a) => [a.employee_id, a.employee])).values()
  ).sort((a, b) => a.hierarchy_rank - b.hierarchy_rank);

  const dayDates = DAYS.map((_, i) => addDays(weekStart, i));

  const hoursMap = new Map(hoursSummary.map((r) => [r.employeeId, r]));

  function openDrawer(assignment: AssignmentWithDetails, preselectedEmployeeId?: string) {
    const shift = assignment.shift;
    setDrawer({
      assignmentId: assignment.id,
      shiftId: shift.id,
      shiftLabel: `${shift.date.slice(0, 10)} ${shift.start_time.slice(11, 16)}–${shift.end_time.slice(11, 16)}`,
      preselectedEmployeeId,
    });
    setNewEmployeeId(preselectedEmployeeId ?? assignment.employee_id);
    setReason("");
    setCoverageWarning(null);
  }

  async function handleReassign() {
    if (!drawer || !newEmployeeId) return;
    setSaving(true);
    try {
      await reassignAssignment(drawer.assignmentId, newEmployeeId, reason || undefined);
      showToast("Assignment updated", "success");
      setDrawer(null);
      load();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: { code?: string; message?: string } } } };
      const code = apiErr.response?.data?.error?.code;
      if (code === "MANAGEMENT_COVERAGE_REQUIRED") {
        setCoverageWarning("This shift requires management coverage. Enter a reason to override.");
      } else {
        setError(apiErr.response?.data?.error?.message ?? "Reassignment failed");
        setDrawer(null);
      }
    } finally {
      setSaving(false);
    }
  }

  // ─── Drag-and-drop handlers ─────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, assignment: AssignmentWithDetails) {
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ assignmentId: assignment.id, sourceEmpId: assignment.employee_id })
    );
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, empId: string, date: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCell(`${empId}|${date}`);
  }

  function handleDragLeave() {
    setDragOverCell(null);
  }

  function handleDrop(e: React.DragEvent, targetEmpId: string) {
    e.preventDefault();
    setDragOverCell(null);
    try {
      const { assignmentId, sourceEmpId } = JSON.parse(e.dataTransfer.getData("text/plain")) as {
        assignmentId: string;
        sourceEmpId: string;
      };
      if (sourceEmpId === targetEmpId) return; // same employee — no-op
      const assignment = assignments.find((a) => a.id === assignmentId);
      if (!assignment) return;
      openDrawer(assignment, targetEmpId);
    } catch {
      // malformed drag data — ignore
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Weekly Schedule</h1>
        <input
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={load} className="text-xs text-blue-600 hover:text-blue-800">
          Refresh
        </button>
      </div>

      {/* Specialty legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(SPECIALTY_COLORS).map(([label, cls]) => (
          <span key={label} className={`px-2 py-0.5 rounded border ${cls.bg} ${cls.border} text-gray-600`}>
            {label}
          </span>
        ))}
        <span className="px-2 py-0.5 rounded border bg-blue-50 border-blue-200 text-gray-600">General</span>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-3 py-2 text-left font-semibold text-gray-600 min-w-[180px]">
                  Employee
                </th>
                {DAYS.map((day, i) => (
                  <th key={day} className="border px-2 py-2 text-center font-semibold text-gray-600 min-w-[130px]">
                    <div>{day}</div>
                    <div className="text-gray-400 font-normal">{dayDates[i].slice(5)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {scheduleEmployees.length === 0 && (
                <tr>
                  <td colSpan={8} className="border px-4 py-6 text-center text-gray-400">
                    No assignments for this week
                  </td>
                </tr>
              )}
              {scheduleEmployees.map((emp) => {
                const streak = computeStreak(emp.id, assignments, weekStart);
                const streakDot = streak >= 5 ? "🔴" : streak >= 4 ? "🟡" : null;
                const hoursRow = hoursMap.get(emp.id);
                const nearCap = hoursRow && (hoursRow.isAtCap || hoursRow.weeklyHours >= 35);
                const atCap = hoursRow?.isAtCap;

                return (
                  <tr
                    key={emp.id}
                    className={atCap ? "bg-red-50" : nearCap ? "bg-yellow-50" : "hover:bg-gray-50"}
                  >
                    <td className="border px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className={`font-medium ${atCap ? "text-red-700" : nearCap ? "text-yellow-700" : "text-gray-800"}`}>
                          {emp.name}
                        </span>
                        {streakDot && <span title={`${streak}-day streak`}>{streakDot}</span>}
                        {atCap && (
                          <span className="text-xs bg-red-100 text-red-700 border border-red-300 rounded px-1 ml-1">
                            AT CAP
                          </span>
                        )}
                        {!atCap && nearCap && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 border border-yellow-300 rounded px-1 ml-1">
                            NEAR CAP
                          </span>
                        )}
                      </div>
                      <div className="text-gray-400 text-xs">{emp.management_tier.replace("_", " ")}</div>
                      {hoursRow && (
                        <div className="text-gray-400 text-xs">{hoursRow.weeklyHours}h this week</div>
                      )}
                    </td>
                    {dayDates.map((date) => {
                      const cellKey = `${emp.id}|${date}`;
                      const isDragOver = dragOverCell === cellKey;
                      const dayAssignments = assignments.filter(
                        (a) => a.employee_id === emp.id && a.shift.date.slice(0, 10) === date
                      );

                      return (
                        <td
                          key={date}
                          className={`border px-1 py-1 align-top transition-colors ${
                            isDragOver ? "bg-blue-100" : ""
                          }`}
                          onDragOver={(e) => handleDragOver(e, emp.id, date)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, emp.id)}
                        >
                          {dayAssignments.map((asgn) => {
                            const { borderCls, badge } = coverageInfo(
                              assignments,
                              asgn.shift_id,
                              asgn.shift.requires_management_presence,
                              asgn.shift.is_peak_shift
                            );
                            const { bg, border } = specialtyColor(asgn.shift.required_specialty);
                            // Coverage border overrides specialty border when there's an issue
                            const finalBorder = borderCls || border;

                            return (
                              <div
                                key={asgn.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, asgn)}
                                onClick={() => openDrawer(asgn)}
                                className={`cursor-grab active:cursor-grabbing rounded p-1 ${bg} hover:brightness-95 border-2 ${finalBorder} mb-1 space-y-0.5 select-none`}
                                title={`${asgn.shift.required_specialty ?? "General"} — drag to reassign`}
                              >
                                <div className="text-gray-700">
                                  {asgn.shift.start_time.slice(11, 16)}–{asgn.shift.end_time.slice(11, 16)}
                                </div>
                                {asgn.shift.required_specialty && (
                                  <div className="text-gray-500 truncate">{asgn.shift.required_specialty}</div>
                                )}
                                <div className="flex flex-wrap gap-1">
                                  {badge}
                                  {asgn.shift.is_peak_shift && (
                                    <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 rounded px-1">
                                      ★ Peak
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {drawer && (
        <Modal
          title={`Reassign: ${drawer.shiftLabel}`}
          onClose={() => setDrawer(null)}
          footer={
            <>
              <button
                onClick={() => setDrawer(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleReassign}
                disabled={saving || !newEmployeeId}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm"
              >
                {saving ? "Saving…" : "Reassign"}
              </button>
            </>
          }
        >
          <div className="space-y-3 text-sm">
            {coverageWarning && (
              <p className="text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2 text-xs">
                ⚠ {coverageWarning}
              </p>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Assign To</label>
              <select
                value={newEmployeeId}
                onChange={(e) => setNewEmployeeId(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">— Select employee —</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} ({e.management_tier.replace("_", " ")})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Reason {coverageWarning ? "(required — coverage override)" : "(optional)"}
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason if overriding coverage…"
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
