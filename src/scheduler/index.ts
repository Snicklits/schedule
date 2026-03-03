/**
 * Scheduler — Phase 3: Core Scheduling Algorithm
 *
 * Generates a valid weekly schedule in six deterministic steps:
 *   1. Pre-processing   — flag peak shifts, resolve time-off conflicts
 *   2. Management pre-fill — peak shifts → MANAGER, other mgmt shifts → AM  (BLOCKING)
 *   3. Priority scoring — pure function for STAFF candidate ranking
 *   4. General assignment — fill remaining slots with scored STAFF candidates
 *   5. Gap detection    — scan for uncovered shifts and near-cap employees
 *   6. Validation pass  — full constraint-engine sweep across final schedule
 *
 * Rules:
 * - All constraint checks delegate to canWorkShift() — no inline re-implementation.
 * - All thresholds come from ScheduleConfig — no magic numbers.
 * - Same inputs always produce the same output (deterministic sort everywhere).
 * - No database calls, no side effects, no randomness.
 */

import {
  canWorkShift,
  shiftHasManagementCoverage,
  peakShiftHasManager,
  managementTimeOffIsSafe,
  getWeeklyHours,
} from "../constraintEngine/index.js";
import type {
  Employee,
  Shift,
  Assignment,
  TimeOffRequest,
  ScheduleConfig,
} from "../constraintEngine/types.js";
import {
  ManagementTier,
  AssignmentStatus,
  TimeOffStatus,
} from "../constraintEngine/types.js";
import type {
  ScheduleResult,
  RunLog,
  BlockingViolation,
  NonBlockingWarning,
  ScoringContext,
  TimeOffResolutionResult,
} from "./types.js";
import { ManagementCoverageError } from "./types.js";

// ─── Internal Helpers ────────────────────────────────────────────────────────

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function makeAssignment(employee: Employee, shift: Shift): Assignment {
  return {
    employee_id: employee.id,
    shift_id: shift.id,
    shift_date: shift.date,
    shift_start_time: shift.start_time,
    shift_end_time: shift.end_time,
    assigned_hours: shift.duration_hours,
    status: AssignmentStatus.SCHEDULED,
  };
}

/**
 * Sorts management employees for pre-fill: highest seniority first, lowest
 * hierarchy_rank (= highest in org) as tiebreaker, then id for determinism.
 */
function byManagementPriority(a: Employee, b: Employee): number {
  if (b.seniority_level !== a.seniority_level)
    return b.seniority_level - a.seniority_level;
  if (a.hierarchy_rank !== b.hierarchy_rank)
    return a.hierarchy_rank - b.hierarchy_rank;
  return a.id < b.id ? -1 : 1;
}

/** Sorts shifts: date ASC, then specialty-required before open within same date. */
function byDateThenSpecialty(a: Shift, b: Shift): number {
  const dt = a.date.getTime() - b.date.getTime();
  if (dt !== 0) return dt;
  if (a.required_specialty !== null && b.required_specialty === null) return -1;
  if (a.required_specialty === null && b.required_specialty !== null) return 1;
  return 0;
}

/**
 * Returns true when the shift's time window overlaps any configured peak window.
 * Peak windows use "HH:MM" strings interpreted as UTC hours.
 */
function isPeakByWindows(
  shift: Shift,
  windows: NonNullable<ScheduleConfig["peak_windows"]>
): boolean {
  const toUtcMins = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();
  const shiftStart = toUtcMins(shift.start_time);
  const shiftEnd = toUtcMins(shift.end_time);

  return windows.some((w) => {
    const [wSH, wSM] = w.start.split(":").map(Number);
    const [wEH, wEM] = w.end.split(":").map(Number);
    const wStart = wSH * 60 + (wSM ?? 0);
    const wEnd = wEH * 60 + (wEM ?? 0);
    return shiftStart < wEnd && shiftEnd > wStart;
  });
}

/**
 * Returns true when a shift is "undesirable": weekend (Sat/Sun) or
 * starting at or after 18:00 UTC.  Used in the fairness scoring dimension.
 */
function isUndesirableShift(shiftDate: Date, startTime: Date): boolean {
  const dow = shiftDate.getUTCDay(); // 0 = Sun, 6 = Sat
  return dow === 0 || dow === 6 || startTime.getUTCHours() >= 18;
}

function buildRunLog(
  weekStart: Date,
  config: ScheduleConfig,
  outcome: RunLog["outcome"],
  errors: BlockingViolation[],
  warnings: NonBlockingWarning[]
): RunLog {
  return {
    timestamp: new Date(),
    weekStart,
    configSnapshot: { ...config },
    outcome,
    errors: [...errors],
    warnings: [...warnings],
  };
}

function buildResult(
  weekStart: Date,
  config: ScheduleConfig,
  assignments: Assignment[],
  errors: BlockingViolation[],
  warnings: NonBlockingWarning[],
  outcome: RunLog["outcome"]
): ScheduleResult {
  return {
    schedule: assignments,
    errors,
    warnings,
    isPublishable: errors.length === 0,
    runLog: buildRunLog(weekStart, config, outcome, errors, warnings),
  };
}

// ─── Step 1 helper: conflict resolution ─────────────────────────────────────

/**
 * Processes PENDING time-off requests against already-APPROVED ones, applying:
 *   1. Management safety check (uses managementTimeOffIsSafe from Phase 2)
 *   2. max_team_off_percentage cap per day
 *   3. Priority ordering: seniority DESC, then created_at ASC (FCFS within tier)
 *
 * Returns the combined set of effectively-approved requests plus any warnings
 * about held/denied requests.
 */
export function resolveTimeOffConflicts(
  employees: Employee[],
  shifts: Shift[],
  timeOffRequests: TimeOffRequest[],
  config: ScheduleConfig
): TimeOffResolutionResult {
  const warnings: NonBlockingWarning[] = [];

  const alreadyApproved = timeOffRequests.filter(
    (r) => r.status === TimeOffStatus.APPROVED
  );
  const pending = timeOffRequests.filter(
    (r) => r.status === TimeOffStatus.PENDING
  );

  // Sort pending: highest seniority first, then FCFS within the same seniority tier
  const sortedPending = [...pending].sort((a, b) => {
    const empA = employees.find((e) => e.id === a.employee_id);
    const empB = employees.find((e) => e.id === b.employee_id);
    const senA = empA?.seniority_level ?? 0;
    const senB = empB?.seniority_level ?? 0;
    if (senB !== senA) return senB - senA;
    // FCFS tiebreaker within same seniority
    const tsA = a.created_at?.getTime() ?? 0;
    const tsB = b.created_at?.getTime() ?? 0;
    return tsA - tsB;
  });

  const approved: TimeOffRequest[] = [...alreadyApproved];

  for (const req of sortedPending) {
    const employee = employees.find((e) => e.id === req.employee_id);
    if (!employee) continue;

    // ── Management safety check ──────────────────────────────────────────
    if (employee.management_tier !== ManagementTier.STAFF) {
      const simulatedApproved: TimeOffRequest = {
        ...req,
        status: TimeOffStatus.APPROVED,
      };
      const weekSchedule = {
        shifts,
        assignments: [] as Assignment[],
      };
      const safetyResult = managementTimeOffIsSafe(
        employee,
        simulatedApproved,
        weekSchedule,
        employees
      );

      // managementTimeOffIsSafe checks assigned shifts; if no assignments yet we fall back
      // to a headcount check: are there other management employees available on each date?
      const affectedDates = datesInRange(req.start_date, req.end_date);
      const otherMgmtOnDates = affectedDates.some((d) => {
        const dayTs = startOfDay(d).getTime();
        return employees.some((e) => {
          if (e.id === employee.id) return false;
          if (e.management_tier === ManagementTier.STAFF) return false;
          // Other management employee who isn't already approved off on this date
          return !approved.some(
            (a) =>
              a.employee_id === e.id &&
              startOfDay(a.start_date).getTime() <= dayTs &&
              dayTs <= startOfDay(a.end_date).getTime()
          );
        });
      });

      // Check peak shifts specifically need a manager
      const peakOnDates = shifts.filter((s) => {
        const sd = startOfDay(s.date).getTime();
        return (
          s.is_peak_shift &&
          affectedDates.some((d) => startOfDay(d).getTime() === sd)
        );
      });
      const otherManagersAvailable =
        peakOnDates.length === 0 ||
        affectedDates.some((d) => {
          const dayTs = startOfDay(d).getTime();
          return employees.some(
            (e) =>
              e.id !== employee.id &&
              e.management_tier === ManagementTier.MANAGER &&
              !approved.some(
                (a) =>
                  a.employee_id === e.id &&
                  startOfDay(a.start_date).getTime() <= dayTs &&
                  dayTs <= startOfDay(a.end_date).getTime()
              )
          );
        });

      const needsPeakManager =
        peakOnDates.length > 0 &&
        employee.management_tier === ManagementTier.MANAGER &&
        !otherManagersAvailable;

      if (!otherMgmtOnDates || !safetyResult.valid || needsPeakManager) {
        warnings.push({
          type: "TimeOffHeld",
          employeeId: employee.id,
          message: `Time-off request ${req.id} for ${employee.name} held for manual review: approving would leave shifts without management coverage`,
        });
        continue; // Do not approve
      }
    }

    // ── max_team_off_percentage cap (checked per calendar day) ──────────────
    const days = datesInRange(req.start_date, req.end_date);
    let blocked = false;

    for (const day of days) {
      const dayTs = startOfDay(day).getTime();
      const offCount = approved.filter((a) => {
        const s = startOfDay(a.start_date).getTime();
        const e2 = startOfDay(a.end_date).getTime();
        return s <= dayTs && dayTs <= e2;
      }).length;

      if ((offCount + 1) / employees.length > config.max_team_off_percentage) {
        warnings.push({
          type: "TimeOffHeld",
          employeeId: employee.id,
          message: `Time-off request ${req.id} for ${employee.name} denied on ${day.toISOString().split("T")[0]}: team-off limit (${config.max_team_off_percentage * 100}%) would be exceeded`,
        });
        blocked = true;
        break;
      }
    }

    if (!blocked) {
      approved.push({ ...req, status: TimeOffStatus.APPROVED });
    }
  }

  return { approvedRequests: approved, warnings };
}

/** Returns every calendar day (UTC midnight) in [start, end] inclusive. */
function datesInRange(start: Date, end: Date): Date[] {
  const result: Date[] = [];
  let cur = startOfDay(start);
  const endTs = startOfDay(end).getTime();
  while (cur.getTime() <= endTs) {
    result.push(cur);
    cur = addDays(cur, 1);
  }
  return result;
}

// ─── Step 3: Priority Scoring ────────────────────────────────────────────────

/**
 * Pure scoring function for STAFF candidates on a given shift.
 * Higher score = should be assigned first.
 *
 * Components (all weights configurable via config.scoring_weights):
 *   seniority   — higher seniority_level wins
 *   hours_gap   — employees further below their weekly target are prioritised
 *   fairness    — employees with fewer prior undesirable (weekend/late) shifts win
 *   hierarchy   — lower hierarchy_rank (= higher in org) acts as final tiebreaker
 */
export function scoreCandidateForShift(
  employee: Employee,
  _shift: Shift,
  context: ScoringContext
): number {
  const w = {
    seniority: context.config.scoring_weights?.seniority ?? 10,
    hours_gap: context.config.scoring_weights?.hours_gap ?? 1,
    fairness: context.config.scoring_weights?.fairness ?? 5,
    hierarchy_rank: context.config.scoring_weights?.hierarchy_rank ?? 0.1,
  };

  const currentHours = getWeeklyHours(
    employee,
    context.weekStart,
    context.assignments
  );
  const hoursGap = Math.max(0, employee.weekly_hours_target - currentHours);

  const undesirableCount = context.assignments.filter(
    (a) =>
      a.employee_id === employee.id &&
      a.status !== AssignmentStatus.CANCELLED &&
      isUndesirableShift(a.shift_date, a.shift_start_time)
  ).length;

  return (
    w.seniority * employee.seniority_level +
    w.hours_gap * hoursGap +
    w.fairness * -undesirableCount +
    w.hierarchy_rank * -employee.hierarchy_rank
  );
}

// ─── Management Pre-fill (internal) ─────────────────────────────────────────

/**
 * Runs management pre-fill in two passes; throws ManagementCoverageError
 * (HALT signal) if a required shift cannot be covered.
 * Mutates `assignments` in-place.
 */
function runManagementPrefill(
  weekStart: Date,
  processedShifts: Shift[],
  employees: Employee[],
  approvedTimeOff: TimeOffRequest[],
  config: ScheduleConfig,
  assignments: Assignment[]
): void {
  const managers = employees.filter(
    (e) => e.management_tier === ManagementTier.MANAGER
  );
  const assistantManagers = employees.filter(
    (e) => e.management_tier === ManagementTier.ASSISTANT_MANAGER
  );

  const buildCtx = () => ({
    weekStart,
    assignments,
    employees,
    approvedTimeOff,
    config,
  });

  // ── Pass 1: Peak shifts → MANAGER ────────────────────────────────────────
  const peakShifts = processedShifts
    .filter((s) => s.is_peak_shift)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const shift of peakShifts) {
    // Skip if a manager is already assigned (shouldn't happen at start of run,
    // but guards against duplicate peaks in the input data).
    if (peakShiftHasManager(shift, assignments, employees)) continue;

    const candidates = managers
      .filter((e) => canWorkShift(e, shift, buildCtx()).valid)
      .sort(byManagementPriority);

    if (candidates.length === 0) {
      throw new ManagementCoverageError(
        shift,
        "No available Managers for peak shift"
      );
    }

    assignments.push(makeAssignment(candidates[0], shift));
  }

  // ── Pass 2: Management-required non-peak shifts → ASSISTANT_MANAGER ──────
  const mgmtShifts = processedShifts
    .filter((s) => s.requires_management_presence && !s.is_peak_shift)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const shift of mgmtShifts) {
    if (shiftHasManagementCoverage(shift, assignments, employees)) continue;

    const candidates = assistantManagers
      .filter((e) => canWorkShift(e, shift, buildCtx()).valid)
      .sort(byManagementPriority);

    if (candidates.length === 0) {
      throw new ManagementCoverageError(
        shift,
        "No management coverage available"
      );
    }

    assignments.push(makeAssignment(candidates[0], shift));
  }
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Generates a complete weekly schedule.
 *
 * @param weekStart  - First day (UTC midnight) of the target week.
 * @param employees  - All active employees being considered.
 * @param shifts     - All shifts to fill for the week.
 * @param timeOffRequests - APPROVED and PENDING time-off requests.
 * @param config     - ScheduleConfig controlling every threshold and weight.
 * @returns          ScheduleResult (never throws; errors are captured in result).
 */
export function generateSchedule(
  weekStart: Date,
  employees: Employee[],
  shifts: Shift[],
  timeOffRequests: TimeOffRequest[],
  config: ScheduleConfig
): ScheduleResult {
  const errors: BlockingViolation[] = [];
  const warnings: NonBlockingWarning[] = [];
  const assignments: Assignment[] = [];

  // ── Step 1: Pre-processing ────────────────────────────────────────────────

  // Re-evaluate is_peak_shift against configured time windows (additive — a
  // shift already marked peak in the input stays peak).
  const processedShifts: Shift[] = shifts.map((s) => {
    if (
      !s.is_peak_shift &&
      config.peak_windows &&
      config.peak_windows.length > 0 &&
      isPeakByWindows(s, config.peak_windows)
    ) {
      return { ...s, is_peak_shift: true };
    }
    return s;
  });

  const { approvedRequests, warnings: torWarnings } = resolveTimeOffConflicts(
    employees,
    processedShifts,
    timeOffRequests,
    config
  );
  warnings.push(...torWarnings);

  // ── Step 2: Management Pre-fill ───────────────────────────────────────────

  try {
    runManagementPrefill(
      weekStart,
      processedShifts,
      employees,
      approvedRequests,
      config,
      assignments
    );
  } catch (err) {
    if (err instanceof ManagementCoverageError) {
      errors.push(err.toViolation());
      return buildResult(weekStart, config, assignments, errors, warnings, "HALTED");
    }
    throw err; // unexpected — re-throw
  }

  // ── Steps 3 & 4: Scored STAFF Assignment ─────────────────────────────────

  const staffEmployees = employees.filter(
    (e) => e.management_tier === ManagementTier.STAFF
  );

  // Process specialty-constrained shifts first within each date so that
  // qualified employees are not "used up" by open shifts beforehand.
  const sortedShifts = [...processedShifts].sort(byDateThenSpecialty);

  for (const shift of sortedShifts) {
    const currentAssigned = assignments.filter(
      (a) =>
        a.shift_id === shift.id && a.status !== AssignmentStatus.CANCELLED
    ).length;

    const needed = shift.min_staff_count - currentAssigned;
    if (needed <= 0) continue;

    const ctx = {
      weekStart,
      assignments,
      employees,
      approvedTimeOff: approvedRequests,
      config,
    };
    const scoreCtx: ScoringContext = { weekStart, assignments, config };

    const candidates = staffEmployees
      .filter((e) => canWorkShift(e, shift, ctx).valid)
      .sort((a, b) => {
        const diff =
          scoreCandidateForShift(b, shift, scoreCtx) -
          scoreCandidateForShift(a, shift, scoreCtx);
        if (diff !== 0) return diff;
        return a.id < b.id ? -1 : 1; // stable tiebreaker for determinism
      });

    let filled = 0;
    for (const candidate of candidates) {
      if (filled >= needed) break;
      assignments.push(makeAssignment(candidate, shift));
      filled++;
    }
  }

  // ── Step 5: Gap Detection ─────────────────────────────────────────────────

  for (const shift of processedShifts) {
    const assignedCount = assignments.filter(
      (a) =>
        a.shift_id === shift.id && a.status !== AssignmentStatus.CANCELLED
    ).length;

    // Management coverage — should never fire if pre-fill succeeded, but
    // acts as a belt-and-suspenders guard.
    if (
      shift.requires_management_presence &&
      !shiftHasManagementCoverage(shift, assignments, employees)
    ) {
      errors.push({
        type: "ManagementCoverageError",
        shiftId: shift.id,
        date: shift.date,
        is_peak_shift: shift.is_peak_shift,
        reason: "Shift is missing management coverage after schedule generation",
      });
    } else if (
      shift.is_peak_shift &&
      !peakShiftHasManager(shift, assignments, employees)
    ) {
      errors.push({
        type: "ManagementCoverageError",
        shiftId: shift.id,
        date: shift.date,
        is_peak_shift: true,
        reason: "Peak shift is missing MANAGER coverage after schedule generation",
      });
    }

    // Staffing gap
    if (assignedCount < shift.min_staff_count) {
      warnings.push({
        type: "StaffingGap",
        shiftId: shift.id,
        message: `Shift ${shift.id} on ${shift.date.toISOString().split("T")[0]} is understaffed: ${assignedCount}/${shift.min_staff_count}`,
      });
    }
  }

  // Hours approaching / at cap
  for (const emp of employees) {
    const hours = getWeeklyHours(emp, weekStart, assignments);
    if (hours >= config.overtime_threshold) {
      warnings.push({
        type: "HoursAlert",
        employeeId: emp.id,
        message: `Employee ${emp.id} (${emp.name}) is at ${hours}h — overtime threshold: ${config.overtime_threshold}h`,
      });
    }
  }

  // ── Step 6: Validation Pass ───────────────────────────────────────────────

  for (const assignment of assignments) {
    const emp = employees.find((e) => e.id === assignment.employee_id);
    const shift = processedShifts.find((s) => s.id === assignment.shift_id);
    if (!emp || !shift) continue;

    // Evaluate this assignment in the context of all OTHER assignments
    const otherAssignments = assignments.filter((a) => a !== assignment);
    const validation = canWorkShift(emp, shift, {
      weekStart,
      assignments: otherAssignments,
      employees,
      approvedTimeOff: approvedRequests,
      config,
    });

    if (!validation.valid && validation.blocking) {
      // Unexpected — the pre-fill should have prevented this
      const alreadyLogged = errors.some(
        (e) => e.shiftId === shift.id && e.reason === validation.reasons[0]
      );
      if (!alreadyLogged) {
        errors.push({
          type: "ManagementCoverageError",
          shiftId: shift.id,
          date: shift.date,
          is_peak_shift: shift.is_peak_shift,
          reason: validation.reasons.join("; "),
        });
      }
    } else if (!validation.valid) {
      for (const reason of validation.reasons) {
        warnings.push({
          type: "ConstraintViolation",
          shiftId: shift.id,
          employeeId: emp.id,
          message: reason,
        });
      }
    }
  }

  return buildResult(
    weekStart,
    config,
    assignments,
    errors,
    warnings,
    errors.length === 0 ? "SUCCESS" : "HALTED"
  );
}
