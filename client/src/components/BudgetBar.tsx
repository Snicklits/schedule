/**
 * BudgetBar — visual labour-budget progress indicator
 *
 * Colors:
 *   green  — scheduled < 95 % of budget
 *   amber  — 95 %–105 %
 *   red    — > 105 % (over budget)
 */

import type { BudgetSummary } from "../api/types.js";

interface Props {
  budget: BudgetSummary;
  compact?: boolean;
}

export function BudgetBar({ budget, compact = false }: Props) {
  const { budget_hours, scheduled_hours, variance, status } = budget;

  if (budget_hours === null) {
    return (
      <div className="text-xs text-slate-400 italic">No budget set for this week</div>
    );
  }

  const pct = Math.min((scheduled_hours / budget_hours) * 100, 120);

  const barColor =
    status === "OVER"
      ? "bg-red-500"
      : status === "ON_TRACK"
        ? "bg-amber-400"
        : "bg-emerald-500";

  const textColor =
    status === "OVER"
      ? "text-red-600"
      : status === "ON_TRACK"
        ? "text-amber-600"
        : "text-emerald-600";

  const label =
    status === "OVER"
      ? "Over budget"
      : status === "ON_TRACK"
        ? "On track"
        : "Under budget";

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-semibold text-slate-600">Labour Budget</span>
          <span className={`font-bold ${textColor}`}>{label}</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>{scheduled_hours.toFixed(1)}h scheduled</span>
          <span>{budget_hours}h budget</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Labour Budget</span>
        <span className={`text-sm font-bold ${textColor}`}>{label}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>
          <span className="font-semibold text-slate-800">{scheduled_hours.toFixed(1)}h</span> scheduled
        </span>
        <span>
          Budget: <span className="font-semibold text-slate-800">{budget_hours}h</span>
        </span>
      </div>
      {variance !== null && (
        <p className={`text-xs font-medium ${textColor}`}>
          {variance > 0 ? `+${variance.toFixed(1)}h over budget` : `${Math.abs(variance).toFixed(1)}h remaining`}
        </p>
      )}
    </div>
  );
}
