/**
 * Constraint Engine — Phase 2
 *
 * Pure, stateless functions.  No database calls, no side effects.
 * Every configurable threshold is read from the ScheduleConfig argument;
 * no magic numbers are hardcoded here.
 *
 * Priority order used by canWorkShift:
 *   1  Approved time off            (BLOCKING)
 *   2  Management coverage          (BLOCKING)
 *   3  Peak-shift MANAGER presence  (BLOCKING)
 *   4  Overtime / max weekly hours  (warning)
 *   5  Max consecutive days         (warning)
 *   6  Specialty match              (warning)
 *   7  Minimum rest between shifts  (warning)
 *   8  Part-time hour cap           (warning)
 */

import type {
  Employee,
  Shift,
  Assignment,
  TimeOffRequest,
  ScheduleConfig,
  ValidationResult,
  CanWorkShiftContext,
  WeekSchedule,
} from "./types.js";
import {
  ManagementTier,
  EmploymentType,
  TimeOffStatus,
  AssignmentStatus,
} from "./types.js";

// ─── Internal Date Helpers ──────────────────────────────────────────────────

/** Returns a new Date set to midnight (local) for comparison purposes. */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns a new Date with `days` added (or subtracted if negative). */
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ─── Availability & Hours ───────────────────────────────────────────────────

/**
 * Returns true when the employee has no APPROVED time-off covering `date`.
 */
export function isAvailable(
  employee: Employee,
  date: Date,
  approvedTimeOff: TimeOffRequest[]
): boolean {
  const d = startOfDay(date).getTime();
  return !approvedTimeOff.some(
    (req) =>
      req.employee_id === employee.id &&
      req.status === TimeOffStatus.APPROVED &&
      startOfDay(req.start_date).getTime() <= d &&
      d <= startOfDay(req.end_date).getTime()
  );
}

/**
 * Sums the assigned (non-cancelled) hours for an employee within the
 * 7-day window starting at `weekStart`.
 */
export function getWeeklyHours(
  employee: Employee,
  weekStart: Date,
  assignments: Assignment[]
): number {
  const ws = startOfDay(weekStart).getTime();
  const we = startOfDay(addDays(weekStart, 6)).getTime();

  return assignments
    .filter(
      (a) =>
        a.employee_id === employee.id &&
        a.status !== AssignmentStatus.CANCELLED &&
        startOfDay(a.shift_date).getTime() >= ws &&
        startOfDay(a.shift_date).getTime() <= we
    )
    .reduce((sum, a) => sum + a.assigned_hours, 0);
}

/**
 * Counts consecutive working days immediately before `date` (not including
 * `date` itself).  Used together with +1 to predict the streak after
 * potentially adding a shift on `date`.
 */
export function getConsecutiveDays(
  employee: Employee,
  date: Date,
  assignments: Assignment[]
): number {
  const workedDays = new Set(
    assignments
      .filter(
        (a) =>
          a.employee_id === employee.id &&
          a.status !== AssignmentStatus.CANCELLED
      )
      .map((a) => startOfDay(a.shift_date).getTime())
  );

  let count = 0;
  let check = addDays(startOfDay(date), -1);
  while (workedDays.has(check.getTime())) {
    count++;
    check = addDays(check, -1);
  }
  return count;
}

/**
 * Returns true when adding `shift.duration_hours` to the employee's
 * existing weekly hours would exceed `config.overtime_threshold`.
 */
export function wouldCauseOvertime(
  employee: Employee,
  shift: Shift,
  weekStart: Date,
  assignments: Assignment[],
  config: ScheduleConfig
): boolean {
  const current = getWeeklyHours(employee, weekStart, assignments);
  return current + shift.duration_hours > config.overtime_threshold;
}

/**
 * Returns true when working on `date` would push the employee's
 * consecutive-day streak past `config.max_consecutive_days`.
 */
export function wouldExceedConsecutiveDays(
  employee: Employee,
  date: Date,
  assignments: Assignment[],
  config: ScheduleConfig
): boolean {
  const streak = getConsecutiveDays(employee, date, assignments);
  return streak + 1 > config.max_consecutive_days;
}

// ─── Specialty ──────────────────────────────────────────────────────────────

/**
 * Returns true when no specialty is required, or when the employee
 * holds the required specialty.
 */
export function hasSpecialty(
  employee: Employee,
  requiredSpecialty: string | null
): boolean {
  if (requiredSpecialty === null) return true;
  return employee.specialties.includes(requiredSpecialty);
}

// ─── Management Coverage ────────────────────────────────────────────────────

/**
 * Returns true when at least one non-cancelled assigned employee is
 * MANAGER or ASSISTANT_MANAGER.
 */
export function shiftHasManagementCoverage(
  shift: Shift,
  assignments: Assignment[],
  employees: Employee[]
): boolean {
  return assignments
    .filter(
      (a) =>
        a.shift_id === shift.id && a.status !== AssignmentStatus.CANCELLED
    )
    .some((a) => {
      const emp = employees.find((e) => e.id === a.employee_id);
      return (
        emp?.management_tier === ManagementTier.MANAGER ||
        emp?.management_tier === ManagementTier.ASSISTANT_MANAGER
      );
    });
}

/**
 * Returns true when at least one non-cancelled assigned employee is
 * specifically MANAGER tier (required for peak shifts).
 */
export function peakShiftHasManager(
  shift: Shift,
  assignments: Assignment[],
  employees: Employee[]
): boolean {
  return assignments
    .filter(
      (a) =>
        a.shift_id === shift.id && a.status !== AssignmentStatus.CANCELLED
    )
    .some((a) => {
      const emp = employees.find((e) => e.id === a.employee_id);
      return emp?.management_tier === ManagementTier.MANAGER;
    });
}

/**
 * BLOCKING check.  Simulates approving `timeOffRequest` for `employee`
 * and verifies that every shift in `weekSchedule` that requires management
 * presence still has sufficient coverage without that employee.
 *
 * Only evaluates shifts to which the employee is currently assigned, since
 * their absence only impacts those shifts directly.
 */
export function managementTimeOffIsSafe(
  employee: Employee,
  timeOffRequest: TimeOffRequest,
  weekSchedule: WeekSchedule,
  employees: Employee[]
): ValidationResult {
  // STAFF time off never affects management coverage.
  if (employee.management_tier === ManagementTier.STAFF) {
    return { valid: true, blocking: false, reasons: [] };
  }

  const reasons: string[] = [];

  for (const shift of weekSchedule.shifts) {
    if (!shift.requires_management_presence) continue;

    const shiftDay = startOfDay(shift.date).getTime();
    const toStart = startOfDay(timeOffRequest.start_date).getTime();
    const toEnd = startOfDay(timeOffRequest.end_date).getTime();

    if (shiftDay < toStart || shiftDay > toEnd) continue;

    const active = weekSchedule.assignments.filter(
      (a) =>
        a.shift_id === shift.id && a.status !== AssignmentStatus.CANCELLED
    );

    // Only check shifts the employee is actually assigned to.
    const isAssigned = active.some((a) => a.employee_id === employee.id);
    if (!isAssigned) continue;

    const remaining = active.filter((a) => a.employee_id !== employee.id);
    const dateStr = shift.date.toISOString().split("T")[0];

    const hasCoverage = remaining.some((a) => {
      const emp = employees.find((e) => e.id === a.employee_id);
      return (
        emp?.management_tier === ManagementTier.MANAGER ||
        emp?.management_tier === ManagementTier.ASSISTANT_MANAGER
      );
    });

    if (!hasCoverage) {
      reasons.push(
        `Approving time off would leave shift ${shift.id} on ${dateStr} without management coverage`
      );
      // General coverage is already violated; no need to check peak separately.
      continue;
    }

    // Even if general coverage holds, a peak shift additionally needs a MANAGER.
    if (shift.is_peak_shift) {
      const hasManager = remaining.some((a) => {
        const emp = employees.find((e) => e.id === a.employee_id);
        return emp?.management_tier === ManagementTier.MANAGER;
      });
      if (!hasManager) {
        reasons.push(
          `Approving time off would leave peak shift ${shift.id} on ${dateStr} without MANAGER coverage`
        );
      }
    }
  }

  return reasons.length > 0
    ? { valid: false, blocking: true, reasons }
    : { valid: true, blocking: false, reasons: [] };
}

// ─── Master Constraint Check ────────────────────────────────────────────────

/**
 * Evaluates ALL constraints in priority order and returns a consolidated
 * ValidationResult.  Every violated rule is collected; the check never
 * short-circuits after the first failure.
 *
 * `blocking` is true when at least one priority-1/2/3 rule was violated.
 */
export function canWorkShift(
  employee: Employee,
  shift: Shift,
  context: CanWorkShiftContext
): ValidationResult {
  const reasons: string[] = [];
  let hasBlockingViolation = false;

  const dateStr = shift.date.toISOString().split("T")[0];

  // ── Priority 1: Approved time off (BLOCKING) ────────────────────────────
  if (!isAvailable(employee, shift.date, context.approvedTimeOff)) {
    reasons.push(`Employee is on approved time off on ${dateStr}`);
    hasBlockingViolation = true;
  }

  // ── Priority 2: Management coverage (BLOCKING) ──────────────────────────
  if (shift.requires_management_presence) {
    const isManagement =
      employee.management_tier === ManagementTier.MANAGER ||
      employee.management_tier === ManagementTier.ASSISTANT_MANAGER;

    const othersOnShift = context.assignments.filter(
      (a) =>
        a.shift_id === shift.id &&
        a.employee_id !== employee.id &&
        a.status !== AssignmentStatus.CANCELLED
    );

    const othersHaveCoverage = othersOnShift.some((a) => {
      const emp = context.employees.find((e) => e.id === a.employee_id);
      return (
        emp?.management_tier === ManagementTier.MANAGER ||
        emp?.management_tier === ManagementTier.ASSISTANT_MANAGER
      );
    });

    if (!isManagement && !othersHaveCoverage) {
      reasons.push(
        `Shift requires management presence; employee is STAFF and no other manager is assigned`
      );
      hasBlockingViolation = true;
    }
  }

  // ── Priority 3: Peak-shift MANAGER requirement (BLOCKING) ───────────────
  if (shift.is_peak_shift) {
    const isManager = employee.management_tier === ManagementTier.MANAGER;

    const othersOnShift = context.assignments.filter(
      (a) =>
        a.shift_id === shift.id &&
        a.employee_id !== employee.id &&
        a.status !== AssignmentStatus.CANCELLED
    );

    const othersHaveManager = othersOnShift.some((a) => {
      const emp = context.employees.find((e) => e.id === a.employee_id);
      return emp?.management_tier === ManagementTier.MANAGER;
    });

    if (!isManager && !othersHaveManager) {
      reasons.push(
        `Peak shift requires a MANAGER; employee is ${employee.management_tier} and no other manager is assigned`
      );
      hasBlockingViolation = true;
    }
  }

  // ── Priority 4: Max weekly hours / overtime (warning) ───────────────────
  if (
    wouldCauseOvertime(
      employee,
      shift,
      context.weekStart,
      context.assignments,
      context.config
    )
  ) {
    reasons.push(
      `Adding this shift would cause employee to exceed overtime threshold of ${context.config.overtime_threshold}h`
    );
  }

  // ── Priority 5: Max consecutive days (warning) ──────────────────────────
  if (
    wouldExceedConsecutiveDays(
      employee,
      shift.date,
      context.assignments,
      context.config
    )
  ) {
    reasons.push(
      `Adding this shift would exceed max consecutive days of ${context.config.max_consecutive_days}`
    );
  }

  // ── Priority 6: Specialty matching (warning) ────────────────────────────
  if (!hasSpecialty(employee, shift.required_specialty)) {
    reasons.push(
      `Employee lacks required specialty: ${shift.required_specialty}`
    );
  }

  // ── Priority 7: Minimum rest between shifts (warning) ───────────────────
  const minRestMs = context.config.min_rest_hours_between_shifts * 60 * 60 * 1000;
  const newStart = shift.start_time.getTime();
  const newEnd = shift.end_time.getTime();

  const empAssignments = context.assignments.filter(
    (a) =>
      a.employee_id === employee.id && a.status !== AssignmentStatus.CANCELLED
  );

  for (const a of empAssignments) {
    const aStart = a.shift_start_time.getTime();
    const aEnd = a.shift_end_time.getTime();

    // Existing shift ends before new shift starts.
    if (aEnd <= newStart) {
      const gap = newStart - aEnd;
      if (gap < minRestMs) {
        const gapHours = (gap / (60 * 60 * 1000)).toFixed(1);
        reasons.push(
          `Insufficient rest: only ${gapHours}h gap before this shift (minimum ${context.config.min_rest_hours_between_shifts}h required)`
        );
      }
    }

    // New shift ends before existing shift starts.
    if (newEnd <= aStart) {
      const gap = aStart - newEnd;
      if (gap < minRestMs) {
        const gapHours = (gap / (60 * 60 * 1000)).toFixed(1);
        reasons.push(
          `Insufficient rest: only ${gapHours}h gap after this shift (minimum ${context.config.min_rest_hours_between_shifts}h required)`
        );
      }
    }
  }

  // ── Priority 8: Part-time contracted hour cap (warning) ─────────────────
  if (employee.employment_type === EmploymentType.PART_TIME) {
    const current = getWeeklyHours(
      employee,
      context.weekStart,
      context.assignments
    );
    if (current + shift.duration_hours > employee.weekly_hours_target) {
      reasons.push(
        `Part-time employee would exceed contracted weekly hours of ${employee.weekly_hours_target}h`
      );
    }
  }

  const valid = reasons.length === 0;
  return {
    valid,
    blocking: !valid && hasBlockingViolation,
    reasons,
  };
}
