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

// ─── Coverage ─────────────────────────────────────────────────────────────────

export interface CoverageCheckResult {
  weekStart: string;
  managementGaps: Shift[];
  peakWithoutManager: Array<{ shift: Shift; hasManager: boolean }>;
  isFullyCovered: boolean;
}

// ─── Shift Swap ───────────────────────────────────────────────────────────────

export type SwapStatus = "PENDING" | "APPROVED" | "DENIED";

export interface ShiftSwapRequest {
  id: string;
  requester_id: string;
  target_employee_id: string;
  assignment_id: string;
  status: SwapStatus;
  manager_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  requester: EmployeeWithStatus;
  target_employee: EmployeeWithStatus;
  assignment: AssignmentWithDetails;
}

// ─── Portal ───────────────────────────────────────────────────────────────────

export interface PortalHoursSummary {
  employeeId: string;
  name: string;
  weeklyHours: number;
  isAtCap: boolean;
  targetHours: number;
  assignments: AssignmentWithDetails[];
}

// ─── Budget ───────────────────────────────────────────────────────────────────

export interface BudgetSummary {
  week_start: string;
  budget_hours: number | null;
  scheduled_hours: number;
  variance: number | null;
  status: "UNDER" | "ON_TRACK" | "OVER" | null;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export interface HistoricalEvent {
  id: string;
  name: string;
  event_type: string;
  date: string;
  staff_used: number;
  hours_used: number;
  notes: string | null;
  created_at: string;
}

export interface UpcomingEvent {
  id: string;
  name: string;
  event_type: string;
  date: string;
  confirmed_staff: number | null;
  notes: string | null;
  recommended_staff: number | null;
  recommended_hours: number | null;
  created_at: string;
  updated_at: string;
}

// ─── Salary ───────────────────────────────────────────────────────────────────

export interface PaySummary {
  employee_id: string;
  employee_name: string;
  week_start: string;
  scheduled_hours: number;
  absent_hours: number;
  worked_hours: number;
  hourly_rate: number;
  gross_pay: number;
  currency: string;
  weekly_hours_target: number;
}

export interface TeamSalaryResult {
  employees: PaySummary[];
  team_total_gross: number;
}

// ─── Company Config ───────────────────────────────────────────────────────────

export interface CompanyConfig {
  id: string;
  company_name: string;
  logo_url: string | null;
  primary_color: string | null;
  updated_at: string;
}

// ─── Employee (extended) ──────────────────────────────────────────────────────

export type UserAccountStatus = "INVITED" | "ACTIVE" | "SUSPENDED";

export interface EmployeeWithAccount extends EmployeeWithStatus {
  hourly_rate?: number;
  currency?: string;
  avatar_url?: string | null;
  user_account?: {
    status: UserAccountStatus;
    email: string;
  } | null;
}
