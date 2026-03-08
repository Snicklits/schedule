/**
 * Payroll View — Salary Tracking (manager)
 *
 * Week selector + table with colour flags.
 * Red if absent > 8h, amber if scheduled differs from target by > 4h.
 * CSV export + total row.
 */

import { useState, useEffect } from "react";
import { fetchTeamSalary } from "../api/endpoints.js";
import type { PaySummary, TeamSalaryResult } from "../api/types.js";

function toMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function currentMonday(): string {
  return toMonday(new Date().toISOString().slice(0, 10));
}

function currency(amount: number, code: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: code }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

function rowFlag(row: PaySummary): "red" | "amber" | null {
  if (row.absent_hours > 8) return "red";
  if (Math.abs(row.scheduled_hours - row.weekly_hours_target) > 4) return "amber";
  return null;
}

function downloadCSV(data: TeamSalaryResult, weekStart: string) {
  const headers = ["Name", "Scheduled (h)", "Absent (h)", "Worked (h)", "Rate", "Gross Pay", "Currency"];
  const rows = data.employees.map((e) => [
    e.employee_name,
    e.scheduled_hours.toFixed(1),
    e.absent_hours.toFixed(1),
    e.worked_hours.toFixed(1),
    e.hourly_rate.toFixed(2),
    e.gross_pay.toFixed(2),
    e.currency,
  ]);
  rows.push(["TOTAL", "", "", "", "", data.team_total_gross.toFixed(2), data.employees[0]?.currency ?? "GBP"]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payroll-${weekStart}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function PayrollView() {
  const [weekStart, setWeekStart] = useState(currentMonday);
  const [result, setResult] = useState<TeamSalaryResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchTeamSalary(weekStart)
      .then(setResult)
      .catch(() => setResult(null))
      .finally(() => setLoading(false));
  }, [weekStart]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Payroll</h2>
          <p className="text-xs text-slate-400 mt-0.5">Weekly gross pay summary</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(toMonday(e.target.value))}
            className="h-9 px-3 rounded-xl border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {result && (
            <button
              onClick={() => downloadCSV(result, weekStart)}
              className="h-9 px-4 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-700 text-xs font-semibold transition-all"
            >
              Export CSV
            </button>
          )}
        </div>
      </div>

      {loading && (
        <p className="text-sm text-slate-400 text-center py-8">Loading payroll data…</p>
      )}

      {!loading && result && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Employee</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Scheduled</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Absent</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Worked</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Rate</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Gross Pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {result.employees.map((emp) => {
                const flag = rowFlag(emp);
                return (
                  <tr
                    key={emp.employee_id}
                    className={`hover:bg-slate-50 transition-colors ${
                      flag === "red" ? "bg-red-50/60" : flag === "amber" ? "bg-amber-50/60" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {flag && (
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${flag === "red" ? "bg-red-500" : "bg-amber-400"}`} />
                        )}
                        <span className="font-medium text-slate-800">{emp.employee_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-600 tabular-nums">{emp.scheduled_hours.toFixed(1)}h</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${emp.absent_hours > 0 ? "text-red-600" : "text-slate-400"}`}>
                      {emp.absent_hours.toFixed(1)}h
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-700 tabular-nums font-semibold">{emp.worked_hours.toFixed(1)}h</td>
                    <td className="px-4 py-2.5 text-right text-slate-500 tabular-nums">
                      {emp.hourly_rate > 0 ? currency(emp.hourly_rate, emp.currency) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-800 tabular-nums">
                      {emp.hourly_rate > 0 ? currency(emp.gross_pay, emp.currency) : "—"}
                    </td>
                  </tr>
                );
              })}
              {/* Total row */}
              <tr className="bg-slate-100 font-bold">
                <td className="px-4 py-3 text-slate-800">Total</td>
                <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                  {result.employees.reduce((s, e) => s + e.scheduled_hours, 0).toFixed(1)}h
                </td>
                <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                  {result.employees.reduce((s, e) => s + e.absent_hours, 0).toFixed(1)}h
                </td>
                <td className="px-4 py-3 text-right text-slate-700 tabular-nums">
                  {result.employees.reduce((s, e) => s + e.worked_hours, 0).toFixed(1)}h
                </td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right text-slate-800 tabular-nums">
                  {currency(result.team_total_gross, result.employees[0]?.currency ?? "GBP")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {!loading && !result && (
        <p className="text-sm text-slate-400 text-center py-8">No payroll data available</p>
      )}

      <div className="flex gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Absent &gt; 8h</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Scheduled differs from target by &gt; 4h</span>
      </div>
    </div>
  );
}
