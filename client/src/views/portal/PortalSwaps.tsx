import { useEffect, useState } from "react";
import { fetchSwapRequests, submitSwapRequest, fetchPortalSchedule } from "../../api/endpoints";
import type { ShiftSwapRequest, AssignmentWithDetails } from "../../api/types";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Modal } from "../../components/Modal";

function weekStartMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

const STATUS_STYLES: Record<string, string> = {
  PENDING:  "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  DENIED:   "bg-red-100 text-red-600",
};

export function PortalSwaps() {
  const { employeeId } = useAuth();
  const { showToast } = useToast();
  const [swaps, setSwaps] = useState<ShiftSwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [myShifts, setMyShifts] = useState<AssignmentWithDetails[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [targetEmployeeId, setTargetEmployeeId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function loadSwaps() {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    fetchSwapRequests(employeeId)
      .then(setSwaps)
      .catch((e) => setError(e?.response?.data?.message ?? e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadSwaps();
  }, [employeeId]);

  function openForm() {
    setShowForm(true);
    setSelectedAssignmentId("");
    setTargetEmployeeId("");
    setFormError(null);

    setShiftsLoading(true);
    fetchPortalSchedule(weekStartMonday(new Date()))
      .then(setMyShifts)
      .catch(() => setMyShifts([]))
      .finally(() => setShiftsLoading(false));
  }

  async function handleSubmit() {
    setFormError(null);
    if (!selectedAssignmentId) {
      setFormError("Please select a shift.");
      return;
    }
    if (!targetEmployeeId.trim()) {
      setFormError("Please enter the target employee ID.");
      return;
    }
    setSubmitting(true);
    try {
      await submitSwapRequest(selectedAssignmentId, targetEmployeeId.trim());
      setShowForm(false);
      showToast("Swap request submitted!", "success");
      loadSwaps();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setFormError(err?.response?.data?.message ?? err?.message ?? "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  const pending = swaps.filter((s) => s.status === "PENDING");
  const resolved = swaps.filter((s) => s.status !== "PENDING");

  function shiftLabel(a: AssignmentWithDetails) {
    if (!a.shift) return a.id;
    const d = new Date(a.shift.date);
    return `${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} — ${new Date(a.shift.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  function swapShiftLabel(req: ShiftSwapRequest) {
    return shiftLabel(req.assignment);
  }

  const inputCls = "w-full h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white transition-all";

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Shift Swaps</h2>
          <p className="text-xs text-slate-400 mt-0.5">Request and track shift swaps with teammates</p>
        </div>
        <button
          onClick={openForm}
          className="h-9 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 transition-all duration-150 shadow-sm"
        >
          + Request Swap
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center h-32 text-sm text-slate-400">
          Loading swap requests…
        </div>
      )}

      {!loading && swaps.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center h-32 gap-2">
          <p className="text-sm text-slate-400">No swap requests yet.</p>
        </div>
      )}

      {!loading && pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 px-1">
            Pending ({pending.length})
          </p>
          {pending.map((req) => (
            <SwapCard key={req.id} req={req} employeeId={employeeId ?? ""} shiftLabel={swapShiftLabel(req)} />
          ))}
        </div>
      )}

      {!loading && resolved.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 px-1">
            Resolved ({resolved.length})
          </p>
          {resolved.map((req) => (
            <SwapCard key={req.id} req={req} employeeId={employeeId ?? ""} shiftLabel={swapShiftLabel(req)} />
          ))}
        </div>
      )}

      {showForm && (
        <Modal
          title="Request Shift Swap"
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button
                onClick={() => setShowForm(false)}
                disabled={submitting}
                className="h-9 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-all duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="h-9 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold transition-all duration-150 shadow-sm"
              >
                {submitting ? "Submitting…" : "Submit Request"}
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{formError}</p>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Select your shift
              </label>
              {shiftsLoading ? (
                <p className="text-sm text-slate-400">Loading shifts…</p>
              ) : myShifts.length === 0 ? (
                <p className="text-sm text-slate-400">No shifts this week to swap.</p>
              ) : (
                <select
                  className={inputCls}
                  value={selectedAssignmentId}
                  onChange={(e) => setSelectedAssignmentId(e.target.value)}
                >
                  <option value="">— choose a shift —</option>
                  {myShifts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {shiftLabel(a)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Target employee ID
              </label>
              <input
                type="text"
                placeholder="e.g. emp_abc123"
                className={inputCls}
                value={targetEmployeeId}
                onChange={(e) => setTargetEmployeeId(e.target.value)}
              />
              <p className="text-xs text-slate-400 mt-1">
                Ask your manager or coworker for their employee ID.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SwapCard({
  req,
  employeeId,
  shiftLabel,
}: {
  req: ShiftSwapRequest;
  employeeId: string;
  shiftLabel: string;
}) {
  const isRequester = req.requester_id === employeeId;
  const other = isRequester
    ? req.target_employee?.name ?? req.target_employee_id
    : req.requester?.name ?? req.requester_id;
  const role = isRequester ? "You → " : "← From ";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-3 hover:shadow-md transition-all duration-150">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">{shiftLabel}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {role}
            <span className="font-semibold text-slate-700">{other}</span>
          </p>
          {req.manager_note && (
            <p className="text-xs text-slate-400 mt-1 italic">"{req.manager_note}"</p>
          )}
        </div>
        <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_STYLES[req.status] ?? "bg-slate-100 text-slate-600"}`}>
          {req.status}
        </span>
      </div>
    </div>
  );
}
