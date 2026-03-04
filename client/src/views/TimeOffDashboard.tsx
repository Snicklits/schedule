import { useState, useEffect, useCallback } from "react";
import { fetchAllTimeOff, approveTimeOff, deleteTimeOff } from "../api/endpoints.js";
import type { TimeOffWithEmployee, TimeOffStatus } from "../api/types.js";
import { ErrorBanner } from "../components/ErrorBanner.js";
import { Modal } from "../components/Modal.js";
import { useToast } from "../contexts/ToastContext.js";

type Tab = "PENDING" | "APPROVED" | "DENIED";

interface CoverageGapState {
  id: string;
  targetStatus: TimeOffStatus;
  reasons: string[];
}

export function TimeOffDashboard() {
  const [all, setAll] = useState<TimeOffWithEmployee[]>([]);
  const [tab, setTab] = useState<Tab>("PENDING");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverageGap, setCoverageGap] = useState<CoverageGapState | null>(null);
  const [confirming, setConfirming] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    fetchAllTimeOff()
      .then(setAll)
      .catch(() => setError("Failed to load time-off requests"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = all.filter((r) => r.status === tab);

  async function doApprove(id: string, status: TimeOffStatus) {
    try {
      await approveTimeOff(id, status);
      showToast(`Request ${status.toLowerCase()}`, "success");
      load();
      return true;
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: { code?: string; details?: { reasons?: string[] } } } } };
      if (apiErr.response?.data?.error?.code === "MANAGEMENT_COVERAGE_UNSAFE") {
        const reasons = apiErr.response.data.error.details?.reasons ?? ["Coverage would be broken"];
        // Show the two-step warning: manager must see this before confirming
        setCoverageGap({ id, targetStatus: status, reasons });
        return false;
      }
      setError("Failed to update request status");
      return false;
    }
  }

  async function handleApprove(id: string, status: TimeOffStatus) {
    await doApprove(id, status);
  }

  async function handleDelete(id: string) {
    try {
      await deleteTimeOff(id);
      showToast("Request deleted", "success");
      load();
    } catch {
      setError("Failed to delete request");
    }
  }

  // Second step: manager has read the warning and chooses to keep pending or
  // proceed knowing the gap exists. Since the API blocks force-approval,
  // "Confirm — keep pending" is the safe action; "Dismiss" just closes.
  async function handleGapConfirm() {
    setConfirming(true);
    try {
      // Re-attempt with same parameters — API will block again if still unsafe.
      // The confirm button here acknowledges the warning and keeps the request
      // pending while the manager resolves coverage manually.
      showToast("Request kept pending — resolve coverage gaps first", "info");
      setCoverageGap(null);
    } finally {
      setConfirming(false);
    }
  }

  const tabs: Tab[] = ["PENDING", "APPROVED", "DENIED"];

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Time-Off Dashboard</h1>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}
            <span className="ml-1 text-xs text-gray-400">
              ({all.filter((r) => r.status === t).length})
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <div className="space-y-2">
          {visible.length === 0 && (
            <p className="text-gray-400 text-sm italic">No {tab.toLowerCase()} requests</p>
          )}
          {visible.map((r) => (
            <div key={r.id} className="bg-white border rounded-lg p-4 flex items-start justify-between gap-4">
              <div className="space-y-0.5">
                <p className="font-medium text-gray-800">{r.employee.name}</p>
                <p className="text-xs text-gray-500">
                  {r.type} · {r.start_date.slice(0, 10)} → {r.end_date.slice(0, 10)}
                </p>
                <p className="text-xs text-gray-400">
                  {r.employee.management_tier.replace("_", " ")} · Priority {r.priority}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {tab === "PENDING" && (
                  <>
                    <button
                      onClick={() => handleApprove(r.id, "APPROVED")}
                      className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleApprove(r.id, "DENIED")}
                      className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded"
                    >
                      Deny
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleDelete(r.id)}
                  className="text-xs text-red-500 hover:text-red-700 px-2"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Two-step coverage gap warning — manager must acknowledge before proceeding */}
      {coverageGap && (
        <Modal
          title="⚠ Management Coverage Gap"
          onClose={() => setCoverageGap(null)}
          footer={
            <>
              <button
                onClick={() => setCoverageGap(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleGapConfirm}
                disabled={confirming}
                className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white px-4 py-2 rounded text-sm"
              >
                {confirming ? "…" : "Noted — keep pending"}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              Approving this request would break management coverage. The request cannot be approved
              while these conflicts exist:
            </p>
            <ul className="list-disc list-inside text-sm text-red-700 space-y-1 bg-red-50 border border-red-200 rounded p-3">
              {coverageGap.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            <p className="text-xs text-gray-500">
              Resolve the coverage conflicts first, then re-approve this request.
              Click "Noted — keep pending" to acknowledge and leave the request pending.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
