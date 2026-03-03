/**
 * Key query tests — Prisma client is mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Prisma singleton ─────────────────────────────────────────────────────
// vi.mock is hoisted; use vi.hoisted() so mock vars are ready before hoisting.
const mocks = vi.hoisted(() => ({
  timeOffFindMany: vi.fn(),
  employeeFindMany: vi.fn(),
  assignmentAggregate: vi.fn(),
  assignmentFindMany: vi.fn(),
  shiftFindMany: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    timeOffRequest: { findMany: mocks.timeOffFindMany },
    employee: { findMany: mocks.employeeFindMany },
    assignment: {
      aggregate: mocks.assignmentAggregate,
      findMany: mocks.assignmentFindMany,
    },
    shift: { findMany: mocks.shiftFindMany },
  },
}));

import {
  getAvailableEmployeesForDate,
  getTotalWeeklyHoursForEmployee,
  getConsecutiveWorkingDays,
  getShiftsLackingManagementCoverage,
  getPeakShiftsWithManagerCheck,
  getAvailableManagementEmployeesForDate,
} from "../keyQueries.js";

const WEEK_START = new Date("2026-03-02T00:00:00.000Z");
const MON = new Date("2026-03-02T00:00:00.000Z");

const mockPrismaEmployee = {
  id: "emp-1",
  name: "Alice",
  employment_type: "FULL_TIME",
  weekly_hours_target: 40,
  management_tier: "MANAGER",
  specialties: ["cashier"],
  seniority_level: 8,
  hierarchy_rank: 1,
  email: "alice@store.com",
  hire_date: new Date("2018-04-15"),
  role: "Manager",
  status: "ACTIVE",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAvailableEmployeesForDate", () => {
  it("excludes employees with approved time-off", async () => {
    mocks.timeOffFindMany.mockResolvedValue([{ employee_id: "emp-2" }]);
    mocks.employeeFindMany.mockResolvedValue([mockPrismaEmployee]);

    const result = await getAvailableEmployeesForDate(MON);

    expect(mocks.employeeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ACTIVE",
          id: { notIn: ["emp-2"] },
        }),
      })
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("emp-1");
  });

  it("does not add id filter when no one is on time-off", async () => {
    mocks.timeOffFindMany.mockResolvedValue([]);
    mocks.employeeFindMany.mockResolvedValue([mockPrismaEmployee]);

    await getAvailableEmployeesForDate(MON);

    const callArg = mocks.employeeFindMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(callArg.where).not.toHaveProperty("id");
  });
});

describe("getTotalWeeklyHoursForEmployee", () => {
  it("returns the aggregated sum", async () => {
    mocks.assignmentAggregate.mockResolvedValue({ _sum: { assigned_hours: 32 } });
    const result = await getTotalWeeklyHoursForEmployee("emp-1", WEEK_START);
    expect(result).toBe(32);
  });

  it("returns 0 when _sum is null", async () => {
    mocks.assignmentAggregate.mockResolvedValue({ _sum: { assigned_hours: null } });
    const result = await getTotalWeeklyHoursForEmployee("emp-1", WEEK_START);
    expect(result).toBe(0);
  });

  it("excludes CANCELLED assignments", async () => {
    mocks.assignmentAggregate.mockResolvedValue({ _sum: { assigned_hours: 0 } });
    await getTotalWeeklyHoursForEmployee("emp-1", WEEK_START);
    expect(mocks.assignmentAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: "CANCELLED" } }),
      })
    );
  });
});

describe("getConsecutiveWorkingDays", () => {
  it("returns 0 when employee has no prior assignments", async () => {
    mocks.assignmentFindMany.mockResolvedValue([]);
    const result = await getConsecutiveWorkingDays("emp-1", MON);
    expect(result).toBe(0);
  });

  it("counts consecutive days before the given date", async () => {
    // Worked Sun 2026-03-01 and Sat 2026-02-28 — streak of 2 before Mon 2026-03-02
    const sun = new Date("2026-03-01T12:00:00.000Z");
    const sat = new Date("2026-02-28T12:00:00.000Z");
    mocks.assignmentFindMany.mockResolvedValue([
      { shift: { date: sun } },
      { shift: { date: sat } },
    ]);
    const result = await getConsecutiveWorkingDays("emp-1", MON);
    expect(result).toBe(2);
  });

  it("stops counting at a gap", async () => {
    // Worked Sun but not Sat — streak is only 1
    const sun = new Date("2026-03-01T12:00:00.000Z");
    mocks.assignmentFindMany.mockResolvedValue([{ shift: { date: sun } }]);
    const result = await getConsecutiveWorkingDays("emp-1", MON);
    expect(result).toBe(1);
  });
});

describe("getShiftsLackingManagementCoverage", () => {
  it("returns shifts with no management assigned", async () => {
    const shiftWithoutMgmt = {
      id: "shift-1",
      date: new Date("2026-03-02T12:00:00.000Z"),
      start_time: new Date("2026-03-02T09:00:00.000Z"),
      end_time: new Date("2026-03-02T17:00:00.000Z"),
      duration_hours: 8,
      required_specialty: null,
      min_staff_count: 3,
      is_peak_shift: false,
      requires_management_presence: true,
      assignments: [
        { status: "SCHEDULED", employee: { management_tier: "STAFF" } },
      ],
    };
    mocks.shiftFindMany.mockResolvedValue([shiftWithoutMgmt]);

    const result = await getShiftsLackingManagementCoverage(WEEK_START);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("shift-1");
  });

  it("excludes shifts that have management coverage", async () => {
    const shiftWithMgmt = {
      id: "shift-2",
      date: new Date("2026-03-02T12:00:00.000Z"),
      start_time: new Date("2026-03-02T09:00:00.000Z"),
      end_time: new Date("2026-03-02T17:00:00.000Z"),
      duration_hours: 8,
      required_specialty: null,
      min_staff_count: 3,
      is_peak_shift: false,
      requires_management_presence: true,
      assignments: [
        { status: "SCHEDULED", employee: { management_tier: "ASSISTANT_MANAGER" } },
      ],
    };
    mocks.shiftFindMany.mockResolvedValue([shiftWithMgmt]);

    const result = await getShiftsLackingManagementCoverage(WEEK_START);
    expect(result).toHaveLength(0);
  });
});

describe("getPeakShiftsWithManagerCheck", () => {
  const peakShiftBase = {
    id: "shift-peak",
    date: new Date("2026-03-02T12:00:00.000Z"),
    start_time: new Date("2026-03-02T17:00:00.000Z"),
    end_time: new Date("2026-03-02T22:00:00.000Z"),
    duration_hours: 5,
    required_specialty: null,
    min_staff_count: 3,
    is_peak_shift: true,
    requires_management_presence: true,
  };

  it("reports hasManager=true when a MANAGER is assigned", async () => {
    mocks.shiftFindMany.mockResolvedValue([
      {
        ...peakShiftBase,
        assignments: [
          { status: "SCHEDULED", employee: { management_tier: "MANAGER" } },
        ],
      },
    ]);
    const result = await getPeakShiftsWithManagerCheck(WEEK_START);
    expect(result[0].hasManager).toBe(true);
  });

  it("reports hasManager=false when only ASSISTANT_MANAGER is assigned", async () => {
    mocks.shiftFindMany.mockResolvedValue([
      {
        ...peakShiftBase,
        assignments: [
          { status: "SCHEDULED", employee: { management_tier: "ASSISTANT_MANAGER" } },
        ],
      },
    ]);
    const result = await getPeakShiftsWithManagerCheck(WEEK_START);
    expect(result[0].hasManager).toBe(false);
  });
});

describe("getAvailableManagementEmployeesForDate", () => {
  it("filters to MANAGER and ASSISTANT_MANAGER only", async () => {
    mocks.timeOffFindMany.mockResolvedValue([]);
    mocks.employeeFindMany.mockResolvedValue([]);

    await getAvailableManagementEmployeesForDate(MON);

    expect(mocks.employeeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          management_tier: { in: ["MANAGER", "ASSISTANT_MANAGER"] },
        }),
      })
    );
  });

  it("excludes employees with approved time-off", async () => {
    mocks.timeOffFindMany.mockResolvedValue([{ employee_id: "emp-mgr" }]);
    mocks.employeeFindMany.mockResolvedValue([]);

    await getAvailableManagementEmployeesForDate(MON);

    expect(mocks.employeeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { notIn: ["emp-mgr"] },
        }),
      })
    );
  });
});
