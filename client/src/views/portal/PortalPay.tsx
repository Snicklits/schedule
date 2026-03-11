import { useState, useEffect } from "react";
import { fetchEmployeePaySummary } from "../../api/endpoints.js";
import type { PaySummaryRow } from "../../api/types.js";
import { useAuth } from "../../contexts/AuthContext.js";
import { useCompany } from "../../contexts/CompanyContext.js";

function currentMonday(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function prevMonday(weekStart: string, n: number): string {
  const d = new Date(weekStart + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 7 * n);
  return d.toISOString().slice(0, 10);
}

function fmtCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

function fmtWeek(weekStart: string) {
  const d = new Date(weekStart + "T00:00:00Z");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface BarChartProps {
  weeks: { label: string; value: number }[];
  max: number;
  currency: string;
}

function BarChart({ weeks, max, currency }: BarChartProps) {
  return (
    <div className="flex items-end gap-2 h-28">
      {weeks.map((w) => {
        const pct = max > 0 ? (w.value / max) * 100 : 0;
        return (
          <div key={w.label} className="flex flex-col items-center flex-1 gap-1">
            <span className="text-xs text-gray-500 font-medium">
              {fmtCurrency(w.value, currency)}
            </span>
            <div className="w-full flex items-end" style={{ height: "64px" }}>
              <div
                className="w-full bg-indigo-500 rounded-t transition-all"
                style={{ height: `${pct}%`, minHeight: w.value > 0 ? "4px" : "0" }}
              />
            </div>
            <span className="text-xs text-gray-400">{w.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function PortalPay() {
  const { employeeId } = useAuth();
  const { config } = useCompany();
  const currency = config?.currency ?? "GBP";

  const [thisWeek] = useState(currentMonday);
  const [summaries, setSummaries] = useState<(PaySummaryRow | null)[]>([null, null, null, null]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeId) return;
    const weeks = [0, 1, 2, 3].map((n) => prevMonday(thisWeek, n));
    setLoading(true);
    Promise.all(
      weeks.map((w) =>
        fetchEmployeePaySummary(employeeId, w)
          .then((r) => r)
          .catch(() => null)
      )
    ).then((results) => {
      setSummaries(results);
      setLoading(false);
    });
  }, [employeeId, thisWeek]);

  const current = summaries[0];
  const weeks = [0, 1, 2, 3].map((n) => ({
    label: fmtWeek(prevMonday(thisWeek, n)),
    value: summaries[n]?.gross_pay ?? 0,
  }));
  const maxGross = Math.max(...weeks.map((w) => w.value), 1);

  const monthlyTotal = summaries.reduce((sum, s) => sum + (s?.gross_pay ?? 0), 0);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">My Pay</h1>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading pay data…</p>
      ) : (
        <>
          {/* Current week summary */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">This Week</h2>
            {current ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-gray-400">Scheduled</p>
                  <p className="text-lg font-bold text-gray-800">{current.scheduled_hours.toFixed(1)} hrs</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Absent</p>
                  <p className={`text-lg font-bold ${current.absent_hours > 8 ? "text-red-600" : "text-gray-800"}`}>
                    {current.absent_hours.toFixed(1)} hrs
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Worked</p>
                  <p className="text-lg font-bold text-gray-800">{current.worked_hours.toFixed(1)} hrs</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Est. Gross</p>
                  <p className="text-lg font-bold text-indigo-600">{fmtCurrency(current.gross_pay, currency)}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No pay data for this week yet.</p>
            )}
          </div>

          {/* Last 4 weeks bar chart */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Last 4 Weeks</h2>
            <BarChart weeks={[...weeks].reverse()} max={maxGross} currency={currency} />
          </div>

          {/* Monthly total */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-indigo-600 font-medium">4-Week Total</p>
              <p className="text-xs text-indigo-400">Sum of last 4 weeks estimated gross pay</p>
            </div>
            <p className="text-2xl font-bold text-indigo-700">{fmtCurrency(monthlyTotal, currency)}</p>
          </div>
        </>
      )}
    </div>
  );
}
