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
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Generate Schedule</h2>
        <p className="text-xs text-slate-400 mt-0.5">Auto-assign employees to shifts for the selected week</p>
      </div>

      {/* Config card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Week Starting (Monday)</label>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(toMonday(e.target.value))}
            className="w-full h-10 px-4 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white transition-all"
          />
          <p className="text-xs text-slate-400 mt-1">Auto-snapped to Monday</p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
        >
          {loading ? "Generating…" : "Generate Schedule"}
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {result && (
        <div className={`bg-white rounded-2xl shadow-sm border p-6 space-y-4 ${
          result.isPublishable ? "border-emerald-200" : "border-red-200"
        }`}>
          {/* Status header */}
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold ${
              result.isPublishable ? "bg-gradient-to-br from-emerald-400 to-emerald-500" : "bg-gradient-to-br from-red-400 to-red-500"
            }`}>
              {result.isPublishable ? "✓" : "✗"}
            </div>
            <div>
              <p className="font-semibold text-slate-800">
                {result.isPublishable ? "Schedule Generated" : "Generation HALTED"}
              </p>
              <p className="text-xs text-slate-400">Run ID: {result.runId}</p>
            </div>
          </div>

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-1">
              <p className="text-sm font-semibold text-red-700">Errors ({result.errors.length}):</p>
              <ul className="list-disc list-inside text-sm text-red-600 space-y-0.5">
                {result.errors.map((e, i) => (
                  <li key={i}>{e.reason}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-1">
              <p className="text-sm font-semibold text-amber-700">Warnings ({result.warnings.length}):</p>
              <ul className="list-disc list-inside text-sm text-amber-600 space-y-0.5">
                {result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Coverage check result */}
          {result.isPublishable && (
            <div className="border-t border-slate-100 pt-4">
              {checkingCoverage && (
                <p className="text-xs text-slate-400">Checking coverage…</p>
              )}
              {!checkingCoverage && coverageCheck && (
                coverageCheck.isFullyCovered ? (
                  <p className="text-sm text-emerald-700 font-medium">✓ Full management coverage confirmed</p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-red-700">Coverage gaps prevent publishing:</p>
                    {coverageCheck.managementGaps.length > 0 && (
                      <p className="text-xs text-red-600">
                        {coverageCheck.managementGaps.length} shift(s) without any management presence
                      </p>
                    )}
                    {coverageCheck.peakWithoutManager.length > 0 && (
                      <p className="text-xs text-amber-700">
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
            <details className="border-t border-slate-100 pt-4">
              <summary className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
                Preview assignments ({result.schedule.length})
              </summary>
              <div className="mt-3 max-h-48 overflow-y-auto space-y-1.5">
                {result.schedule.map((a) => (
                  <div key={a.id} className="text-xs flex items-center gap-2 py-0.5">
                    <span className="text-slate-400 w-20 shrink-0">{a.shift.date.slice(5)}</span>
                    <span className="text-slate-400 w-24 shrink-0">
                      {a.shift.start_time.slice(11, 16)}–{a.shift.end_time.slice(11, 16)}
                    </span>
                    <span className="font-semibold text-slate-800">{a.employee.name}</span>
                    <span className="text-slate-400">({a.employee.management_tier.replace("_", " ")})</span>
                    {a.shift.required_specialty && (
                      <span className="text-slate-400">· {a.shift.required_specialty}</span>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Actions */}
          <div className="flex gap-3 border-t border-slate-100 pt-4">
            <button
              onClick={handleDiscard}
              className="h-9 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-all duration-150"
            >
              Discard
            </button>
            <div className="relative group">
              <button
                onClick={handlePublish}
                disabled={publishBlocked}
                className="h-9 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all duration-150 shadow-sm"
              >
                {checkingCoverage ? "Checking coverage…" : "Publish Schedule"}
              </button>
              {publishBlocked && (
                <div className="absolute bottom-full left-0 mb-1 w-72 bg-slate-900 text-white text-xs rounded-xl px-3 py-2 hidden group-hover:block z-10 pointer-events-none">
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
