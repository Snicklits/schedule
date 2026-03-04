import { useState } from "react";
import { generateSchedule } from "../api/endpoints.js";
import type { ScheduleGenerateResult } from "../api/types.js";
import { ErrorBanner } from "../components/ErrorBanner.js";
import { useAlerts } from "../contexts/AlertsContext.js";

function toMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay();
  const diff = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

export function ScheduleGenerator() {
  const [weekStart, setWeekStart] = useState(() => toMonday(new Date().toISOString().slice(0, 10)));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScheduleGenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { refresh } = useAlerts();

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await generateSchedule(weekStart);
      setResult(data);
      refresh();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? "Failed to generate schedule";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto py-10 px-4 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Generate Schedule</h1>

      <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Week Starting (Monday)</label>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(toMonday(e.target.value))}
            className="border rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Auto-snapped to Monday</p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded text-sm transition-colors"
        >
          {loading ? "Generating…" : "Generate Schedule"}
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {result && (
        <div
          className={`rounded-lg border p-6 space-y-3 ${
            result.isPublishable
              ? "bg-green-50 border-green-300"
              : "bg-red-50 border-red-300"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`text-2xl ${result.isPublishable ? "text-green-600" : "text-red-600"}`}
            >
              {result.isPublishable ? "✓" : "✗"}
            </span>
            <div>
              <p className="font-semibold text-gray-800">
                {result.isPublishable ? "Schedule Generated" : "Generation HALTED"}
              </p>
              <p className="text-xs text-gray-500">Run ID: {result.runId}</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-red-700">Errors ({result.errors.length}):</p>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-0.5">
                {result.errors.map((e, i) => (
                  <li key={i}>{e.reason}</li>
                ))}
              </ul>
            </div>
          )}

          {result.warnings.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-yellow-700">Warnings ({result.warnings.length}):</p>
              <ul className="list-disc list-inside text-sm text-yellow-700 space-y-0.5">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            disabled={!result.isPublishable}
            className="mt-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded text-sm"
          >
            Publish Schedule
          </button>
        </div>
      )}
    </div>
  );
}
