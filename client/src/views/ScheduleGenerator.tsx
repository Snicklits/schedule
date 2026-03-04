import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { generateSchedule, fetchCoverageCheck } from "../api/endpoints.js";
import type { ScheduleGenerateResult, CoverageCheckResult } from "../api/types.js";
import { ErrorBanner } from "../components/ErrorBanner.js";
import { useAlerts } from "../contexts/AlertsContext.js";

function toMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function ScheduleGenerator() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => toMonday(new Date().toISOString().slice(0, 10)));
  const [loading, setLoading] = useState(false);
  const [checkingCoverage, setCheckingCoverage] = useState(false);
  const [result, setResult] = useState<ScheduleGenerateResult | null>(null);
  const [coverageCheck, setCoverageCheck] = useState<CoverageCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { refresh } = useAlerts();

  const runCoverageCheck = useCallback(
    async (week: string) => {
      setCheckingCoverage(true);
      try {
        const check = await fetchCoverageCheck(week);
        setCoverageCheck(check);
        return check;
      } catch {
        // Coverage check failure is non-blocking for viewing results
        setCoverageCheck(null);
        return null;
      } finally {
        setCheckingCoverage(false);
      }
    },
    []
  );

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    setCoverageCheck(null);
    try {
      const data = await generateSchedule(weekStart);
      setResult(data);
      refresh();
      if (data.isPublishable) {
        await runCoverageCheck(weekStart);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? "Failed to generate schedule";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleDiscard() {
    setResult(null);
    setCoverageCheck(null);
    setError(null);
  }

  function handlePublish() {
    // Navigate to the schedule grid for the generated week
    navigate(`/?week=${weekStart}`);
  }

  const publishBlocked =
    !result?.isPublishable ||
    checkingCoverage ||
    (coverageCheck !== null && !coverageCheck.isFullyCovered);

  const publishTooltip = !result?.isPublishable
    ? "Cannot publish: schedule generation halted with blocking errors"
    : checkingCoverage
      ? "Checking coverage…"
      : coverageCheck && !coverageCheck.isFullyCovered
        ? `Cannot publish: ${coverageCheck.managementGaps.length} management gap(s) and ${coverageCheck.peakWithoutManager.length} peak shift(s) without a manager`
        : "Publish this schedule";

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-6">
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
          className={`rounded-lg border p-6 space-y-4 ${
            result.isPublishable ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"
          }`}
        >
          {/* Status header */}
          <div className="flex items-center gap-3">
            <span className={`text-2xl ${result.isPublishable ? "text-green-600" : "text-red-600"}`}>
              {result.isPublishable ? "✓" : "✗"}
            </span>
            <div>
              <p className="font-semibold text-gray-800">
                {result.isPublishable ? "Schedule Generated" : "Generation HALTED"}
              </p>
              <p className="text-xs text-gray-500">Run ID: {result.runId}</p>
            </div>
          </div>

          {/* Errors */}
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

          {/* Warnings */}
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

          {/* Coverage check result */}
          {result.isPublishable && (
            <div className="border-t pt-3">
              {checkingCoverage && (
                <p className="text-xs text-gray-400">Checking coverage…</p>
              )}
              {!checkingCoverage && coverageCheck && (
                coverageCheck.isFullyCovered ? (
                  <p className="text-sm text-green-700 font-medium">✓ Full management coverage confirmed</p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-red-700">Coverage gaps prevent publishing:</p>
                    {coverageCheck.managementGaps.length > 0 && (
                      <p className="text-xs text-red-600">
                        {coverageCheck.managementGaps.length} shift(s) without any management presence
                      </p>
                    )}
                    {coverageCheck.peakWithoutManager.length > 0 && (
                      <p className="text-xs text-yellow-700">
                        {coverageCheck.peakWithoutManager.length} peak shift(s) without a Manager (AM only)
                      </p>
                    )}
                  </div>
                )
              )}
            </div>
          )}

          {/* Assignment preview */}
          {result.isPublishable && result.schedule.length > 0 && (
            <details className="border-t pt-3">
              <summary className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                Preview assignments ({result.schedule.length})
              </summary>
              <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                {result.schedule.map((a) => (
                  <div key={a.id} className="text-xs flex items-center gap-2 py-0.5">
                    <span className="text-gray-500 w-20 shrink-0">{a.shift.date.slice(5)}</span>
                    <span className="text-gray-500 w-24 shrink-0">
                      {a.shift.start_time.slice(11, 16)}–{a.shift.end_time.slice(11, 16)}
                    </span>
                    <span className="font-medium text-gray-800">{a.employee.name}</span>
                    <span className="text-gray-400">({a.employee.management_tier.replace("_", " ")})</span>
                    {a.shift.required_specialty && (
                      <span className="text-gray-400">· {a.shift.required_specialty}</span>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Actions */}
          <div className="flex gap-3 border-t pt-3">
            <button
              onClick={handleDiscard}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded text-sm"
            >
              Discard
            </button>
            <div className="relative group">
              <button
                onClick={handlePublish}
                disabled={publishBlocked}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded text-sm"
              >
                {checkingCoverage ? "Checking coverage…" : "Publish Schedule"}
              </button>
              {publishBlocked && (
                <div className="absolute bottom-full left-0 mb-1 w-72 bg-gray-900 text-white text-xs rounded px-2 py-1 hidden group-hover:block z-10 pointer-events-none">
                  {publishTooltip}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
