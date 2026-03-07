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

  async function handleGapConfirm() {
    setConfirming(true);
    try {
      showToast("Request kept pending — resolve coverage gaps first", "info");
      setCoverageGap(null);
    } finally {
      setConfirming(false);
    }
  }

  const tabs: Tab[] = ["PENDING", "APPROVED", "DENIED"];

  const TAB_COUNT_STYLES: Record<Tab, string> = {
    PENDING:  "bg-amber-50 text-amber-700 border-amber-200",
    APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    DENIED:   "bg-red-50 text-red-600 border-red-200",
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Time-Off Dashboard</h2>
        <p className="text-xs text-slate-400 mt-0.5">Review and manage employee time-off requests</p>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Tab bar */}
      <div className="flex rounded-xl border border-slate-200 overflow-hidden p-0.5 bg-slate-50 gap-0.5 w-fit">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
              tab === t
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full border ${TAB_COUNT_STYLES[t]}`}>
              {all.filter((r) => r.status === t).length}
            </span>
          </button>
        ))}
      </div>

      {/* Request list */}
      <div className="space-y-2">
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center h-32 text-sm text-slate-400">
            Loading…
          </div>
        ) : visible.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center h-32 text-sm text-slate-400 italic">
            No {tab.toLowerCase()} requests
          </div>
        ) : (
          visible.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-start justify-between gap-4 hover:shadow-md transition-all duration-150">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {r.employee.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div className="space-y-0.5">
                  <p className="font-semibold text-slate-800">{r.employee.name}</p>
                  <p className="text-xs text-slate-500">
                    {r.type} · {r.start_date.slice(0, 10)} → {r.end_date.slice(0, 10)}
                  </p>
                  <p className="text-xs text-slate-400">
                    {r.employee.management_tier.replace("_", " ")} · Priority {r.priority}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {tab === "PENDING" && (
                  <>
                    <button
                      onClick={() => handleApprove(r.id, "APPROVED")}
                      className="h-8 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-all duration-150"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleApprove(r.id, "DENIED")}
                      className="h-8 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition-all duration-150"
                    >
                      Deny
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleDelete(r.id)}
                  className="h-8 px-3 rounded-xl text-xs font-medium text-red-500 hover:bg-red-50 transition-all duration-150"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {coverageGap && (
        <Modal
          title="Management Coverage Gap"
          onClose={() => setCoverageGap(null)}
          footer={
            <>
              <button
                onClick={() => setCoverageGap(null)}
                className="h-9 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-all duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleGapConfirm}
                disabled={confirming}
                className="h-9 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold transition-all duration-150"
              >
                {confirming ? "…" : "Noted — keep pending"}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              Approving this request would break management coverage. The request cannot be approved
              while these conflicts exist:
            </p>
            <ul className="list-disc list-inside text-sm text-red-700 space-y-1 bg-red-50 border border-red-100 rounded-xl p-3">
              {coverageGap.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            <p className="text-xs text-slate-400">
              Resolve the coverage conflicts first, then re-approve this request.
              Click "Noted — keep pending" to acknowledge and leave the request pending.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
