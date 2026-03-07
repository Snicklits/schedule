/**
 * StatusBadge — reusable rounded-pill status indicator.
 * Covers assignment statuses, time-off statuses, and swap statuses.
 */

type StatusVariant =
  | "SCHEDULED"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "PENDING"
  | "APPROVED"
  | "DENIED"
  | "SWAPPED"
  | "SWAP_REQUESTED";

const VARIANT_MAP: Record<StatusVariant, { bg: string; text: string; label: string }> = {
  SCHEDULED:      { bg: "bg-indigo-100",  text: "text-indigo-700",  label: "Scheduled" },
  CONFIRMED:      { bg: "bg-emerald-100", text: "text-emerald-700", label: "Confirmed" },
  COMPLETED:      { bg: "bg-emerald-100", text: "text-emerald-700", label: "Completed" },
  CANCELLED:      { bg: "bg-slate-100",   text: "text-slate-500",   label: "Cancelled" },
  PENDING:        { bg: "bg-amber-100",   text: "text-amber-700",   label: "Pending" },
  APPROVED:       { bg: "bg-emerald-100", text: "text-emerald-700", label: "Approved" },
  DENIED:         { bg: "bg-red-100",     text: "text-red-700",     label: "Denied" },
  SWAPPED:        { bg: "bg-purple-100",  text: "text-purple-700",  label: "Swapped" },
  SWAP_REQUESTED: { bg: "bg-purple-100",  text: "text-purple-700",  label: "Swap Requested" },
};

interface StatusBadgeProps {
  status: StatusVariant | string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const variant = VARIANT_MAP[status as StatusVariant] ?? {
    bg: "bg-slate-100",
    text: "text-slate-500",
    label: status,
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variant.bg} ${variant.text} ${className}`}
    >
      {variant.label}
    </span>
  );
}
