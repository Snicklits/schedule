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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">My Schedule</h1>
        <input
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading your schedule…</p>
      ) : (
        <>
          {/* Summary bar */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-4 text-sm">
            <span className="font-medium text-blue-800">{assignments.length} shifts</span>
            <span className="text-blue-600">{totalHours}h scheduled this week</span>
            {totalHours >= 40 && (
              <span className="text-xs bg-red-100 text-red-700 border border-red-300 rounded px-2 py-0.5">
                AT CAP
              </span>
            )}
            {totalHours >= 35 && totalHours < 40 && (
              <span className="text-xs bg-yellow-100 text-yellow-700 border border-yellow-300 rounded px-2 py-0.5">
                NEAR CAP
              </span>
            )}
          </div>

          {/* Week grid */}
          <div className="grid grid-cols-7 gap-2">
            {DAYS.map((day, i) => {
              const date = dayDates[i];
              const dayShifts = assignments.filter(
                (a) => a.shift.date.slice(0, 10) === date
              );
              const isToday = date === new Date().toISOString().slice(0, 10);

              return (
                <div
                  key={day}
                  className={`rounded-lg border p-2 min-h-[80px] ${
                    isToday ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white"
                  }`}
                >
                  <div className={`text-xs font-semibold mb-1 ${isToday ? "text-blue-700" : "text-gray-500"}`}>
                    {day}
                    <span className="ml-1 font-normal">{date.slice(5)}</span>
                  </div>
                  {dayShifts.length === 0 ? (
                    <p className="text-xs text-gray-300 italic">Off</p>
                  ) : (
                    dayShifts.map((a) => (
                      <div
                        key={a.id}
                        className="text-xs bg-blue-100 text-blue-800 rounded p-1 mb-1"
                      >
                        <div className="font-medium">
                          {fmt(a.shift.start_time)}–{fmt(a.shift.end_time)}
                        </div>
                        {a.shift.required_specialty && (
                          <div className="text-blue-600">{a.shift.required_specialty}</div>
                        )}
                        <div className="text-blue-500">{a.assigned_hours}h</div>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>

          {assignments.length === 0 && (
            <p className="text-gray-400 text-sm italic text-center">
              No shifts scheduled for this week.
            </p>
          )}
        </>
      )}
    </div>
  );
}
