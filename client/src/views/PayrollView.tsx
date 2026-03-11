import { useState, useEffect, useCallback } from "react";
import { fetchTeamPaySummary } from "../api/endpoints.js";
import type { TeamPaySummary } from "../api/types.js";
import { useCompany } from "../contexts/CompanyContext.js";

function toMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
  return d.toISOString().slice(0, 10);
}

const CURRENCY_SYMBOLS: Record<string, string> = { GBP: "£", USD: "$", EUR: "€", AUD: "A$" };

export function PayrollView() {
  const { config } = useCompany();
  const currencySymbol = CURRENCY_SYMBOLS[config?.currency ?? "GBP"] ?? "£";
  const [weekStart, setWeekStart] = useState(() => toMonday(new Date().toISOString().slice(0, 10)));
  const [data, setData] = useState<TeamPaySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (week: string) => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchTeamPaySummary(week));
    } catch {
      setError("Failed to load payroll data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(weekStart); }, [weekStart, load]);

  function exportCSV() {
    if (!data) return;
    const rows = [
      ["Name", "Role", "Scheduled Hrs", "Absent Hrs", "Worked Hrs", `Rate (${config?.currency ?? "GBP"})`, "Gross Pay"],
      ...data.summaries.map((r) => [
        r.employee.name,
        r.employee.role,
        r.scheduled_hours.toFixed(2),
        r.absent_hours.toFixed(2),
        r.worked_hours.toFixed(2),
        r.hourly_rate.toFixed(2),
        r.gross_pay.toFixed(2),
      ]),
      ["TOTAL", "", "", "", "", "", data.team_total_gross.toFixed(2)],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${weekStart}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Payroll</h1>
        <button
          onClick={exportCSV}
          disabled={!data}
          className="bg-gray-100 hover:bg-gray-200 border text-gray-700 font-medium px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Week Starting</label>
        <input
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(toMonday(e.target.value))}
          className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {loading && <p className="text-sm text-gray-500">Loading payroll data…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["Employee", "Role", "Sched. Hrs", "Absent Hrs", "Worked Hrs", `Rate (${config?.currency ?? "GBP"})`, "Est. Gross Pay"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.summaries.map((row) => {
                const rowClass = row.absent_hours > 8
                  ? "bg-red-50"
                  : "";
                return (
                  <tr key={row.id} className={`${rowClass} hover:bg-gray-50`}>
                    <td className="px-4 py-3 font-medium text-gray-800">{row.employee.name}</td>
                    <td className="px-4 py-3 text-gray-500">{row.employee.role}</td>
                    <td className="px-4 py-3 text-gray-700">{row.scheduled_hours.toFixed(1)}</td>
                    <td className={`px-4 py-3 font-medium ${row.absent_hours > 0 ? "text-red-600" : "text-gray-700"}`}>
                      {row.absent_hours.toFixed(1)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.worked_hours.toFixed(1)}</td>
                    <td className="px-4 py-3 text-gray-500">{currencySymbol}{row.hourly_rate.toFixed(2)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{currencySymbol}{row.gross_pay.toFixed(2)}</td>
                  </tr>
                );
              })}
              {data.summaries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                    No payroll data. Set hourly rates on employee profiles to see estimates.
                  </td>
                </tr>
              )}
            </tbody>
            {data.summaries.length > 0 && (
              <tfoot className="bg-gray-50 border-t">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-right font-semibold text-gray-700">Total Estimated Gross:</td>
                  <td className="px-4 py-3 font-bold text-gray-900">{currencySymbol}{data.team_total_gross.toFixed(2)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      <p className="text-xs text-gray-400">Estimated only — subject to deductions. Only employees with hourly rates set are shown.</p>
    </div>
  );
}
