/**
 * ConstraintViolation Repository
 *
 * Compliance-critical: violations are append-only — no deletions.
 * Overrides are recorded in-place via `logManagementOverride`.
 */

import { prisma } from "../lib/prisma.js";

export interface ViolationRecord {
  id: string;
  schedule_run_id: string;
  shift_id: string | null;
  employee_id: string | null;
  rule: string;
  severity: "BLOCKING" | "WARNING";
  message: string;
  overridden_by: string | null;
  override_reason: string | null;
  override_at: Date | null;
}

/** Logs a single constraint violation attached to a schedule run. */
export async function logViolation(data: {
  schedule_run_id: string;
  shift_id?: string;
  employee_id?: string;
  rule: string;
  severity: "BLOCKING" | "WARNING";
  message: string;
}): Promise<ViolationRecord> {
  return prisma.constraintViolation.create({
    data: {
      schedule_run_id: data.schedule_run_id,
      shift_id: data.shift_id ?? null,
      employee_id: data.employee_id ?? null,
      rule: data.rule,
      severity: data.severity,
      message: data.message,
    },
  }) as Promise<ViolationRecord>;
}

/** Returns all violations for a given ScheduleRun. */
export async function getViolationsForRun(
  scheduleRunId: string
): Promise<ViolationRecord[]> {
  return prisma.constraintViolation.findMany({
    where: { schedule_run_id: scheduleRunId },
    orderBy: [{ severity: "asc" }, { id: "asc" }],
  }) as Promise<ViolationRecord[]>;
}

/**
 * Records that a manager has manually overridden a constraint violation.
 * Fields are set in-place on the existing violation record (no new row).
 */
export async function logManagementOverride(
  violationId: string,
  override: {
    overridden_by: string;
    override_reason: string;
    override_at?: Date;
  }
): Promise<ViolationRecord> {
  return prisma.constraintViolation.update({
    where: { id: violationId },
    data: {
      overridden_by: override.overridden_by,
      override_reason: override.override_reason,
      override_at: override.override_at ?? new Date(),
    },
  }) as Promise<ViolationRecord>;
}
