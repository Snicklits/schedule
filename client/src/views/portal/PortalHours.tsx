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
      ? "bg-red-500"
      : pct >= 87
      ? "bg-yellow-400"
      : "bg-green-500";

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
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">My Hours</h1>

      {/* Week nav */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={prevWeek}
          className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm font-medium"
        >
          ← Prev
        </button>
        <span className="font-semibold text-gray-700">
          {weekStart} — {weekEnd}
        </span>
        <button
          onClick={nextWeek}
          className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm font-medium"
        >
          Next →
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading && (
        <p className="text-gray-500 text-sm">Loading hours…</p>
      )}

      {!loading && summary && (
        <>
          {/* Hours summary card */}
          <div className="bg-white rounded-xl shadow p-5 mb-6 border border-gray-100">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-sm text-gray-500 mb-1">Hours this week</p>
                <p className="text-4xl font-bold text-gray-900">
                  {summary.weeklyHours.toFixed(1)}
                  <span className="text-xl font-normal text-gray-400 ml-1">
                    / {summary.targetHours}h
                  </span>
                </p>
              </div>
              <div className="text-right">
                {summary.isAtCap && (
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                    AT CAP
                  </span>
                )}
                {!summary.isAtCap && pct >= 87 && (
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
                    NEAR CAP
                  </span>
                )}
                {pct < 87 && (
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                    {pct}%
                  </span>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {summary.targetHours - summary.weeklyHours > 0
                ? `${(summary.targetHours - summary.weeklyHours).toFixed(1)}h remaining`
                : "Full week reached"}
            </p>
          </div>

          {/* Shifts breakdown */}
          <h2 className="text-lg font-semibold mb-3">Scheduled Shifts</h2>
          {summary.assignments.length === 0 ? (
            <p className="text-gray-400 text-sm">No shifts scheduled this week.</p>
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
                    className="flex items-center justify-between bg-white rounded-lg border border-gray-100 shadow-sm px-4 py-3"
                  >
                    <div>
                      <span className="font-medium text-gray-800">
                        {dayLabel},{" "}
                        {shiftDate.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="ml-3 text-sm text-gray-500">
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
                    <span className="text-sm font-semibold text-gray-700">
                      {hours.toFixed(1)}h
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {!loading && !summary && !error && (
        <p className="text-gray-400 text-sm">No data available for this week.</p>
      )}
    </div>
  );
}
