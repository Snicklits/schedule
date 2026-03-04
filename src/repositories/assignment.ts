/**
 * Assignment Repository
 *
 * All database access for the Assignment model.  Every query that returns
 * engine-layer Assignment objects includes the parent Shift so the denormalised
 * timing fields (shift_date, shift_start_time, shift_end_time) can be populated.
 */

import type { Assignment } from "../constraintEngine/types.js";
import { AssignmentStatus } from "../constraintEngine/types.js";
import { prisma } from "../lib/prisma.js";
import { toAssignment } from "./mappers.js";

const WITH_SHIFT = { shift: true } as const;

/** Returns all assignments for shifts occurring in the given week. */
export async function getAssignmentsForWeek(weekStart: Date): Promise<Assignment[]> {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  const rows = await prisma.assignment.findMany({
    where: {
      shift: {
        date: { gte: weekStart, lte: weekEnd },
      },
    },
    include: WITH_SHIFT,
    orderBy: [{ shift: { date: "asc" } }, { shift: { start_time: "asc" } }],
  });
  return rows.map(toAssignment);
}

/** Returns all assignments for a given employee. */
export async function getAssignmentsForEmployee(
  employeeId: string
): Promise<Assignment[]> {
  const rows = await prisma.assignment.findMany({
    where: { employee_id: employeeId },
    include: WITH_SHIFT,
    orderBy: [{ shift: { date: "asc" } }],
  });
  return rows.map(toAssignment);
}

/** Returns all assignments for a given shift. */
export async function getAssignmentsForShift(
  shiftId: string
): Promise<Assignment[]> {
  const rows = await prisma.assignment.findMany({
    where: { shift_id: shiftId },
    include: WITH_SHIFT,
  });
  return rows.map(toAssignment);
}

/** Creates a new assignment and returns the engine-layer representation. */
export async function createAssignment(data: {
  employee_id: string;
  shift_id: string;
  assigned_hours: number;
  status?: (typeof AssignmentStatus)[keyof typeof AssignmentStatus];
}): Promise<Assignment> {
  const row = await prisma.assignment.create({
    data: {
      employee_id: data.employee_id,
      shift_id: data.shift_id,
      assigned_hours: data.assigned_hours,
      status: data.status ?? AssignmentStatus.SCHEDULED,
    },
    include: WITH_SHIFT,
  });
  return toAssignment(row);
}

/** Updates the status of an existing assignment. */
export async function updateAssignmentStatus(
  id: string,
  status: (typeof AssignmentStatus)[keyof typeof AssignmentStatus]
): Promise<Assignment> {
  const row = await prisma.assignment.update({
    where: { id },
    data: { status },
    include: WITH_SHIFT,
  });
  return toAssignment(row);
}

/** Deletes an assignment by DB id.  Prefer CANCELLED status over deletion for audit trails. */
export async function deleteAssignment(id: string): Promise<void> {
  await prisma.assignment.delete({ where: { id } });
}

// ─── Phase 5 additions ───────────────────────────────────────────────────────

/**
 * Returns a raw Prisma assignment row (with employee and shift included)
 * for the manual override endpoint.  Returns null if not found.
 */
export async function getAssignmentWithDetails(id: string) {
  return prisma.assignment.findUnique({
    where: { id },
    include: { employee: true, shift: true },
  });
}

/**
 * Re-assigns an existing assignment to a different employee.
 * Returns the full Prisma row (employee + shift) for the API response.
 */
export async function reassignAssignment(id: string, newEmployeeId: string) {
  return prisma.assignment.update({
    where: { id },
    data: { employee_id: newEmployeeId },
    include: { employee: true, shift: true },
  });
}

/**
 * Returns all assignments for a week with full Prisma employee + shift records.
 * Used by GET /api/schedule/:weekStart to build the display payload.
 */
export async function getAssignmentsForWeekWithDetails(weekStart: Date) {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  return prisma.assignment.findMany({
    where: { shift: { date: { gte: weekStart, lte: weekEnd } } },
    include: { employee: true, shift: true },
    orderBy: [{ shift: { date: "asc" } }, { shift: { start_time: "asc" } }],
  });
}
