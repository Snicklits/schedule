import { useState, useEffect } from "react";
import { fetchPortalSchedule } from "../../api/endpoints.js";
import type { AssignmentWithDetails } from "../../api/types.js";
import { ErrorBanner } from "../../components/ErrorBanner.js";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function currentMonday(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function addDays(base: string, n: number): string {
  const d = new Date(base + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function fmt(time: string) {
  return time.slice(11, 16);
}

export function PortalSchedule() {
  const [weekStart, setWeekStart] = useState(currentMonday);
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchPortalSchedule(weekStart)
      .then(setAssignments)
      .catch(() => setError("Failed to load your schedule"))
      .finally(() => setLoading(false));
  }, [weekStart]);

  const dayDates = DAYS.map((_, i) => addDays(weekStart, i));
  const totalHours = assignments.reduce((s, a) => s + a.assigned_hours, 0);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">My Schedule</h2>
          <p className="text-xs text-slate-400 mt-0.5">Your upcoming shifts for the week</p>
        </div>
        <input
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
          className="h-8 px-3 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
        />
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center h-40 text-sm text-slate-400">
          Loading your schedule…
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-3 flex items-center gap-4">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900">{assignments.length}</span>
              <span className="text-sm text-slate-400">shifts</span>
            </div>
            <div className="w-px h-8 bg-slate-100" />
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900">{totalHours}</span>
              <span className="text-sm text-slate-400">hours scheduled</span>
            </div>
            {totalHours >= 40 && (
              <span className="ml-auto h-6 px-3 flex items-center rounded-full bg-red-100 text-red-700 text-xs font-bold">
                AT CAP
              </span>
            )}
            {totalHours >= 35 && totalHours < 40 && (
              <span className="ml-auto h-6 px-3 flex items-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                NEAR CAP
              </span>
            )}
          </div>

          {/* Week grid */}
          <div className="grid grid-cols-7 gap-2">
            {DAYS.map((day, i) => {
              const date = dayDates[i];
              const dayShifts = assignments.filter((a) => a.shift.date.slice(0, 10) === date);
              const isToday = date === today;

              return (
                <div
                  key={day}
                  className={`rounded-2xl border p-2.5 min-h-[90px] transition-all ${
                    isToday
                      ? "border-indigo-300 bg-indigo-50/60 shadow-sm"
                      : "border-slate-100 bg-white shadow-sm"
                  }`}
                >
                  <div className={`text-xs font-semibold mb-1.5 ${isToday ? "text-indigo-700" : "text-slate-500"}`}>
                    {day}
                    <span className="ml-1 font-normal text-[10px]">{date.slice(5)}</span>
                    {isToday && (
                      <span className="ml-1 inline-block w-1 h-1 rounded-full bg-indigo-500 align-middle" />
                    )}
                  </div>
                  {dayShifts.length === 0 ? (
                    <p className="text-[10px] text-slate-300 italic">Off</p>
                  ) : (
                    dayShifts.map((a) => (
                      <div
                        key={a.id}
                        className="text-[10px] bg-indigo-100 text-indigo-800 rounded-lg p-1.5 mb-1 space-y-0.5"
                      >
                        <div className="font-semibold">
                          {fmt(a.shift.start_time)}–{fmt(a.shift.end_time)}
                        </div>
                        {a.shift.required_specialty && (
                          <div className="text-indigo-600">{a.shift.required_specialty}</div>
                        )}
                        <div className="text-indigo-500">{a.assigned_hours}h</div>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>

          {assignments.length === 0 && (
            <p className="text-slate-400 text-sm italic text-center py-4">
              No shifts scheduled for this week.
            </p>
          )}
        </>
      )}
    </div>
  );
}
