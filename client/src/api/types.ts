// ─── Shared ───────────────────────────────────────────────────────────────────

export type EmploymentType = "FULL_TIME" | "PART_TIME";
export type ManagementTier = "MANAGER" | "ASSISTANT_MANAGER" | "STAFF";
export type EmployeeStatus = "ACTIVE" | "INACTIVE";
export type TimeOffStatus = "PENDING" | "APPROVED" | "DENIED";
export type TimeOffType = "VACATION" | "SICK" | "PERSONAL" | "UNPAID";
export type AssignmentStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

// ─── Employee ─────────────────────────────────────────────────────────────────

export interface Employee {
  id: string;
  name: string;
  employment_type: EmploymentType;
  weekly_hours_target: number;
  management_tier: ManagementTier;
  specialties: string[];
  seniority_level: number;
  hierarchy_rank: number;
}

export interface EmployeeWithStatus extends Employee {
  status: EmployeeStatus;
  email: string;
  hire_date: string;
  role: string;
}

// ─── Shift ────────────────────────────────────────────────────────────────────

export interface Shift {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  required_specialty: string | null;
  min_staff_count: number;
  is_peak_shift: boolean;
  requires_management_presence: boolean;
  location: string | null;
}

// ─── Assignment ───────────────────────────────────────────────────────────────

export interface AssignmentWithDetails {
  id: string;
  employee_id: string;
  shift_id: string;
  assigned_hours: number;
  status: AssignmentStatus;
  employee: EmployeeWithStatus;
  shift: Shift;
}

// ─── Time-Off ─────────────────────────────────────────────────────────────────

export interface TimeOffRequest {
  id: string;
  employee_id: string;
  type: TimeOffType;
  start_date: string;
  end_date: string;
  status: TimeOffStatus;
  priority: number;
  created_at: string;
}

export interface TimeOffWithEmployee extends TimeOffRequest {
  employee: EmployeeWithStatus;
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export interface ScheduleError {
  type: string;
  shiftId: string;
  date: string;
  is_peak_shift: boolean;
  reason: string;
}

export interface ScheduleGenerateResult {
  runId: string;
  schedule: AssignmentWithDetails[];
  errors: ScheduleError[];
  warnings: string[];
  isPublishable: boolean;
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface HoursSummaryRow {
  employeeId: string;
  name: string;
  weeklyHours: number;
  isAtCap: boolean;
}

export interface Violation {
  id: string;
  type: "BLOCKING" | "WARNING";
  message: string;
  shift_id?: string;
  employee_id?: string;
  week_start?: string;
  created_at: string;
}

export interface ManagementGap {
  shift_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_peak_shift: boolean;
}

// ─── API envelope ─────────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
}
