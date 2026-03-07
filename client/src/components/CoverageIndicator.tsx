/**
 * CoverageIndicator — shows management coverage status as a colored pill.
 *
 * Variants:
 *   manager  → green pill  (Manager assigned)
 *   am       → blue pill   (AM assigned, non-peak)
 *   peak-am  → amber pill  (Peak shift, AM only — warning)
 *   none     → red outlined pill (No coverage — blocking)
 */

type CoverageVariant = "manager" | "am" | "peak-am" | "none";

interface CoverageIndicatorProps {
  variant: CoverageVariant;
  className?: string;
}

const CONFIG: Record<CoverageVariant, { label: string; cls: string }> = {
  manager: { label: "🟢 MGR",      cls: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
  am:      { label: "🔵 AM",       cls: "bg-blue-100 text-blue-700 border border-blue-200" },
  "peak-am": { label: "🟡 Peak/AM", cls: "bg-amber-100 text-amber-700 border border-amber-200" },
  none:    { label: "🔴 No Mgmt",  cls: "bg-red-50 text-red-700 border border-red-300" },
};

export function CoverageIndicator({ variant, className = "" }: CoverageIndicatorProps) {
  const { label, cls } = CONFIG[variant];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls} ${className}`}>
      {label}
    </span>
  );
}

/** Derive CoverageVariant from assignment list tiers */
export function deriveCoverage(
  tiers: string[],
  requiresMgmt: boolean,
  isPeak: boolean
): CoverageVariant | null {
  if (!requiresMgmt) return null;
  if (tiers.includes("MANAGER")) return "manager";
  if (tiers.includes("ASSISTANT_MANAGER")) return isPeak ? "peak-am" : "am";
  return "none";
}
