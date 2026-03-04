import { useState, useEffect } from "react";
import { fetchHoursSummary } from "../api/endpoints.js";
import type { HoursSummaryRow } from "../api/types.js";
import { ErrorBanner } from "../components/ErrorBanner.js";

function currentMonday(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function statusChip(row: HoursSummaryRow) {
  const h = row.weeklyHours;
  if (row.isAtCap) return { label: "At Cap", cls: "bg-red-100 text-red-700 border-red-300" };
  if (h >= 35) return { label: "Full", cls: "bg-green-100 text-green-700 border-green-300" };
  if (h >= 20) return { label: "Partial", cls: "bg-yellow-100 text-yellow-700 border-yellow-300" };
  return { label: "Low", cls: "bg-gray-100 text-gray-600 border-gray-300" };
}

export function HoursReport() {
  const [weekStart, setWeekStart] = useState(currentMonday);
  const [rows, setRows] = useState<HoursSummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchHoursSummary(weekStart)
      .then(setRows)
      .catch(() => setError("Failed to load hours summary"))
      .finally(() => setLoading(false));
  }, [weekStart]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Hours Report</h1>
        <input
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-right">Hours</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                    No data for this week
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const chip = statusChip(r);
                return (
                  <tr key={r.employeeId} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">{r.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">{r.weeklyHours}h</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-block border rounded px-2 py-0.5 text-xs font-medium ${chip.cls}`}>
                        {chip.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
