/**
 * Key Queries
 *
 * Six complex analytical queries that combine multiple tables.  These are
 * separated from the CRUD repositories because they serve the scheduling
 * algorithm and dashboard — not routine data access.
 */

import type { Employee, Shift } from "../constraintEngine/types.js";
import { prisma } from "../lib/prisma.js";
import { toEmployee, toShift } from "./mappers.js";

// ─── 1. Available employees for a date ──────────────────────────────────────

/**
 * Returns all ACTIVE employees who have no APPROVED time-off covering `date`.
 * Results are sorted by hierarchy_rank ASC (highest in org first).
 */
export async function getAvailableEmployeesForDate(
  date: Date
): Promise<Employee[]> {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setUTCHours(23, 59, 59, 999);

  // Employees who have an APPROVED request overlapping this date.
  const unavailable = await prisma.timeOffRequest.findMany({
    where: {
      status: "APPROVED",
      start_date: { lte: dayEnd },
      end_date: { gte: dayStart },
    },
    select: { employee_id: true },
  });

  const unavailableIds = unavailable.map((r) => r.employee_id);

  const rows = await prisma.employee.findMany({
    where: {
      status: "ACTIVE",
      ...(unavailableIds.length > 0 && {
        id: { notIn: unavailableIds },
      }),
    },
    orderBy: { hierarchy_rank: "asc" },
  });

  return rows.map(toEmployee);
}

// ─── 2. Total weekly hours for an employee ───────────────────────────────────

/**
 * Returns the sum of assigned_hours for non-CANCELLED assignments in the
 * 7-day window starting at `weekStart`.
 */
export async function getTotalWeeklyHoursForEmployee(
  employeeId: string,
  weekStart: Date
): Promise<number> {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  const result = await prisma.assignment.aggregate({
    where: {
      employee_id: employeeId,
      status: { not: "CANCELLED" },
      shift: {
        date: { gte: weekStart, lte: weekEnd },
      },
    },
    _sum: { assigned_hours: true },
  });

  return result._sum.assigned_hours ?? 0;
}

// ─── 3. Consecutive working days ────────────────────────────────────────────

/**
 * Returns the number of consecutive days immediately before `date` on which
 * the employee has at least one non-CANCELLED assignment.
 *
 * Matches the semantics of `getConsecutiveDays` in the constraint engine
 * (streak excludes `date` itself).
 */
export async function getConsecutiveWorkingDays(
  employeeId: string,
  date: Date
): Promise<number> {
  // Fetch all distinct worked days for this employee in a reasonable window
  // (up to 30 days back to avoid unbounded scans).
  const lookback = new Date(date);
  lookback.setUTCDate(lookback.getUTCDate() - 30);

  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.assignment.findMany({
    where: {
      employee_id: employeeId,
      status: { not: "CANCELLED" },
      shift: {
        date: { gte: lookback, lt: dayStart },
      },
    },
    select: { shift: { select: { date: true } } },
    include: undefined,
  });

  const workedMs = new Set(
    rows.map((r) => {
      const d = new Date(r.shift.date);
      d.setUTCHours(0, 0, 0, 0);
      return d.getTime();
    })
  );

  let count = 0;
  const check = new Date(date);
  check.setUTCHours(0, 0, 0, 0);
  check.setUTCDate(check.getUTCDate() - 1);

  while (workedMs.has(check.getTime())) {
    count++;
    check.setUTCDate(check.getUTCDate() - 1);
  }

  return count;
}

// ─── 4. Shifts lacking management coverage ───────────────────────────────────

/**
 * Returns all management-required shifts in the week that have zero
 * non-CANCELLED assignments from MANAGER or ASSISTANT_MANAGER employees.
 */
export async function getShiftsLackingManagementCoverage(
  weekStart: Date
): Promise<Shift[]> {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  // Shifts that require management presence.
  const managedShifts = await prisma.shift.findMany({
    where: {
      date: { gte: weekStart, lte: weekEnd },
      requires_management_presence: true,
    },
    include: {
      assignments: {
        where: { status: { not: "CANCELLED" } },
        include: { employee: { select: { management_tier: true } } },
      },
    },
    orderBy: [{ date: "asc" }, { start_time: "asc" }],
  });

  const lacking = managedShifts.filter((shift) => {
    return !shift.assignments.some(
      (a) =>
        a.employee.management_tier === "MANAGER" ||
        a.employee.management_tier === "ASSISTANT_MANAGER"
    );
  });

  return lacking.map(toShift);
}

// ─── 5. Peak shifts with manager check ───────────────────────────────────────

/**
 * Returns all peak shifts in the week, annotated with whether a MANAGER
 * (not just any management) is assigned.
 */
export async function getPeakShiftsWithManagerCheck(
  weekStart: Date
): Promise<Array<{ shift: Shift; hasManager: boolean }>> {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  const peakShifts = await prisma.shift.findMany({
    where: {
      date: { gte: weekStart, lte: weekEnd },
      is_peak_shift: true,
    },
    include: {
      assignments: {
        where: { status: { not: "CANCELLED" } },
        include: { employee: { select: { management_tier: true } } },
      },
    },
    orderBy: [{ date: "asc" }, { start_time: "asc" }],
  });

  return peakShifts.map((shift) => ({
    shift: toShift(shift),
    hasManager: shift.assignments.some(
      (a) => a.employee.management_tier === "MANAGER"
    ),
  }));
}

// ─── 6. Available management employees for a date ────────────────────────────

/**
 * Returns all ACTIVE MANAGER and ASSISTANT_MANAGER employees who have no
 * APPROVED time-off on `date`.
 */
export async function getAvailableManagementEmployeesForDate(
  date: Date
): Promise<Employee[]> {
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const unavailable = await prisma.timeOffRequest.findMany({
    where: {
      status: "APPROVED",
      start_date: { lte: dayEnd },
      end_date: { gte: dayStart },
    },
    select: { employee_id: true },
  });

  const unavailableIds = unavailable.map((r) => r.employee_id);

  const rows = await prisma.employee.findMany({
    where: {
      status: "ACTIVE",
      management_tier: { in: ["MANAGER", "ASSISTANT_MANAGER"] },
      ...(unavailableIds.length > 0 && {
        id: { notIn: unavailableIds },
      }),
    },
    orderBy: { hierarchy_rank: "asc" },
  });

  return rows.map(toEmployee);
}
