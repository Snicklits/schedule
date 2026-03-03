/**
 * ScheduleRun Repository
 *
 * All database access for ScheduleRun records.
 * `saveScheduleGeneration` is the primary write path — it wraps the full
 * schedule result (assignments + violations) in a single transaction.
 */

import type { ScheduleResult } from "../scheduler/types.js";
import { prisma } from "../lib/prisma.js";

export interface ScheduleRunRecord {
  id: string;
  week_start: Date;
  generated_at: Date;
  config_snapshot: unknown;
  status: string;
  errors: unknown;
  warnings: unknown;
}

/** Creates a bare ScheduleRun row without touching assignments or violations. */
export async function createScheduleRun(data: {
  week_start: Date;
  generated_at: Date;
  config_snapshot: object;
  status: "SUCCESS" | "FAILED" | "PARTIAL" | "HALTED";
  errors?: unknown[];
  warnings?: unknown[];
}): Promise<ScheduleRunRecord> {
  return prisma.scheduleRun.create({
    data: {
      week_start: data.week_start,
      generated_at: data.generated_at,
      config_snapshot: data.config_snapshot,
      status: data.status,
      errors: (data.errors ?? []) as object[],
      warnings: (data.warnings ?? []) as object[],
    },
  });
}

/** Returns all ScheduleRun rows for the given week, newest first. */
export async function getScheduleRunsByWeek(
  weekStart: Date
): Promise<ScheduleRunRecord[]> {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  return prisma.scheduleRun.findMany({
    where: {
      week_start: { gte: weekStart, lte: weekEnd },
    },
    orderBy: { generated_at: "desc" },
  });
}

/** Returns the most recent ScheduleRun for the given week, or null. */
export async function getLatestRunForWeek(
  weekStart: Date
): Promise<ScheduleRunRecord | null> {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  return prisma.scheduleRun.findFirst({
    where: {
      week_start: { gte: weekStart, lte: weekEnd },
    },
    orderBy: { generated_at: "desc" },
  });
}

/**
 * Atomically persists a complete schedule generation result:
 *  1. Creates the ScheduleRun row (status = SUCCESS or HALTED).
 *  2. Creates one Assignment row per schedule entry.
 *  3. Creates ConstraintViolation rows for every blocking error and warning.
 *
 * Returns the new ScheduleRun ID.
 * If any step fails the entire transaction is rolled back.
 */
export async function saveScheduleGeneration(
  weekStart: Date,
  result: ScheduleResult
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    // 1. ScheduleRun
    const run = await tx.scheduleRun.create({
      data: {
        week_start: weekStart,
        generated_at: result.runLog.timestamp,
        config_snapshot: result.runLog.configSnapshot as object,
        status: result.runLog.outcome === "SUCCESS" ? "SUCCESS" : "HALTED",
        errors: result.errors as object[],
        warnings: result.warnings as object[],
      },
    });

    // 2. Assignments
    for (const a of result.schedule) {
      await tx.assignment.create({
        data: {
          employee_id: a.employee_id,
          shift_id: a.shift_id,
          assigned_hours: a.assigned_hours,
          status: a.status,
        },
      });
    }

    // 3. Blocking violations → ConstraintViolation (BLOCKING severity)
    for (const err of result.errors) {
      await tx.constraintViolation.create({
        data: {
          schedule_run_id: run.id,
          shift_id: err.shiftId,
          rule: err.type,
          severity: "BLOCKING",
          message: err.reason,
        },
      });
    }

    // 4. Non-blocking warnings → ConstraintViolation (WARNING severity)
    for (const warn of result.warnings) {
      await tx.constraintViolation.create({
        data: {
          schedule_run_id: run.id,
          shift_id: warn.shiftId ?? null,
          employee_id: warn.employeeId ?? null,
          rule: warn.type,
          severity: "WARNING",
          message: warn.message,
        },
      });
    }

    return run.id;
  });
}
