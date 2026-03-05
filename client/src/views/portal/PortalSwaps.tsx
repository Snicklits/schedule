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

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-700",
  DENIED: "bg-red-100 text-red-700",
};

export function PortalSwaps() {
  const { employeeId } = useAuth();
  const { showToast } = useToast();
  const [swaps, setSwaps] = useState<ShiftSwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Submit form state
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

    // Load current week's shifts for the employee
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

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Shift Swaps</h1>
        <button
          onClick={openForm}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          + Request Swap
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading && <p className="text-gray-500 text-sm">Loading swap requests…</p>}

      {!loading && swaps.length === 0 && (
        <p className="text-gray-400 text-sm">No swap requests yet.</p>
      )}

      {!loading && pending.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Pending ({pending.length})
          </h2>
          <div className="space-y-2 mb-6">
            {pending.map((req) => (
              <SwapCard key={req.id} req={req} employeeId={employeeId ?? ""} shiftLabel={swapShiftLabel(req)} />
            ))}
          </div>
        </>
      )}

      {!loading && resolved.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Resolved ({resolved.length})
          </h2>
          <div className="space-y-2">
            {resolved.map((req) => (
              <SwapCard key={req.id} req={req} employeeId={employeeId ?? ""} shiftLabel={swapShiftLabel(req)} />
            ))}
          </div>
        </>
      )}

      {/* Submit form modal */}
      {showForm && <Modal
        title="Request Shift Swap"
        onClose={() => setShowForm(false)}
      >
        <div className="space-y-4">
          {formError && (
            <p className="text-sm text-red-600 bg-red-50 rounded p-2">{formError}</p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select your shift
            </label>
            {shiftsLoading ? (
              <p className="text-sm text-gray-400">Loading shifts…</p>
            ) : myShifts.length === 0 ? (
              <p className="text-sm text-gray-400">No shifts this week to swap.</p>
            ) : (
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target employee ID
            </label>
            <input
              type="text"
              placeholder="e.g. emp_abc123"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={targetEmployeeId}
              onChange={(e) => setTargetEmployeeId(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Ask your manager or coworker for their employee ID.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        </div>
      </Modal>}

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
    <div className="bg-white rounded-lg border border-gray-100 shadow-sm px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-gray-800">{shiftLabel}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {role}
            <span className="font-medium text-gray-700">{other}</span>
          </p>
          {req.manager_note && (
            <p className="text-xs text-gray-400 mt-1 italic">"{req.manager_note}"</p>
          )}
        </div>
        <span
          className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${
            STATUS_COLORS[req.status] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {req.status}
        </span>
      </div>
    </div>
  );
}
