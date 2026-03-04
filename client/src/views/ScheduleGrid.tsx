import { useState, useEffect, useCallback } from "react";
import { fetchSchedule, fetchEmployees, reassignAssignment } from "../api/endpoints.js";
import type { AssignmentWithDetails, Employee, ManagementTier } from "../api/types.js";
import { ErrorBanner } from "../components/ErrorBanner.js";
import { Modal } from "../components/Modal.js";
import { useToast } from "../contexts/ToastContext.js";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

/** Compute consecutive working day streak ending on Sunday of the week. */
function computeStreak(employeeId: string, assignments: AssignmentWithDetails[], weekStart: string): number {
  const dates = assignments
    .filter((a) => a.employee_id === employeeId)
    .map((a) => a.shift.date.slice(0, 10))
    .sort();
  if (dates.length === 0) return 0;

  // Walk backwards from last working day in the week
  let streak = 0;
  const lastDayIdx = 6; // Sunday
  for (let i = lastDayIdx; i >= 0; i--) {
    const d = addDays(weekStart, i);
    if (dates.includes(d)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/** Coverage badge for a cell (shift). */
function coverageBadge(
  assignments: AssignmentWithDetails[],
  shiftId: string,
  requiresMgmt: boolean,
  isPeak: boolean
) {
  if (!requiresMgmt) return null;
  const tiers = assignments
    .filter((a) => a.shift_id === shiftId)
    .map((a) => a.employee.management_tier as ManagementTier);

  const hasManager = tiers.includes("MANAGER");
  const hasAM = tiers.includes("ASSISTANT_MANAGER");

  if (hasManager) {
    return <span className="text-xs bg-green-100 text-green-700 border border-green-300 rounded px-1">MGR</span>;
  }
  if (hasAM && !isPeak) {
    return <span className="text-xs bg-blue-100 text-blue-700 border border-blue-300 rounded px-1">AM</span>;
  }
  if (hasAM && isPeak) {
    return <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-400 rounded px-1">⚠ AM</span>;
  }
  return <span className="text-xs bg-red-50 text-red-700 border border-red-400 rounded px-1">⚠ None</span>;
}

interface EditDrawerState {
  assignmentId: string;
  shiftId: string;
  currentEmployeeId: string;
  shiftLabel: string;
}

export function ScheduleGrid() {
  const [weekStart, setWeekStart] = useState(currentMonday);
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<EditDrawerState | null>(null);
  const [newEmployeeId, setNewEmployeeId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [coverageWarning, setCoverageWarning] = useState<string | null>(null);
  const { showToast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchSchedule(weekStart), fetchEmployees()])
      .then(([asgn, emps]) => {
        setAssignments(asgn);
        setEmployees(emps);
      })
      .catch(() => setError("Failed to load schedule"))
      .finally(() => setLoading(false));
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  // Build unique employee list from assignments (those who appear in the schedule)
  const scheduleEmployees = Array.from(
    new Map(assignments.map((a) => [a.employee_id, a.employee])).values()
  ).sort((a, b) => a.hierarchy_rank - b.hierarchy_rank);

  // Build day → shift map for cells
  const dayDates = DAYS.map((_, i) => addDays(weekStart, i));

  function openDrawer(assignment: AssignmentWithDetails) {
    const shift = assignment.shift;
    setDrawer({
      assignmentId: assignment.id,
      shiftId: shift.id,
      currentEmployeeId: assignment.employee_id,
      shiftLabel: `${shift.date.slice(0, 10)} ${shift.start_time.slice(11, 16)}–${shift.end_time.slice(11, 16)}`,
    });
    setNewEmployeeId(assignment.employee_id);
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
        setCoverageWarning("This shift requires management coverage. Provide a reason to override.");
      } else {
        setError(apiErr.response?.data?.error?.message ?? "Reassignment failed");
        setDrawer(null);
      }
    } finally {
      setSaving(false);
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
        <button
          onClick={load}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          Refresh
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-3 py-2 text-left font-semibold text-gray-600 min-w-[160px]">
                  Employee
                </th>
                {DAYS.map((day, i) => (
                  <th key={day} className="border px-2 py-2 text-center font-semibold text-gray-600 min-w-[120px]">
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
                const streakDot =
                  streak >= 5
                    ? "🔴"
                    : streak >= 4
                      ? "🟡"
                      : null;

                return (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="border px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-gray-800">{emp.name}</span>
                        {streakDot && <span title={`${streak}-day streak`}>{streakDot}</span>}
                      </div>
                      <div className="text-gray-400 text-xs">{emp.management_tier.replace("_", " ")}</div>
                    </td>
                    {dayDates.map((date) => {
                      const dayAssignments = assignments.filter(
                        (a) => a.employee_id === emp.id && a.shift.date.slice(0, 10) === date
                      );
                      return (
                        <td key={date} className="border px-1 py-1 align-top">
                          {dayAssignments.map((asgn) => (
                            <div
                              key={asgn.id}
                              onClick={() => openDrawer(asgn)}
                              className="cursor-pointer rounded p-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 mb-1 space-y-0.5"
                            >
                              <div className="text-gray-700">
                                {asgn.shift.start_time.slice(11, 16)}–{asgn.shift.end_time.slice(11, 16)}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {coverageBadge(
                                  assignments,
                                  asgn.shift_id,
                                  asgn.shift.requires_management_presence,
                                  asgn.shift.is_peak_shift
                                )}
                                {asgn.shift.is_peak_shift && (
                                  <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 rounded px-1">★</span>
                                )}
                              </div>
                            </div>
                          ))}
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
                {coverageWarning}
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
                Reason (required for coverage override)
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
