/**
 * Test Fixtures — Shared in-memory data factory
 *
 * Pure data (no database calls).  Import these helpers from unit, integration,
 * E2E, and benchmark tests to build consistent, realistic test datasets.
 *
 * Seed: 2 Managers, 3 AMs, 10 Staff employees + a full week of shifts.
 */

import type {
  Employee,
  Shift,
  Assignment,
  TimeOffRequest,
  ScheduleConfig,
} from "../../constraintEngine/types.js";
import {
  ManagementTier,
  EmploymentType,
  TimeOffStatus,
  AssignmentStatus,
} from "../../constraintEngine/types.js";

// ─── Reference week (Mon 2 Mar 2026, UTC) ────────────────────────────────────

export const WEEK_START = new Date("2026-03-02T00:00:00.000Z");

/** Returns a UTC Date offset from WEEK_START by `days` days and optionally set to `hour:minute`. */
export function weekDay(offset: number, hour = 0, minute = 0): Date {
  const d = new Date(WEEK_START);
  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

// ─── Default ScheduleConfig ───────────────────────────────────────────────────

export const defaultConfig: ScheduleConfig = {
  max_consecutive_days: 5,
  max_weekly_hours: 40,
  overtime_threshold: 40,
  min_rest_hours_between_shifts: 10,
  schedule_period_days: 7,
  max_team_off_percentage: 0.25,
};

// ─── Employee factory ─────────────────────────────────────────────────────────

let _idSeq = 0;
export function nextId(prefix = "id"): string {
  return `${prefix}-${++_idSeq}`;
}

export function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: nextId("emp"),
    name: "Test Employee",
    employment_type: EmploymentType.FULL_TIME,
    weekly_hours_target: 40,
    management_tier: ManagementTier.STAFF,
    specialties: [],
    seniority_level: 1,
    hierarchy_rank: 10,
    ...overrides,
  };
}

// ─── Seed Employees ───────────────────────────────────────────────────────────

/** Manager 1 — most senior */
export const manager1: Employee = {
  id: "seed-mgr-1",
  name: "Alice Manager",
  employment_type: EmploymentType.FULL_TIME,
  weekly_hours_target: 40,
  management_tier: ManagementTier.MANAGER,
  specialties: ["barista", "trainer"],
  seniority_level: 10,
  hierarchy_rank: 1,
};

/** Manager 2 */
export const manager2: Employee = {
  id: "seed-mgr-2",
  name: "Bob Manager",
  employment_type: EmploymentType.FULL_TIME,
  weekly_hours_target: 40,
  management_tier: ManagementTier.MANAGER,
  specialties: ["barista"],
  seniority_level: 9,
  hierarchy_rank: 2,
};

/** Assistant Manager 1 */
export const am1: Employee = {
  id: "seed-am-1",
  name: "Carol AM",
  employment_type: EmploymentType.FULL_TIME,
  weekly_hours_target: 40,
  management_tier: ManagementTier.ASSISTANT_MANAGER,
  specialties: ["barista"],
  seniority_level: 7,
  hierarchy_rank: 3,
};

/** Assistant Manager 2 */
export const am2: Employee = {
  id: "seed-am-2",
  name: "Dave AM",
  employment_type: EmploymentType.FULL_TIME,
  weekly_hours_target: 40,
  management_tier: ManagementTier.ASSISTANT_MANAGER,
  specialties: [],
  seniority_level: 6,
  hierarchy_rank: 4,
};

/** Assistant Manager 3 */
export const am3: Employee = {
  id: "seed-am-3",
  name: "Eve AM",
  employment_type: EmploymentType.FULL_TIME,
  weekly_hours_target: 40,
  management_tier: ManagementTier.ASSISTANT_MANAGER,
  specialties: [],
  seniority_level: 5,
  hierarchy_rank: 5,
};

/** 10 Staff employees (STAFF_1 … STAFF_10) */
export const staffEmployees: Employee[] = Array.from({ length: 10 }, (_, i) => ({
  id: `seed-staff-${i + 1}`,
  name: `Staff ${i + 1}`,
  employment_type: i < 8 ? EmploymentType.FULL_TIME : EmploymentType.PART_TIME,
  weekly_hours_target: i < 8 ? 40 : 20,
  management_tier: ManagementTier.STAFF,
  specialties: i === 0 ? ["barista"] : i === 1 ? ["barista", "trainer"] : [],
  seniority_level: 4 - Math.floor(i / 3),
  hierarchy_rank: 6 + i,
}));

/** All 15 seed employees combined. */
export const allSeedEmployees: Employee[] = [
  manager1,
  manager2,
  am1,
  am2,
  am3,
  ...staffEmployees,
];

// ─── Shift factory ────────────────────────────────────────────────────────────

export function makeShift(overrides: Partial<Shift> = {}): Shift {
  const dayOffset = overrides.date
    ? Math.round(
        (overrides.date.getTime() - WEEK_START.getTime()) / (24 * 60 * 60 * 1000)
      )
    : 0;
  const date = weekDay(dayOffset);
  return {
    id: nextId("shift"),
    date,
    start_time: weekDay(dayOffset, 9),
    end_time: weekDay(dayOffset, 17),
    duration_hours: 8,
    required_specialty: null,
    min_staff_count: 2,
    is_peak_shift: false,
    requires_management_presence: true,
    ...overrides,
  };
}

// ─── Seed Shifts — full week ──────────────────────────────────────────────────

/** One management-required shift per day Monday–Friday + a weekend peak. */
export function buildWeekShifts(): Shift[] {
  return [
    // Mon — regular management shift
    {
      id: "seed-shift-mon",
      date: weekDay(0),
      start_time: weekDay(0, 9),
      end_time: weekDay(0, 17),
      duration_hours: 8,
      required_specialty: null,
      min_staff_count: 3,
      is_peak_shift: false,
      requires_management_presence: true,
    },
    // Tue — specialty shift
    {
      id: "seed-shift-tue",
      date: weekDay(1),
      start_time: weekDay(1, 9),
      end_time: weekDay(1, 17),
      duration_hours: 8,
      required_specialty: "barista",
      min_staff_count: 2,
      is_peak_shift: false,
      requires_management_presence: true,
    },
    // Wed — peak shift (requires MANAGER)
    {
      id: "seed-shift-wed-peak",
      date: weekDay(2),
      start_time: weekDay(2, 11),
      end_time: weekDay(2, 19),
      duration_hours: 8,
      required_specialty: null,
      min_staff_count: 3,
      is_peak_shift: true,
      requires_management_presence: true,
    },
    // Thu — regular
    {
      id: "seed-shift-thu",
      date: weekDay(3),
      start_time: weekDay(3, 9),
      end_time: weekDay(3, 17),
      duration_hours: 8,
      required_specialty: null,
      min_staff_count: 2,
      is_peak_shift: false,
      requires_management_presence: true,
    },
    // Fri — regular
    {
      id: "seed-shift-fri",
      date: weekDay(4),
      start_time: weekDay(4, 9),
      end_time: weekDay(4, 17),
      duration_hours: 8,
      required_specialty: null,
      min_staff_count: 2,
      is_peak_shift: false,
      requires_management_presence: true,
    },
    // Sat — peak weekend
    {
      id: "seed-shift-sat-peak",
      date: weekDay(5),
      start_time: weekDay(5, 11),
      end_time: weekDay(5, 19),
      duration_hours: 8,
      required_specialty: null,
      min_staff_count: 3,
      is_peak_shift: true,
      requires_management_presence: true,
    },
    // Sun — open (no management required)
    {
      id: "seed-shift-sun",
      date: weekDay(6),
      start_time: weekDay(6, 10),
      end_time: weekDay(6, 18),
      duration_hours: 8,
      required_specialty: null,
      min_staff_count: 1,
      is_peak_shift: false,
      requires_management_presence: false,
    },
  ];
}

// ─── Assignment factory ───────────────────────────────────────────────────────

export function makeAssignment(
  employee: Employee,
  shift: Shift,
  status: Assignment["status"] = AssignmentStatus.SCHEDULED
): Assignment {
  return {
    employee_id: employee.id,
    shift_id: shift.id,
    shift_date: shift.date,
    shift_start_time: shift.start_time,
    shift_end_time: shift.end_time,
    assigned_hours: shift.duration_hours,
    status,
  };
}

// ─── Time-off factory ─────────────────────────────────────────────────────────

export function makeTimeOff(
  employee: Employee,
  startOffset: number,
  endOffset: number,
  status: TimeOffRequest["status"] = TimeOffStatus.PENDING,
  priority = 0
): TimeOffRequest {
  return {
    id: nextId("tor"),
    employee_id: employee.id,
    start_date: weekDay(startOffset),
    end_date: weekDay(endOffset),
    status,
    created_at: new Date("2026-02-01T10:00:00.000Z"),
    priority,
  };
}

// ─── Seed Time-off ────────────────────────────────────────────────────────────

/** 1 approved time-off for Staff 3 (Mon only). */
export const approvedTimeOff: TimeOffRequest = makeTimeOff(
  staffEmployees[2]!,
  0, // Mon
  0,
  TimeOffStatus.APPROVED
);

/** 1 pending time-off for Staff 4 (Tue–Wed). */
export const pendingTimeOff: TimeOffRequest = makeTimeOff(
  staffEmployees[3]!,
  1, // Tue
  2, // Wed
  TimeOffStatus.PENDING
);

/** Combined for use in schedule generation. */
export function seedTimeOff(): TimeOffRequest[] {
  return [approvedTimeOff, pendingTimeOff];
}

// ─── Prisma-shaped mocks (for integration tests) ──────────────────────────────

/** Prisma-shaped employee row (includes status, email, etc.). */
export function prismaEmployee(emp: Employee, email?: string) {
  return {
    id: emp.id,
    name: emp.name,
    email: email ?? `${emp.id}@test.com`,
    employment_type: emp.employment_type,
    weekly_hours_target: emp.weekly_hours_target,
    management_tier: emp.management_tier,
    specialties: emp.specialties,
    seniority_level: emp.seniority_level,
    hierarchy_rank: emp.hierarchy_rank,
    hire_date: new Date("2020-01-01"),
    role: "Employee",
    status: "ACTIVE" as const,
  };
}

/** Prisma-shaped shift row. */
export function prismaShift(shift: Shift) {
  return {
    id: shift.id,
    date: shift.date,
    start_time: shift.start_time,
    end_time: shift.end_time,
    duration_hours: shift.duration_hours,
    required_specialty: shift.required_specialty,
    min_staff_count: shift.min_staff_count,
    is_peak_shift: shift.is_peak_shift,
    requires_management_presence: shift.requires_management_presence,
    location: null,
  };
}

/** Prisma-shaped time-off request row with nested employee. */
export function prismaTimeOff(
  tor: TimeOffRequest,
  emp: Employee,
  email = "emp@test.com"
) {
  return {
    id: tor.id,
    employee_id: tor.employee_id,
    type: "VACATION" as const,
    start_date: tor.start_date,
    end_date: tor.end_date,
    status: tor.status,
    priority: tor.priority ?? 0,
    created_at: tor.created_at ?? new Date(),
    employee: prismaEmployee(emp, email),
  };
}

/** A minimal ScheduleConfig Prisma row. */
export const prismaConfig = {
  id: "config-1",
  max_consecutive_days: 5,
  max_weekly_hours: 40,
  overtime_threshold: 40,
  min_rest_hours_between_shifts: 10,
  schedule_period_days: 7,
  conflict_resolution_strategy: "SENIORITY_FIRST" as const,
  peak_windows: [],
  max_team_off_percentage: 0.25,
};
