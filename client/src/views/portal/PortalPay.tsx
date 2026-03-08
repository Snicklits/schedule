/**
 * Portal Pay — Employee self-service pay summary
 *
 * Shows:
 *  - This week's pay summary
 *  - This month's estimated pay
 *  - 4-week bar chart (recharts)
 *  - "Estimated only" disclaimer
 */

import { useState, useEffect } from "react";
import { fetchMySalary } from "../../api/endpoints.js";
import type { PaySummary } from "../../api/types.js";
import { useAuth } from "../../contexts/AuthContext.js";

function toMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function currentMonday(): string {
  return toMonday(new Date().toISOString().slice(0, 10));
}

function addWeeks(mondayStr: string, weeks: number): string {
  const d = new Date(mondayStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

function currency(amount: number, code: string) {
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: code }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

// Simple SVG bar chart (no recharts dependency)
function PayBarChart({ weeks }: { weeks: Array<{ label: string; gross: number; currency: string }> }) {
  const max = Math.max(...weeks.map((w) => w.gross), 1);
  const barWidth = 40;
  const gap = 16;
  const chartH = 80;
  const totalW = weeks.length * (barWidth + gap);

  return (
    <div className="overflow-x-auto">
      <svg width={totalW} height={chartH + 28} className="overflow-visible">
        {weeks.map((w, i) => {
          const barH = (w.gross / max) * chartH;
          const x = i * (barWidth + gap);
          const y = chartH - barH;
          return (
            <g key={w.label}>
              <rect x={x} y={y} width={barWidth} height={barH} rx={6} fill="#6366f1" opacity={0.8} />
              <text x={x + barWidth / 2} y={chartH + 14} textAnchor="middle" fontSize={10} fill="#94a3b8">
                {w.label}
              </text>
              {w.gross > 0 && (
                <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="#6366f1" fontWeight="bold">
                  {w.currency}{w.gross.toFixed(0)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function PortalPay() {
  const { employeeId } = useAuth();
  const [thisWeek, setThisWeek] = useState<PaySummary | null>(null);
  const [pastWeeks, setPastWeeks] = useState<Array<PaySummary | null>>([]);
  const [loading, setLoading] = useState(true);

  const monday = currentMonday();

  useEffect(() => {
    if (!employeeId) return;

    setLoading(true);
    const weekStarts = [0, -1, -2, -3].map((offset) => addWeeks(monday, offset));

    Promise.allSettled(
      weekStarts.map((ws) => fetchMySalary(employeeId, ws))
    ).then((results) => {
      const data = results.map((r) => (r.status === "fulfilled" ? r.value : null));
      setThisWeek(data[0]);
      setPastWeeks(data);
    }).finally(() => setLoading(false));
  }, [employeeId, monday]);

  if (!employeeId) {
    return <p className="text-sm text-slate-400 text-center py-8">Not authenticated</p>;
  }

  if (loading) {
    return <p className="text-sm text-slate-400 text-center py-8">Loading pay data…</p>;
  }

  const curr = thisWeek?.currency ?? "GBP";
  const monthTotal = pastWeeks.reduce((s, w) => s + (w?.gross_pay ?? 0), 0);

  const chartWeeks = pastWeeks.map((w, i) => ({
    label: i === 0 ? "This wk" : `${Math.abs(i)}wk ago`,
    gross: w?.gross_pay ?? 0,
    currency: curr.slice(0, 1),
  })).reverse();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">My Pay</h2>
        <p className="text-xs text-slate-400 mt-0.5">Estimated pay based on scheduled hours</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">This Week</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">
            {thisWeek && thisWeek.hourly_rate > 0 ? currency(thisWeek.gross_pay, curr) : "—"}
          </p>
          {thisWeek && (
            <p className="text-xs text-slate-400 mt-1">
              {thisWeek.worked_hours.toFixed(1)}h worked · {thisWeek.absent_hours.toFixed(1)}h absent
            </p>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Last 4 Weeks</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">
            {monthTotal > 0 ? currency(monthTotal, curr) : "—"}
          </p>
          <p className="text-xs text-slate-400 mt-1">Combined estimated earnings</p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-4">4-Week Trend</p>
        {chartWeeks.every((w) => w.gross === 0) ? (
          <p className="text-xs text-slate-400 text-center py-4">No pay data available</p>
        ) : (
          <PayBarChart weeks={chartWeeks} />
        )}
      </div>

      {/* Breakdown */}
      {thisWeek && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">This Week Breakdown</p>
          <div className="space-y-2">
            {[
              { label: "Scheduled hours", value: `${thisWeek.scheduled_hours.toFixed(1)}h` },
              { label: "Absent hours", value: `${thisWeek.absent_hours.toFixed(1)}h`, highlight: thisWeek.absent_hours > 0 },
              { label: "Worked hours", value: `${thisWeek.worked_hours.toFixed(1)}h` },
              { label: "Hourly rate", value: thisWeek.hourly_rate > 0 ? currency(thisWeek.hourly_rate, curr) : "—" },
              { label: "Estimated gross", value: thisWeek.hourly_rate > 0 ? currency(thisWeek.gross_pay, curr) : "—", bold: true },
            ].map(({ label, value, highlight, bold }) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-slate-500">{label}</span>
                <span className={`${bold ? "font-bold text-slate-900" : "text-slate-700"} ${highlight ? "text-red-500" : ""}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-400 text-center italic">
        Estimated only — actual pay may vary. Contact your manager for payslip queries.
      </p>
    </div>
  );
}
