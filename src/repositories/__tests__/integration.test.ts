/**
 * End-to-end integration test
 *
 * Verifies that the Phase 3 generateSchedule function works correctly when
 * given data shaped exactly as the repository mappers produce it.
 * No real database is used — all data is constructed inline via mappers.
 */

import { describe, it, expect } from "vitest";
import { generateSchedule } from "../../scheduler/index.js";
import { toEmployee, toShift } from "../mappers.js";
import type { PrismaEmployee, PrismaShift } from "../mappers.js";

// ── Fixture data (matches what Prisma would return) ──────────────────────────

const WEEK_START = new Date("2026-03-02T00:00:00.000Z");

function wd(days: number, hour = 0, minute = 0): Date {
  const d = new Date(WEEK_START);
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

const prismaEmployees: PrismaEmployee[] = [
  {
    id: "mgr-1",
    name: "Alice Manager",
    employment_type: "FULL_TIME",
    weekly_hours_target: 40,
    management_tier: "MANAGER",
    specialties: ["cashier"],
    seniority_level: 8,
    hierarchy_rank: 1,
  },
  {
    id: "am-1",
    name: "Carol AM",
    employment_type: "FULL_TIME",
    weekly_hours_target: 40,
    management_tier: "ASSISTANT_MANAGER",
    specialties: ["cashier"],
    seniority_level: 6,
    hierarchy_rank: 3,
  },
  {
    id: "s-1",
    name: "Frank Staff",
    employment_type: "FULL_TIME",
    weekly_hours_target: 40,
    management_tier: "STAFF",
    specialties: ["cashier"],
    seniority_level: 3,
    hierarchy_rank: 6,
  },
  {
    id: "s-2",
    name: "Grace Staff",
    employment_type: "FULL_TIME",
    weekly_hours_target: 40,
    management_tier: "STAFF",
    specialties: [],
    seniority_level: 3,
    hierarchy_rank: 7,
  },
];

const prismaShifts: PrismaShift[] = [
  {
    id: "shift-mon",
    date: wd(0),
    start_time: wd(0, 9),
    end_time: wd(0, 17),
    duration_hours: 8,
    required_specialty: null,
    min_staff_count: 2,
    is_peak_shift: false,
    requires_management_presence: true,
  },
  {
    id: "shift-tue",
    date: wd(1),
    start_time: wd(1, 9),
    end_time: wd(1, 17),
    duration_hours: 8,
    required_specialty: null,
    min_staff_count: 1,
    is_peak_shift: false,
    requires_management_presence: false,
  },
];

const config = {
  max_consecutive_days: 5,
  max_weekly_hours: 40,
  overtime_threshold: 40,
  min_rest_hours_between_shifts: 10,
  schedule_period_days: 7,
  max_team_off_percentage: 0.33,
};

describe("generateSchedule — with repository-mapped data", () => {
  it("produces a publishable schedule when all constraints can be met", () => {
    const employees = prismaEmployees.map(toEmployee);
    const shifts = prismaShifts.map(toShift);

    const result = generateSchedule(WEEK_START, employees, shifts, [], config);

    expect(result.isPublishable).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.schedule.length).toBeGreaterThan(0);
  });

  it("includes at least one management assignment on the management-required shift", () => {
    const employees = prismaEmployees.map(toEmployee);
    const shifts = prismaShifts.map(toShift);

    const result = generateSchedule(WEEK_START, employees, shifts, [], config);

    const monAssignments = result.schedule.filter(
      (a) => a.shift_id === "shift-mon"
    );
    const mgmtAssigned = monAssignments.some(
      (a) => a.employee_id === "mgr-1" || a.employee_id === "am-1"
    );
    expect(mgmtAssigned).toBe(true);
  });

  it("emits a runLog with outcome SUCCESS", () => {
    const employees = prismaEmployees.map(toEmployee);
    const shifts = prismaShifts.map(toShift);

    const result = generateSchedule(WEEK_START, employees, shifts, [], config);

    expect(result.runLog.outcome).toBe("SUCCESS");
    expect(result.runLog.weekStart).toEqual(WEEK_START);
    expect(result.runLog.configSnapshot).toMatchObject(config);
  });

  it("returns HALTED when management coverage is impossible", () => {
    // Only STAFF employees — every management-required shift will HALT
    const staffOnly = prismaEmployees
      .filter((e) => e.management_tier === "STAFF")
      .map(toEmployee);
    const shifts = [prismaShifts[0]!].map(toShift); // mon shift requires_management_presence

    const result = generateSchedule(WEEK_START, staffOnly, shifts, [], config);

    expect(result.isPublishable).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.runLog.outcome).toBe("HALTED");
  });

  it("respects approved time-off from the repository shape", () => {
    const employees = prismaEmployees.map(toEmployee);
    const shifts = [prismaShifts[1]!].map(toShift); // tue — no mgmt required

    // Approve time off for s-1 on Tuesday
    const approvedTimeOff = [
      {
        id: "tor-1",
        employee_id: "s-1",
        start_date: wd(1),
        end_date: wd(1),
        status: "APPROVED" as const,
        priority: 3,
        created_at: new Date("2026-02-01T00:00:00.000Z"),
      },
    ];

    const result = generateSchedule(
      WEEK_START,
      employees,
      shifts,
      approvedTimeOff,
      config
    );

    const s1Assigned = result.schedule.some(
      (a) => a.employee_id === "s-1" && a.shift_id === "shift-tue"
    );
    expect(s1Assigned).toBe(false);
  });
});
