/**
 * TimeOffRequest Repository
 *
 * All database access for the TimeOffRequest model.
 */

import type { TimeOffRequest } from "../constraintEngine/types.js";
import { TimeOffStatus } from "../constraintEngine/types.js";
import { prisma } from "../lib/prisma.js";
import { toTimeOffRequest } from "./mappers.js";

/**
 * Returns all APPROVED time-off requests that overlap the given week.
 * Overlap: request.start_date <= weekEnd AND request.end_date >= weekStart.
 */
export async function getApprovedTimeOffForWeek(
  weekStart: Date
): Promise<TimeOffRequest[]> {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  const rows = await prisma.timeOffRequest.findMany({
    where: {
      status: TimeOffStatus.APPROVED,
      start_date: { lte: weekEnd },
      end_date: { gte: weekStart },
    },
    orderBy: { start_date: "asc" },
  });
  return rows.map(toTimeOffRequest);
}

/**
 * Returns all PENDING time-off requests that overlap the given week,
 * sorted by seniority DESC (higher priority first), then created_at ASC (FCFS).
 */
export async function getPendingRequestsForWeek(
  weekStart: Date
): Promise<TimeOffRequest[]> {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  const rows = await prisma.timeOffRequest.findMany({
    where: {
      status: TimeOffStatus.PENDING,
      start_date: { lte: weekEnd },
      end_date: { gte: weekStart },
    },
    orderBy: [{ priority: "desc" }, { created_at: "asc" }],
  });
  return rows.map(toTimeOffRequest);
}

/**
 * Returns ALL time-off requests with employee data joined.
 * Used by GET /api/time-off/all (manager dashboard).
 * Sorted by employee seniority DESC, then created_at ASC.
 */
export async function getAllTimeOffRequests() {
  return prisma.timeOffRequest.findMany({
    include: { employee: true },
    orderBy: [{ employee: { seniority_level: "desc" } }, { created_at: "asc" }],
  });
}

/** Returns all time-off requests for a given employee. */
export async function getRequestsByEmployee(
  employeeId: string
): Promise<TimeOffRequest[]> {
  const rows = await prisma.timeOffRequest.findMany({
    where: { employee_id: employeeId },
    orderBy: { start_date: "asc" },
  });
  return rows.map(toTimeOffRequest);
}

/** Creates a new time-off request. */
export async function createTimeOffRequest(data: {
  employee_id: string;
  type: "VACATION" | "SICK" | "PERSONAL" | "UNPAID";
  start_date: Date;
  end_date: Date;
  priority: number;
  created_at?: Date;
}): Promise<TimeOffRequest> {
  const row = await prisma.timeOffRequest.create({
    data: {
      employee_id: data.employee_id,
      type: data.type,
      start_date: data.start_date,
      end_date: data.end_date,
      status: TimeOffStatus.PENDING,
      priority: data.priority,
      created_at: data.created_at ?? new Date(),
    },
  });
  return toTimeOffRequest(row);
}

/**
 * Returns a single time-off request with employee included, or null.
 * Used by PUT /api/time-off/:id/approve.
 */
export async function getTimeOffById(id: string) {
  return prisma.timeOffRequest.findUnique({
    where: { id },
    include: { employee: true },
  });
}

/** Deletes a time-off request by ID. Throws if not found. */
export async function deleteTimeOffRequest(id: string): Promise<void> {
  await prisma.timeOffRequest.delete({ where: { id } });
}

/** Updates the status of a time-off request (approve or deny). */
export async function updateRequestStatus(
  id: string,
  status: (typeof TimeOffStatus)[keyof typeof TimeOffStatus]
): Promise<TimeOffRequest> {
  const row = await prisma.timeOffRequest.update({
    where: { id },
    data: { status },
  });
  return toTimeOffRequest(row);
}
