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

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700 border-yellow-300",
  APPROVED: "bg-green-100 text-green-700 border-green-300",
  DENIED: "bg-red-100 text-red-700 border-red-300",
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

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">My Time Off</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded"
        >
          + Request Time Off
        </button>
      </div>

      {/* Stats */}
      {requests.length > 0 && (
        <div className="flex gap-4 text-sm">
          <span className="text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-1">
            {pending} pending
          </span>
          <span className="text-green-700 bg-green-50 border border-green-200 rounded px-3 py-1">
            {approved} approved
          </span>
        </div>
      )}

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <div className="space-y-2">
          {requests.length === 0 && (
            <p className="text-gray-400 text-sm italic text-center py-8">
              No time-off requests yet. Click "+ Request Time Off" to submit one.
            </p>
          )}
          {requests.map((r) => (
            <div
              key={r.id}
              className="bg-white border rounded-lg p-4 flex items-center justify-between gap-4"
            >
              <div className="space-y-0.5">
                <p className="font-medium text-gray-800">{TYPE_LABELS[r.type] ?? r.type}</p>
                <p className="text-sm text-gray-500">
                  {r.start_date.slice(0, 10)} → {r.end_date.slice(0, 10)}
                </p>
                <p className="text-xs text-gray-400">
                  Submitted {r.created_at.slice(0, 10)}
                </p>
              </div>
              <span
                className={`text-xs font-medium border rounded px-2 py-0.5 ${
                  STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-600 border-gray-300"
                }`}
              >
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal
          title="Request Time Off"
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button
                onClick={() => setShowForm(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm"
              >
                {submitting ? "Submitting…" : "Submit Request"}
              </button>
            </>
          }
        >
          <div className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {Object.entries(TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Your request will be reviewed by a manager. You'll receive an email when a decision is made.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
