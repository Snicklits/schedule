/**
 * Shift Swap Routes — Phase 7
 *
 * POST /api/shifts/swap            — employee submits a swap request
 * GET  /api/shifts/swap/:employeeId — list all swaps involving an employee
 * PUT  /api/shifts/swap/:id/approve — manager approves or denies
 *
 * Management coverage: if either employee is MANAGER or ASSISTANT_MANAGER,
 * a coverage simulation runs before approving — same logic as time-off safety.
 */

import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../api/errors.js";
import { parseBody } from "../api/validate.js";
import {
  createSwapRequest,
  getSwapRequestsByEmployee,
  getSwapRequestById,
  updateSwapStatus,
  getShiftAssignmentsWithEmployees,
} from "../repositories/swap.js";
import { getAssignmentWithDetails, reassignAssignment } from "../repositories/index.js";
import {
  notifySwapRequested,
  notifySwapDecision,
} from "../services/notifications.js";

export const swapRouter = Router();

const createSwapSchema = z.object({
  assignmentId: z.string().min(1),
  targetEmployeeId: z.string().min(1),
});

const approveSwapSchema = z.object({
  status: z.enum(["APPROVED", "DENIED"]),
  managerNote: z.string().optional(),
});

// ─── POST /api/shifts/swap ────────────────────────────────────────────────────

swapRouter.post("/", async (req, res) => {
  const { assignmentId, targetEmployeeId } = parseBody(createSwapSchema, req);

  const assignment = await getAssignmentWithDetails(assignmentId);
  if (!assignment) throw new ApiError(404, "NOT_FOUND", "Assignment not found");

  if (assignment.employee_id === targetEmployeeId) {
    throw new ApiError(400, "INVALID_SWAP", "Cannot swap with yourself");
  }

  const swap = await createSwapRequest({
    requester_id: assignment.employee_id,
    target_employee_id: targetEmployeeId,
    assignment_id: assignmentId,
  });

  // Fire-and-forget notification — failure must not block response
  void notifySwapRequested(
    { name: swap.target_employee.name, email: swap.target_employee.email },
    swap.requester.name,
    assignment.shift.date.toISOString().slice(0, 10)
  );

  res.status(201).json({ success: true, data: swap });
});

// ─── GET /api/shifts/swap/:employeeId ────────────────────────────────────────

swapRouter.get("/:employeeId", async (req, res) => {
  const swaps = await getSwapRequestsByEmployee(req.params["employeeId"]!);
  res.json({ success: true, data: swaps });
});

// ─── PUT /api/shifts/swap/:id/approve ────────────────────────────────────────

swapRouter.put("/:id/approve", async (req, res) => {
  const { status, managerNote } = parseBody(approveSwapSchema, req);
  const reviewedBy = req.auth?.sub ?? "admin";

  const swap = await getSwapRequestById(req.params["id"]!);
  if (!swap) throw new ApiError(404, "NOT_FOUND", "Swap request not found");
  if (swap.status !== "PENDING") {
    throw new ApiError(409, "ALREADY_RESOLVED", "This swap request has already been resolved");
  }

  if (status === "APPROVED") {
    // ── Management coverage check ───────────────────────────────────────────
    const requesterTier = swap.requester.management_tier;
    const targetTier    = swap.target_employee.management_tier;

    if (requesterTier !== "STAFF" || targetTier !== "STAFF") {
      const shiftId = swap.assignment.shift_id;
      const shiftAssignments = await getShiftAssignmentsWithEmployees(shiftId);

      // Simulate: requester leaves, target employee joins
      const tiersAfterSwap = shiftAssignments
        .filter((a) => a.employee_id !== swap.requester_id)
        .map((a) => a.employee.management_tier as string);

      // Target takes requester's place
      tiersAfterSwap.push(swap.target_employee.management_tier);

      const shift = swap.assignment.shift;
      if (shift.requires_management_presence) {
        const hasMgmt = tiersAfterSwap.some(
          (t) => t === "MANAGER" || t === "ASSISTANT_MANAGER"
        );
        if (!hasMgmt) {
          throw new ApiError(
            409,
            "MANAGEMENT_COVERAGE_UNSAFE",
            "Approving this swap would remove management coverage from the shift",
            { shiftId, date: shift.date.toISOString().slice(0, 10) }
          );
        }
      }
    }

    // ── Execute the swap: reassign the assignment to the target employee ────
    await reassignAssignment(swap.assignment_id, swap.target_employee_id);
  }

  const updated = await updateSwapStatus(
    swap.id,
    status,
    reviewedBy,
    managerNote
  );

  // Fire-and-forget notification
  void notifySwapDecision(
    { name: swap.requester.name, email: swap.requester.email },
    status,
    swap.assignment.shift.date.toISOString().slice(0, 10),
    managerNote
  );

  res.json({ success: true, data: updated });
});
