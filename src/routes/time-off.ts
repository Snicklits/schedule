/**
 * Time-Off Routes — Phase 5
 *
 * GET    /api/time-off?employeeId=  — list requests for an employee
 * POST   /api/time-off              — create a new request
 * PUT    /api/time-off/:id/approve  — approve or deny (safety check for APPROVED)
 * DELETE /api/time-off/:id          — delete a request
 */

import { Router } from "express";
import type { TimeOffRequest } from "../constraintEngine/types.js";
import { managementTimeOffIsSafe } from "../constraintEngine/index.js";
import {
  getRequestsByEmployee,
  getAllTimeOffRequests,
  createTimeOffRequest,
  getTimeOffById,
  deleteTimeOffRequest,
  updateRequestStatus,
  getShiftsByWeek,
  getAssignmentsForWeek,
  getAllActiveEmployees,
  toEmployee,
  toTimeOffRequest,
} from "../repositories/index.js";
import { ApiError } from "../api/errors.js";
import { parseBody, parseQuery } from "../api/validate.js";
import {
  createTimeOffSchema,
  approveTimeOffSchema,
  timeOffQuerySchema,
} from "../api/schemas.js";
import {
  notifyTimeOffDecision,
} from "../services/notifications.js";

export const timeOffRouter = Router();

/** Returns the Monday of the week containing the given date (UTC). */
function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay(); // 0 = Sun
  const diff = (dow + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

// ─── GET /api/time-off/all ────────────────────────────────────────────────────

timeOffRouter.get("/all", async (_req, res) => {
  const requests = await getAllTimeOffRequests();
  res.json({ success: true, data: requests });
});

// ─── GET /api/time-off ────────────────────────────────────────────────────────

timeOffRouter.get("/", async (req, res) => {
  const { employeeId } = parseQuery(timeOffQuerySchema, req);
  const requests = await getRequestsByEmployee(employeeId);
  res.json({ success: true, data: requests });
});

// ─── POST /api/time-off ───────────────────────────────────────────────────────

timeOffRouter.post("/", async (req, res) => {
  const body = parseBody(createTimeOffSchema, req);
  const request = await createTimeOffRequest({
    employee_id: body.employeeId,
    type: body.type,
    start_date: new Date(body.startDate),
    end_date: new Date(body.endDate),
    priority: body.priority,
  });
  res.status(201).json({ success: true, data: request });
});

// ─── PUT /api/time-off/:id/approve ────────────────────────────────────────────

timeOffRouter.put("/:id/approve", async (req, res) => {
  const { status } = parseBody(approveTimeOffSchema, req);
  const { id } = req.params;

  const rawRequest = await getTimeOffById(id);
  if (!rawRequest) throw new ApiError(404, "NOT_FOUND", "Time-off request not found");

  // DENIED never requires a coverage check
  if (status === "DENIED") {
    const updated = await updateRequestStatus(id, "DENIED");
    // Fire-and-forget notification
    void notifyTimeOffDecision(
      { name: rawRequest.employee.name, email: rawRequest.employee.email },
      "DENIED",
      rawRequest.start_date.toISOString().slice(0, 10),
      rawRequest.end_date.toISOString().slice(0, 10)
    );
    return res.json({ success: true, data: updated });
  }

  // APPROVED: run management coverage safety check for non-STAFF employees
  const employee = toEmployee(rawRequest.employee);

  if (employee.management_tier !== "STAFF") {
    const weekStart = getWeekStartDate(rawRequest.start_date);
    const [shifts, assignments, allEmployees] = await Promise.all([
      getShiftsByWeek(weekStart),
      getAssignmentsForWeek(weekStart),
      getAllActiveEmployees(),
    ]);

    const simulatedTimeOff: TimeOffRequest = {
      ...toTimeOffRequest(rawRequest),
      status: "APPROVED",
    };

    const safetyCheck = managementTimeOffIsSafe(
      employee,
      simulatedTimeOff,
      { shifts, assignments },
      allEmployees
    );

    if (!safetyCheck.valid) {
      throw new ApiError(
        409,
        "MANAGEMENT_COVERAGE_UNSAFE",
        "Approving this time-off would break management coverage",
        { reasons: safetyCheck.reasons }
      );
    }
  }

  const updated = await updateRequestStatus(id, "APPROVED");
  // Fire-and-forget notification
  void notifyTimeOffDecision(
    { name: rawRequest.employee.name, email: rawRequest.employee.email },
    "APPROVED",
    rawRequest.start_date.toISOString().slice(0, 10),
    rawRequest.end_date.toISOString().slice(0, 10)
  );
  res.json({ success: true, data: updated });
});

// ─── DELETE /api/time-off/:id ─────────────────────────────────────────────────

timeOffRouter.delete("/:id", async (req, res) => {
  const existing = await getTimeOffById(req.params["id"]);
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Time-off request not found");
  await deleteTimeOffRequest(req.params["id"]);
  res.status(204).end();
});
