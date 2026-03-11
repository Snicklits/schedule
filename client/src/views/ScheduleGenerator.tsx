import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { generateSchedule, fetchCoverageCheck, fetchBudget, saveBudget } from "../api/endpoints.js";
import type { ScheduleGenerateResult, CoverageCheckResult, BudgetStatus } from "../api/types.js";
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

  // Budget state
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetSaved, setBudgetSaved] = useState(false);

  useEffect(() => {
    fetchBudget(weekStart)
      .then((b) => {
        setBudget(b);
        if (b.budget_hours != null) setBudgetInput(String(b.budget_hours));
      })
      .catch(() => setBudget(null));
  }, [weekStart]);

  async function handleSaveBudget() {
    const hours = parseFloat(budgetInput);
    if (isNaN(hours) || hours <= 0) return;
    setSavingBudget(true);
    try {
      await saveBudget(weekStart, hours);
      const updated = await fetchBudget(weekStart);
      setBudget(updated);
      setBudgetSaved(true);
      setTimeout(() => setBudgetSaved(false), 2000);
    } catch {
      // ignore budget errors
    } finally {
      setSavingBudget(false);
    }
  }

  const runCoverageCheck = useCallback(async (week: string) => {
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
  }, []);

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
      const errData = (err as { response?: { data?: { error?: { message?: string }; details?: { errors?: unknown[]; warnings?: string[]; isPublishable?: boolean; runId?: string } } } })?.response?.data;
      const msg = errData?.error?.message ?? "Failed to generate schedule";
      // If backend returned structured error with details, show as result
      if (errData?.details) {
        const det = errData.details;
        setResult({
          runId: det.runId ?? "",
          schedule: [],
          errors: (det.errors ?? []) as ScheduleGenerateResult["errors"],
          warnings: det.warnings ?? [],
          isPublishable: false,
        });
      } else {
        setError(msg);
      }
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

  // Budget bar
  const budgetHours = budget?.budget_hours;
  const scheduledHours = budget?.scheduled_hours ?? 0;
  const budgetPct = budgetHours ? Math.min(100, (scheduledHours / budgetHours) * 100) : 0;
  const budgetColor = !budgetHours
    ? "bg-gray-300"
    : scheduledHours > budgetHours
      ? "bg-red-500"
      : scheduledHours >= budgetHours - 10
        ? "bg-amber-400"
        : "bg-green-500";

  const publishBlocked =
    !result?.isPublishable ||
    checkingCoverage ||
    (coverageCheck !== null && !coverageCheck.isFullyCovered);

  const publishTooltip = !result?.isPublishable
    ? "Cannot publish: schedule generation halted with blocking errors"
    : checkingCoverage
      ? "Checking coverage…"
      : coverageCheck && !coverageCheck.isFullyCovered
        ? `Cannot publish: coverage gaps detected`
        : "Publish this schedule";

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Generate Schedule</h1>
        <p className="text-sm text-gray-500">Auto-assign employees to shifts for the selected week</p>
      </div>

      <div className="bg-white rounded-lg border shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Week Starting (Monday)</label>
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(toMonday(e.target.value))}
            className="border rounded px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-400 mt-1">Auto-snapped to Monday</p>
        </div>

        {/* Budget input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Weekly Labour Budget (hours)</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className="border rounded px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. 416"
            />
            <button
              onClick={handleSaveBudget}
              disabled={savingBudget || !budgetInput}
              className="bg-gray-100 hover:bg-gray-200 border text-gray-700 font-medium px-4 py-2 rounded text-sm disabled:opacity-50"
            >
              {savingBudget ? "…" : budgetSaved ? "✓" : "Set"}
            </button>
          </div>
        </div>

        {/* Budget bar */}
        {budgetHours != null && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>{scheduledHours.toFixed(1)} / {budgetHours} hrs budgeted this week</span>
              <span className={budget?.status === "OVER" ? "text-red-600 font-semibold" : budget?.status === "ON_TRACK" ? "text-green-600" : "text-gray-500"}>
                {budget?.status}
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${budgetColor}`} style={{ width: `${budgetPct}%` }} />
            </div>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2 rounded text-sm transition-colors"
        >
          {loading ? "Generating…" : "Generate Schedule"}
        </button>
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {result && (
        <div className={`rounded-lg border p-6 space-y-4 ${result.isPublishable ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}>
          <div className="flex items-center gap-3">
            <span className={`text-2xl ${result.isPublishable ? "text-green-600" : "text-red-600"}`}>
              {result.isPublishable ? "✓" : "✗"}
            </span>
            <div>
              <p className="font-semibold text-gray-800">{result.isPublishable ? "Schedule Generated" : "Generation HALTED"}</p>
              {result.runId && <p className="text-xs text-gray-500">Run ID: {result.runId}</p>}
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-red-700">Errors ({result.errors.length}):</p>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-0.5">
                {result.errors.map((e, i) => <li key={i}>{e.reason}</li>)}
              </ul>
            </div>
          )}

          {result.warnings.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-yellow-700">Warnings ({result.warnings.length}):</p>
              <ul className="list-disc list-inside text-sm text-yellow-700 space-y-0.5">
                {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {result.isPublishable && (
            <div className="border-t pt-3">
              {checkingCoverage && <p className="text-xs text-gray-400">Checking coverage…</p>}
              {!checkingCoverage && coverageCheck && (
                coverageCheck.isFullyCovered
                  ? <p className="text-sm text-green-700 font-medium">✓ Full management coverage confirmed</p>
                  : (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-red-700">Coverage gaps prevent publishing:</p>
                      {coverageCheck.managementGaps.length > 0 && (
                        <p className="text-xs text-red-600">{coverageCheck.managementGaps.length} shift(s) without management</p>
                      )}
                      {coverageCheck.peakWithoutManager.length > 0 && (
                        <p className="text-xs text-yellow-700">{coverageCheck.peakWithoutManager.length} peak shift(s) without a Manager</p>
                      )}
                    </div>
                  )
              )}
            </div>
          )}

          {result.isPublishable && result.schedule.length > 0 && (
            <details className="border-t pt-3">
              <summary className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                Preview assignments ({result.schedule.length})
              </summary>
              <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                {result.schedule.map((a, i) => (
                  <div key={a.id ?? (a.shift_id + i)} className="text-xs flex items-center gap-2 py-0.5">
                    <span className="text-gray-500 w-20 shrink-0">{(a.shift?.date ?? "").slice(5, 10)}</span>
                    <span className="text-gray-500 w-24 shrink-0">
                      {(a.shift?.start_time ?? '').slice(11, 16)}–{(a.shift?.end_time ?? '').slice(11, 16)}
                    </span>
                    <span className="font-medium text-gray-800">{a.employee?.name ?? a.employee_id}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          <div className="flex gap-3 border-t pt-3">
            <button onClick={handleDiscard} className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded text-sm">
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
