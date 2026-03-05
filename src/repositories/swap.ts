/**
 * ShiftSwapRequest Repository — Phase 7
 */

import { prisma } from "../lib/prisma.js";

const SWAP_INCLUDE = {
  requester: true,
  target_employee: true,
  assignment: { include: { shift: true } },
} as const;

export async function createSwapRequest(data: {
  requester_id: string;
  target_employee_id: string;
  assignment_id: string;
}) {
  return prisma.shiftSwapRequest.create({
    data: {
      requester_id: data.requester_id,
      target_employee_id: data.target_employee_id,
      assignment_id: data.assignment_id,
      status: "PENDING",
    },
    include: SWAP_INCLUDE,
  });
}

export async function getSwapRequestsByEmployee(employeeId: string) {
  return prisma.shiftSwapRequest.findMany({
    where: {
      OR: [
        { requester_id: employeeId },
        { target_employee_id: employeeId },
      ],
    },
    include: SWAP_INCLUDE,
    orderBy: { created_at: "desc" },
  });
}

export async function getSwapRequestById(id: string) {
  return prisma.shiftSwapRequest.findUnique({
    where: { id },
    include: SWAP_INCLUDE,
  });
}

export async function updateSwapStatus(
  id: string,
  status: "APPROVED" | "DENIED",
  reviewedBy: string,
  managerNote?: string
) {
  return prisma.shiftSwapRequest.update({
    where: { id },
    data: {
      status,
      reviewed_at: new Date(),
      reviewed_by: reviewedBy,
      ...(managerNote !== undefined && { manager_note: managerNote }),
    },
    include: SWAP_INCLUDE,
  });
}

/** Returns raw assignment rows for a shift — used in coverage simulation. */
export async function getShiftAssignmentsWithEmployees(shiftId: string) {
  return prisma.assignment.findMany({
    where: { shift_id: shiftId },
    include: { employee: true },
  });
}
