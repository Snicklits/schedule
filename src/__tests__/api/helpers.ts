/**
 * Test helpers: token minting and fixture factories.
 */

import { mintTestToken } from "../../middleware/auth.js";

export { mintTestToken };

export const mockConfig = {
  max_consecutive_days: 5,
  max_weekly_hours: 40,
  overtime_threshold: 40,
  min_rest_hours_between_shifts: 8,
  schedule_period_days: 7,
  max_team_off_percentage: 0.3,
};

export const mockEmployee = {
  id: "emp-1",
  name: "Alice Manager",
  employment_type: "FULL_TIME",
  weekly_hours_target: 40,
  management_tier: "MANAGER",
  specialties: [],
  seniority_level: 5,
  hierarchy_rank: 1,
};

export const mockStaffEmployee = {
  id: "emp-2",
  name: "Bob Staff",
  employment_type: "FULL_TIME",
  weekly_hours_target: 40,
  management_tier: "STAFF",
  specialties: [],
  seniority_level: 1,
  hierarchy_rank: 5,
};

export const mockShift = {
  id: "shift-1",
  date: new Date("2026-03-02"),
  start_time: new Date("2026-03-02T09:00:00Z"),
  end_time: new Date("2026-03-02T17:00:00Z"),
  duration_hours: 8,
  required_specialty: null,
  min_staff_count: 1,
  is_peak_shift: false,
  requires_management_presence: true,
};

/** Prisma-style raw assignment with employee and shift included. */
export const mockRawAssignment = {
  id: "assign-1",
  employee_id: "emp-1",
  shift_id: "shift-1",
  assigned_hours: 8,
  status: "SCHEDULED",
  employee: {
    id: "emp-1",
    name: "Alice Manager",
    email: "alice@example.com",
    employment_type: "FULL_TIME",
    weekly_hours_target: 40,
    management_tier: "MANAGER",
    specialties: [],
    seniority_level: 5,
    hierarchy_rank: 1,
    role: "Manager",
    hire_date: new Date("2020-01-01"),
    status: "ACTIVE",
  },
  shift: {
    id: "shift-1",
    date: new Date("2026-03-02"),
    start_time: new Date("2026-03-02T09:00:00Z"),
    end_time: new Date("2026-03-02T17:00:00Z"),
    duration_hours: 8,
    required_specialty: null,
    min_staff_count: 1,
    is_peak_shift: false,
    requires_management_presence: true,
    location: null,
  },
};

/** Engine-type Assignment for mock returns. */
export const mockEngineAssignment = {
  employee_id: "emp-1",
  shift_id: "shift-1",
  shift_date: new Date("2026-03-02"),
  shift_start_time: new Date("2026-03-02T09:00:00Z"),
  shift_end_time: new Date("2026-03-02T17:00:00Z"),
  assigned_hours: 8,
  status: "SCHEDULED" as const,
};

/** Engine-type TimeOffRequest */
export const mockTimeOff = {
  id: "tof-1",
  employee_id: "emp-1",
  start_date: new Date("2026-03-10"),
  end_date: new Date("2026-03-14"),
  status: "PENDING" as const,
  priority: 1,
  created_at: new Date("2026-03-01"),
};

/** Raw Prisma-style time-off request with employee included. */
export const mockRawTimeOff = {
  id: "tof-1",
  employee_id: "emp-2",
  type: "VACATION",
  start_date: new Date("2026-03-10"),
  end_date: new Date("2026-03-14"),
  status: "PENDING",
  priority: 0,
  created_at: new Date("2026-03-01"),
  employee: {
    id: "emp-2",
    name: "Bob Staff",
    email: "bob@example.com",
    employment_type: "FULL_TIME",
    weekly_hours_target: 40,
    management_tier: "STAFF",
    specialties: [],
    seniority_level: 1,
    hierarchy_rank: 5,
    role: "Staff",
    hire_date: new Date("2022-01-01"),
    status: "ACTIVE",
  },
};

/** Raw manager time-off request (for coverage-unsafe test). */
export const mockManagerRawTimeOff = {
  ...mockRawTimeOff,
  id: "tof-2",
  employee_id: "emp-1",
  employee: {
    id: "emp-1",
    name: "Alice Manager",
    email: "alice@example.com",
    employment_type: "FULL_TIME",
    weekly_hours_target: 40,
    management_tier: "MANAGER",
    specialties: [],
    seniority_level: 5,
    hierarchy_rank: 1,
    role: "Manager",
    hire_date: new Date("2020-01-01"),
    status: "ACTIVE",
  },
};

export const mockScheduleResult = {
  schedule: [],
  errors: [],
  warnings: [],
  isPublishable: true,
  runLog: {
    timestamp: new Date(),
    weekStart: new Date("2026-03-02"),
    configSnapshot: mockConfig,
    outcome: "SUCCESS" as const,
    errors: [],
    warnings: [],
  },
};

export const mockHaltedResult = {
  ...mockScheduleResult,
  isPublishable: false,
  errors: [
    {
      type: "ManagementCoverageError" as const,
      shiftId: "shift-1",
      date: new Date("2026-03-02"),
      is_peak_shift: false,
      reason: "No available Managers for peak shift",
    },
  ],
  runLog: {
    ...mockScheduleResult.runLog,
    outcome: "HALTED" as const,
  },
};
