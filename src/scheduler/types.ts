/**
 * Scheduler — Phase 3 Types
 *
 * All scheduler-specific types that are layered on top of the constraint
 * engine types.  Nothing in this file imports from the scheduler algorithm;
 * it is safe to import here from constraintEngine/types without cycles.
 */

import type { Shift, Assignment, ScheduleConfig } from "../constraintEngine/types.js";

// ─── Errors ─────────────────────────────────────────────────────────────────

/**
 * Thrown internally by the management pre-fill step when a shift cannot
 * receive the required management coverage.  The outer generateSchedule
 * function catches this, converts it to a BlockingViolation, and returns
 * a HALTED ScheduleResult — it never propagates to callers.
 */
export class ManagementCoverageError extends Error {
  readonly shiftId: string;
  readonly shiftDate: Date;
  readonly shiftStartTime: Date;
  readonly shiftEndTime: Date;
  readonly isPeakShift: boolean;

  constructor(
    shift: Pick<Shift, "id" | "date" | "start_time" | "end_time" | "is_peak_shift">,
    reason: string
  ) {
    super(reason);
    this.name = "ManagementCoverageError";
    this.shiftId = shift.id;
    this.shiftDate = shift.date;
    this.shiftStartTime = shift.start_time;
    this.shiftEndTime = shift.end_time;
    this.isPeakShift = shift.is_peak_shift;
  }

  toViolation(): BlockingViolation {
    return {
      type: "ManagementCoverageError",
      shiftId: this.shiftId,
      date: this.shiftDate,
      is_peak_shift: this.isPeakShift,
      reason: this.message,
    };
  }
}

// ─── Result Types ────────────────────────────────────────────────────────────

/** A hard constraint failure that prevents the schedule from being published. */
export interface BlockingViolation {
  type: "ManagementCoverageError";
  shiftId: string;
  date: Date;
  is_peak_shift: boolean;
  reason: string;
}

/** A soft constraint failure or informational alert logged with the schedule. */
export interface NonBlockingWarning {
  type: "StaffingGap" | "HoursAlert" | "TimeOffHeld" | "ConstraintViolation";
  shiftId?: string;
  employeeId?: string;
  message: string;
}

/** The complete output of generateSchedule. */
export interface ScheduleResult {
  /** All assignments produced for the week. */
  schedule: Assignment[];
  /** Blocking violations — schedule cannot be published if non-empty. */
  errors: BlockingViolation[];
  /** Non-blocking warnings — logged but do not block publishing. */
  warnings: NonBlockingWarning[];
  /** true only when errors[] is empty. */
  isPublishable: boolean;
  /** Immutable run log for audit / debugging. */
  runLog: RunLog;
}

/** Persisted audit record for a single generateSchedule invocation. */
export interface RunLog {
  timestamp: Date;
  weekStart: Date;
  /** Snapshot of the config used (deep-cloned so later mutations do not affect it). */
  configSnapshot: ScheduleConfig;
  outcome: "SUCCESS" | "HALTED";
  errors: BlockingViolation[];
  warnings: NonBlockingWarning[];
}

// ─── Scoring Context ─────────────────────────────────────────────────────────

/**
 * Everything scoreCandidateForShift needs to compute a comparable score.
 * Passed separately from CanWorkShiftContext to keep the scoring function
 * lightweight (no employees list needed, just accumulated assignments).
 */
export interface ScoringContext {
  weekStart: Date;
  /** All assignments accumulated so far in the current generation run. */
  assignments: Assignment[];
  config: ScheduleConfig;
}

// ─── Conflict-resolution intermediate ───────────────────────────────────────

/** Internal return type from resolveTimeOffConflicts. */
export interface TimeOffResolutionResult {
  /** APPROVED requests — either pre-approved or newly approved through resolution. */
  approvedRequests: import("../constraintEngine/types.js").TimeOffRequest[];
  warnings: NonBlockingWarning[];
}
