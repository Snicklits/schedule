/**
 * Constraint Engine — Types
 *
 * Plain TypeScript interfaces/const-enums used by the pure constraint
 * engine.  These mirror the Prisma schema but carry no ORM dependency,
 * keeping every constraint function stateless and database-free.
 *
 * Phase 4 (data access) is responsible for mapping Prisma model objects
 * to these shapes before calling any engine function.
 */

// ─── Enums ─────────────────────────────────────────────────────────────────

export const ManagementTier = {
  MANAGER: "MANAGER",
  ASSISTANT_MANAGER: "ASSISTANT_MANAGER",
  STAFF: "STAFF",
} as const;
export type ManagementTier = (typeof ManagementTier)[keyof typeof ManagementTier];

export const EmploymentType = {
  FULL_TIME: "FULL_TIME",
  PART_TIME: "PART_TIME",
} as const;
export type EmploymentType = (typeof EmploymentType)[keyof typeof EmploymentType];

export const TimeOffStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  DENIED: "DENIED",
} as const;
export type TimeOffStatus = (typeof TimeOffStatus)[keyof typeof TimeOffStatus];

export const AssignmentStatus = {
  SCHEDULED: "SCHEDULED",
  CONFIRMED: "CONFIRMED",
  SWAPPED: "SWAPPED",
  CANCELLED: "CANCELLED",
} as const;
export type AssignmentStatus = (typeof AssignmentStatus)[keyof typeof AssignmentStatus];

// ─── Domain Interfaces ──────────────────────────────────────────────────────

export interface Employee {
  id: string;
  name: string;
  employment_type: EmploymentType;
  /** Contracted weekly hour cap (also the part-time ceiling). */
  weekly_hours_target: number;
  management_tier: ManagementTier;
  specialties: string[];
  /** Higher number = more senior. Used by the scheduling algorithm for priority scoring. */
  seniority_level: number;
  /** Lower number = higher in the org hierarchy. Used as a tiebreaker in scoring. */
  hierarchy_rank: number;
}

export interface Shift {
  id: string;
  /** Calendar date the shift belongs to (time portion is ignored). */
  date: Date;
  start_time: Date;
  end_time: Date;
  duration_hours: number;
  required_specialty: string | null;
  min_staff_count: number;
  is_peak_shift: boolean;
  requires_management_presence: boolean;
}

/**
 * Engine-level Assignment — includes denormalised shift timing so that
 * every constraint function receives all it needs in one flat object.
 */
export interface Assignment {
  employee_id: string;
  shift_id: string;
  /** Calendar date of the shift (used for weekly / consecutive-day calcs). */
  shift_date: Date;
  shift_start_time: Date;
  shift_end_time: Date;
  assigned_hours: number;
  status: AssignmentStatus;
}

export interface TimeOffRequest {
  id: string;
  employee_id: string;
  start_date: Date;
  end_date: Date;
  status: TimeOffStatus;
  /** When the request was submitted; used for first-come-first-served resolution. */
  created_at?: Date;
  /** Optional request-level priority (from Prisma model). */
  priority?: number;
}

// ─── Scheduling Algorithm Configuration ────────────────────────────────────

/** A time window that marks shifts as peak when they overlap it. */
export interface PeakWindow {
  /** "HH:MM" 24-hour format, e.g. "11:00". */
  start: string;
  /** "HH:MM" 24-hour format, e.g. "14:00". */
  end: string;
}

/**
 * Weights for the priority-scoring function.  All values are multipliers;
 * higher → that dimension has more influence on who gets assigned first.
 */
export interface ScoringWeights {
  /** Multiplier for employee seniority_level (default 10). */
  seniority: number;
  /** Multiplier for weekly hours still needed to reach target (default 1). */
  hours_gap: number;
  /**
   * Multiplier for fairness — employees with fewer prior undesirable
   * (weekend / late) assignments this week score higher (default 5).
   */
  fairness: number;
  /** Multiplier for hierarchy_rank tiebreaker — lower rank scores higher (default 0.1). */
  hierarchy_rank: number;
}

/** All configurable thresholds — never hardcode these values in engine functions. */
export interface ScheduleConfig {
  max_consecutive_days: number;
  max_weekly_hours: number;
  overtime_threshold: number;
  min_rest_hours_between_shifts: number;
  schedule_period_days: number;
  max_team_off_percentage: number;
  /** Time windows that turn a shift into a peak shift when they overlap. */
  peak_windows?: PeakWindow[];
  /** Priority-scoring weights used by the scheduling algorithm. */
  scoring_weights?: ScoringWeights;
}

// ─── Constraint Results ─────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  /**
   * true  → priorities 1–3 (halt schedule generation)
   * false → priorities 4–8 (warning-level; log but may continue)
   */
  blocking: boolean;
  reasons: string[];
}

// ─── canWorkShift Context ───────────────────────────────────────────────────

/** All data required by canWorkShift, passed as a single context object. */
export interface CanWorkShiftContext {
  /** Monday (or first day) of the scheduling week. */
  weekStart: Date;
  /** All existing assignments for the relevant period (may span multiple weeks). */
  assignments: Assignment[];
  /** All employees — needed for management-coverage look-ups. */
  employees: Employee[];
  /** APPROVED time-off requests for the relevant period. */
  approvedTimeOff: TimeOffRequest[];
  config: ScheduleConfig;
}

// ─── managementTimeOffIsSafe Context ───────────────────────────────────────

/** Minimal week schedule passed to managementTimeOffIsSafe. */
export interface WeekSchedule {
  shifts: Shift[];
  assignments: Assignment[];
}
