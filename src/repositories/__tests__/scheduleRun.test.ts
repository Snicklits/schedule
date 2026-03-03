/**
 * ScheduleRun repository tests — Prisma client is mocked.
 * Focuses on saveScheduleGeneration transaction behaviour.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ScheduleResult } from "../../scheduler/types.js";
import { AssignmentStatus } from "../../constraintEngine/types.js";

// ── Mock Prisma singleton ─────────────────────────────────────────────────────
// vi.mock is hoisted; use vi.hoisted() so mock vars are ready before hoisting.
const mocks = vi.hoisted(() => ({
  scheduleRunCreate: vi.fn(),
  scheduleRunFindMany: vi.fn(),
  scheduleRunFindFirst: vi.fn(),
  assignmentCreate: vi.fn(),
  violationCreate: vi.fn(),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      scheduleRun: { create: mocks.scheduleRunCreate },
      assignment: { create: mocks.assignmentCreate },
      constraintViolation: { create: mocks.violationCreate },
    };
    return fn(tx);
  }),
}));

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    $transaction: mocks.transaction,
    scheduleRun: {
      create: mocks.scheduleRunCreate,
      findMany: mocks.scheduleRunFindMany,
      findFirst: mocks.scheduleRunFindFirst,
    },
  },
}));

import {
  saveScheduleGeneration,
  getScheduleRunsByWeek,
  getLatestRunForWeek,
} from "../scheduleRun.js";

const WEEK_START = new Date("2026-03-02T00:00:00.000Z");

const baseConfig = {
  max_consecutive_days: 5,
  max_weekly_hours: 40,
  overtime_threshold: 40,
  min_rest_hours_between_shifts: 10,
  schedule_period_days: 7,
  max_team_off_percentage: 0.33,
};

function makeSuccessResult(): ScheduleResult {
  return {
    schedule: [
      {
        employee_id: "emp-1",
        shift_id: "shift-1",
        shift_date: WEEK_START,
        shift_start_time: new Date("2026-03-02T09:00:00.000Z"),
        shift_end_time: new Date("2026-03-02T17:00:00.000Z"),
        assigned_hours: 8,
        status: AssignmentStatus.SCHEDULED,
      },
    ],
    errors: [],
    warnings: [
      {
        type: "StaffingGap",
        shiftId: "shift-2",
        message: "Shift below minimum staff count",
      },
    ],
    isPublishable: true,
    runLog: {
      timestamp: new Date("2026-03-03T10:00:00.000Z"),
      weekStart: WEEK_START,
      configSnapshot: baseConfig,
      outcome: "SUCCESS",
      errors: [],
      warnings: [],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("saveScheduleGeneration", () => {
  it("creates a ScheduleRun row with SUCCESS status", async () => {
    mocks.scheduleRunCreate.mockResolvedValue({ id: "run-1" });
    mocks.assignmentCreate.mockResolvedValue({});
    mocks.violationCreate.mockResolvedValue({});

    const runId = await saveScheduleGeneration(WEEK_START, makeSuccessResult());

    expect(runId).toBe("run-1");
    expect(mocks.scheduleRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUCCESS" }),
      })
    );
  });

  it("creates one Assignment row per schedule entry", async () => {
    mocks.scheduleRunCreate.mockResolvedValue({ id: "run-1" });
    mocks.assignmentCreate.mockResolvedValue({});
    mocks.violationCreate.mockResolvedValue({});

    await saveScheduleGeneration(WEEK_START, makeSuccessResult());

    expect(mocks.assignmentCreate).toHaveBeenCalledOnce();
    expect(mocks.assignmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          employee_id: "emp-1",
          shift_id: "shift-1",
          assigned_hours: 8,
          status: "SCHEDULED",
        }),
      })
    );
  });

  it("creates ConstraintViolation rows for warnings", async () => {
    mocks.scheduleRunCreate.mockResolvedValue({ id: "run-1" });
    mocks.assignmentCreate.mockResolvedValue({});
    mocks.violationCreate.mockResolvedValue({});

    await saveScheduleGeneration(WEEK_START, makeSuccessResult());

    expect(mocks.violationCreate).toHaveBeenCalledOnce();
    expect(mocks.violationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          severity: "WARNING",
          rule: "StaffingGap",
          shift_id: "shift-2",
          message: "Shift below minimum staff count",
        }),
      })
    );
  });

  it("uses HALTED status when outcome is HALTED", async () => {
    mocks.scheduleRunCreate.mockResolvedValue({ id: "run-2" });
    mocks.assignmentCreate.mockResolvedValue({});
    mocks.violationCreate.mockResolvedValue({});

    const haltedResult: ScheduleResult = {
      schedule: [],
      errors: [
        {
          type: "ManagementCoverageError",
          shiftId: "shift-mon",
          date: WEEK_START,
          is_peak_shift: true,
          reason: "No manager available",
        },
      ],
      warnings: [],
      isPublishable: false,
      runLog: {
        timestamp: new Date(),
        weekStart: WEEK_START,
        configSnapshot: baseConfig,
        outcome: "HALTED",
        errors: [],
        warnings: [],
      },
    };

    await saveScheduleGeneration(WEEK_START, haltedResult);

    expect(mocks.scheduleRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "HALTED" }),
      })
    );

    // Blocking error → BLOCKING severity violation
    expect(mocks.violationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          severity: "BLOCKING",
          rule: "ManagementCoverageError",
        }),
      })
    );
  });

  it("wraps everything in a single $transaction call", async () => {
    mocks.scheduleRunCreate.mockResolvedValue({ id: "run-1" });
    mocks.assignmentCreate.mockResolvedValue({});
    mocks.violationCreate.mockResolvedValue({});

    await saveScheduleGeneration(WEEK_START, makeSuccessResult());

    expect(mocks.transaction).toHaveBeenCalledOnce();
  });
});

describe("getScheduleRunsByWeek", () => {
  it("queries with correct date range and descending order", async () => {
    mocks.scheduleRunFindMany.mockResolvedValue([]);
    await getScheduleRunsByWeek(WEEK_START);
    expect(mocks.scheduleRunFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          week_start: {
            gte: WEEK_START,
            lte: expect.any(Date),
          },
        },
        orderBy: { generated_at: "desc" },
      })
    );
  });
});

describe("getLatestRunForWeek", () => {
  it("returns null when no runs found", async () => {
    mocks.scheduleRunFindFirst.mockResolvedValue(null);
    const result = await getLatestRunForWeek(WEEK_START);
    expect(result).toBeNull();
  });

  it("returns the run record when found", async () => {
    const record = { id: "run-1", week_start: WEEK_START };
    mocks.scheduleRunFindFirst.mockResolvedValue(record);
    const result = await getLatestRunForWeek(WEEK_START);
    expect(result).toEqual(record);
  });
});
