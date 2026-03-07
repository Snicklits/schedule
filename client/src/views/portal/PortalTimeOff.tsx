import { useState, useEffect, useCallback } from "react";
import { fetchPortalTimeOff, submitPortalTimeOff } from "../../api/endpoints.js";
import type { TimeOffRequest } from "../../api/types.js";
import { ErrorBanner } from "../../components/ErrorBanner.js";
import { Modal } from "../../components/Modal.js";
import { useToast } from "../../contexts/ToastContext.js";

const TYPE_LABELS: Record<string, string> = {
  VACATION: "Vacation",
  SICK: "Sick Leave",
  PERSONAL: "Personal",
  UNPAID: "Unpaid",
};

const STATUS_STYLES: Record<string, string> = {
  PENDING:  "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  DENIED:   "bg-red-100 text-red-600",
};

export function PortalTimeOff() {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    type: "VACATION",
    startDate: "",
    endDate: "",
  });
  const { showToast } = useToast();

  const load = useCallback(() => {
    setLoading(true);
    fetchPortalTimeOff()
      .then(setRequests)
      .catch(() => setError("Failed to load time-off requests"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.startDate || !form.endDate) {
      setError("Please fill in all fields");
      return;
    }
    if (form.endDate < form.startDate) {
      setError("End date must be on or after start date");
      return;
    }
    setSubmitting(true);
    try {
      await submitPortalTimeOff({
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
      });
      showToast("Time-off request submitted", "success");
      setShowForm(false);
      setForm({ type: "VACATION", startDate: "", endDate: "" });
      load();
    } catch {
      setError("Failed to submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const pending  = requests.filter((r) => r.status === "PENDING").length;
  const approved = requests.filter((r) => r.status === "APPROVED").length;

  const inputCls = "w-full h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white transition-all";

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">My Time Off</h2>
          <p className="text-xs text-slate-400 mt-0.5">Request and track your time-off</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="h-9 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 transition-all duration-150 shadow-sm"
        >
          + Request Time Off
        </button>
      </div>

      {/* Stats */}
      {requests.length > 0 && (
        <div className="flex gap-3">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-3 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-amber-600">{pending}</span>
            <span className="text-xs text-slate-400">pending</span>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-3 flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-emerald-600">{approved}</span>
            <span className="text-xs text-slate-400">approved</span>
          </div>
        </div>
      )}

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Request list */}
      <div className="space-y-2">
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center h-32 text-sm text-slate-400">
            Loading…
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center h-32 gap-2">
            <p className="text-sm text-slate-400 italic">No time-off requests yet.</p>
            <button
              onClick={() => setShowForm(true)}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Submit your first request
            </button>
          </div>
        ) : (
          requests.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center justify-between gap-4 hover:shadow-md transition-all duration-150"
            >
              <div className="space-y-0.5">
                <p className="font-semibold text-slate-800">{TYPE_LABELS[r.type] ?? r.type}</p>
                <p className="text-sm text-slate-500">
                  {r.start_date.slice(0, 10)} → {r.end_date.slice(0, 10)}
                </p>
                <p className="text-xs text-slate-400">
                  Submitted {r.created_at.slice(0, 10)}
                </p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[r.status] ?? "bg-slate-100 text-slate-600"}`}>
                {r.status}
              </span>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <Modal
          title="Request Time Off"
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button
                onClick={() => setShowForm(false)}
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
          <div className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className={inputCls}
              >
                {Object.entries(TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">End Date</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Your request will be reviewed by a manager. You'll receive an email when a decision is made.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
