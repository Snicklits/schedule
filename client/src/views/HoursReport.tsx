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
  barCls: string;
  nameCls: string;
}

function rowMeta(row: HoursSummaryRow): RowMeta {
  const h = row.weeklyHours;
  if (row.isAtCap) {
    return {
      label: "At Cap",
      chipCls: "bg-red-100 text-red-700",
      barCls: "bg-red-400",
      nameCls: "text-red-700 font-semibold",
    };
  }
  if (h >= 35) {
    return {
      label: "Near Cap",
      chipCls: "bg-amber-100 text-amber-700",
      barCls: "bg-amber-400",
      nameCls: "text-amber-800 font-medium",
    };
  }
  if (h >= 20) {
    return {
      label: "Partial",
      chipCls: "bg-indigo-50 text-indigo-600",
      barCls: "bg-indigo-400",
      nameCls: "text-slate-800",
    };
  }
  return {
    label: "Low",
    chipCls: "bg-slate-100 text-slate-500",
    barCls: "bg-slate-300",
    nameCls: "text-slate-600",
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Hours Report</h2>
          <p className="text-xs text-slate-400 mt-0.5">Weekly hours vs. target for all employees</p>
        </div>
        <input
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
          className="h-8 px-3 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
        />
      </div>

      {/* Summary pills */}
      {rows.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {atCap > 0 && (
            <span className="h-7 px-3 flex items-center rounded-full bg-red-100 text-red-700 text-xs font-semibold">
              {atCap} at cap (40h)
            </span>
          )}
          {nearCap > 0 && (
            <span className="h-7 px-3 flex items-center rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
              {nearCap} near cap (35–39h)
            </span>
          )}
          <span className="h-7 px-3 flex items-center rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
            {rows.length} employees
          </span>
        </div>
      )}

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-sm text-slate-400">Loading…</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Employee</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">Hours</th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500 w-40">Progress</th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-400">
                    No data for this week
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const meta = rowMeta(r);
                const pct = Math.min(100, Math.round((r.weeklyHours / 40) * 100));

                return (
                  <tr key={r.employeeId} className="hover:bg-slate-50/60 transition-colors">
                    <td className={`px-4 py-3 ${meta.nameCls}`}>{r.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 font-semibold">
                      {r.weeklyHours}h
                    </td>
                    <td className="px-4 py-3 w-40">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all ${meta.barCls}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 w-8 text-right tabular-nums">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.chipCls}`}>
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
