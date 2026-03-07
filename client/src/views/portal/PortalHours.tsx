import { useEffect, useState } from "react";
import { fetchPortalHours } from "../../api/endpoints";
import type { PortalHoursSummary } from "../../api/types";
import { ErrorBanner } from "../../components/ErrorBanner";

function weekStartMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function PortalHours() {
  const [summary, setSummary] = useState<PortalHoursSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => weekStartMonday(new Date()));

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchPortalHours(weekStart)
      .then(setSummary)
      .catch((e) => setError(e?.response?.data?.message ?? e.message))
      .finally(() => setLoading(false));
  }, [weekStart]);

  const pct = summary
    ? Math.min(100, Math.round((summary.weeklyHours / summary.targetHours) * 100))
    : 0;

  const barColor =
    summary?.isAtCap
      ? "bg-red-400"
      : pct >= 87
      ? "bg-amber-400"
      : "bg-indigo-400";

  function prevWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d.toISOString().slice(0, 10));
  }

  function nextWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d.toISOString().slice(0, 10));
  }

  const weekEnd = (() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900">My Hours</h2>
        <p className="text-xs text-slate-400 mt-0.5">Track your scheduled hours and progress</p>
      </div>

      {/* Week nav */}
      <div className="flex items-center gap-3">
        <button
          onClick={prevWeek}
          className="h-8 px-3 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all duration-150"
        >
          ← Prev
        </button>
        <span className="flex-1 text-center text-sm font-semibold text-slate-700">
          {weekStart} — {weekEnd}
        </span>
        <button
          onClick={nextWeek}
          className="h-8 px-3 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all duration-150"
        >
          Next →
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center h-32 text-sm text-slate-400">
          Loading hours…
        </div>
      )}

      {!loading && summary && (
        <>
          {/* Hours summary card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">Hours this week</p>
                <p className="text-4xl font-bold text-slate-900">
                  {summary.weeklyHours.toFixed(1)}
                  <span className="text-xl font-normal text-slate-400 ml-1">
                    / {summary.targetHours}h
                  </span>
                </p>
              </div>
              <div>
                {summary.isAtCap && (
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                    AT CAP
                  </span>
                )}
                {!summary.isAtCap && pct >= 87 && (
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                    NEAR CAP
                  </span>
                )}
                {pct < 87 && (
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                    {pct}%
                  </span>
                )}
              </div>
            </div>

            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-slate-400">
              {summary.targetHours - summary.weeklyHours > 0
                ? `${(summary.targetHours - summary.weeklyHours).toFixed(1)}h remaining`
                : "Full week reached"}
            </p>
          </div>

          {/* Shifts breakdown */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Scheduled Shifts</h3>
            {summary.assignments.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center h-24 text-sm text-slate-400">
                No shifts scheduled this week.
              </div>
            ) : (
              <div className="space-y-2">
                {summary.assignments.map((a) => {
                  const shiftDate = new Date(a.shift?.date ?? "");
                  const dayLabel =
                    DAYS[shiftDate.getDay() === 0 ? 6 : shiftDate.getDay() - 1] ?? "";
                  const hours =
                    a.shift
                      ? ((new Date(a.shift.end_time).getTime() -
                          new Date(a.shift.start_time).getTime()) /
                          3_600_000)
                      : 0;
                  return (
                    <div
                      key={a.id}
                      className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-3 flex items-center justify-between hover:shadow-md transition-all duration-150"
                    >
                      <div>
                        <span className="font-semibold text-slate-800 text-sm">
                          {dayLabel},{" "}
                          {shiftDate.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span className="ml-3 text-xs text-slate-500">
                          {a.shift
                            ? `${new Date(a.shift.start_time).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })} – ${new Date(a.shift.end_time).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`
                            : "—"}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-slate-700">
                        {hours.toFixed(1)}h
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {!loading && !summary && !error && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center h-32 text-sm text-slate-400">
          No data available for this week.
        </div>
      )}
    </div>
  );
}
