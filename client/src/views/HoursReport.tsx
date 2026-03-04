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

interface RowMeta {
  label: string;
  chipCls: string;
  rowCls: string;
  nameCls: string;
}

function rowMeta(row: HoursSummaryRow): RowMeta {
  const h = row.weeklyHours;
  if (row.isAtCap) {
    return {
      label: "At Cap",
      chipCls: "bg-red-100 text-red-700 border-red-300",
      rowCls: "bg-red-50",
      nameCls: "text-red-700 font-semibold",
    };
  }
  if (h >= 35) {
    return {
      label: "Near Cap",
      chipCls: "bg-yellow-100 text-yellow-700 border-yellow-300",
      rowCls: "bg-yellow-50",
      nameCls: "text-yellow-800 font-medium",
    };
  }
  if (h >= 20) {
    return {
      label: "Partial",
      chipCls: "bg-blue-50 text-blue-600 border-blue-200",
      rowCls: "",
      nameCls: "text-gray-800",
    };
  }
  return {
    label: "Low",
    chipCls: "bg-gray-100 text-gray-500 border-gray-300",
    rowCls: "",
    nameCls: "text-gray-600",
  };
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

  const atCap = rows.filter((r) => r.isAtCap).length;
  const nearCap = rows.filter((r) => !r.isAtCap && r.weeklyHours >= 35).length;

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

      {/* Summary pills */}
      {rows.length > 0 && (
        <div className="flex gap-3 text-xs">
          {atCap > 0 && (
            <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 border border-red-300 font-medium">
              {atCap} at cap (40h)
            </span>
          )}
          {nearCap > 0 && (
            <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-300 font-medium">
              {nearCap} near cap (35–39h)
            </span>
          )}
          <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-300">
            {rows.length} total employees
          </span>
        </div>
      )}

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
                <th className="px-4 py-3 text-right">Progress</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    No data for this week
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const meta = rowMeta(r);
                const pct = Math.min(100, Math.round((r.weeklyHours / 40) * 100));
                const barColor = r.isAtCap
                  ? "bg-red-500"
                  : r.weeklyHours >= 35
                    ? "bg-yellow-400"
                    : "bg-blue-400";

                return (
                  <tr key={r.employeeId} className={`hover:brightness-95 ${meta.rowCls}`}>
                    <td className={`px-4 py-2 ${meta.nameCls}`}>{r.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700 font-medium">
                      {r.weeklyHours}h
                    </td>
                    <td className="px-4 py-2 w-32">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-block border rounded px-2 py-0.5 text-xs font-medium ${meta.chipCls}`}>
                        {meta.label}
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
