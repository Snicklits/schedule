/**
 * Employee Portal Routes — Phase 7
 *
 * All endpoints are scoped to req.auth.sub (the authenticated employee's ID).
 * Employees can only read their own data; they cannot access other employees'
 * schedules, hours, or time-off records.
 *
 * GET  /api/portal/schedule    — personal assignments for the given week
 * GET  /api/portal/time-off    — personal time-off requests
 * POST /api/portal/time-off    — submit a new time-off request
 * GET  /api/portal/hours       — personal hours summary for the given week
 */

import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../api/errors.js";
import { parseBody, parseQuery } from "../api/validate.js";
import {
  getAssignmentsForWeekWithDetails,
  getRequestsByEmployee,
  createTimeOffRequest,
  getEmployeeById,
} from "../repositories/index.js";

export const portalRouter = Router();

const weekStartQuery = z.object({
  weekStart: z.string().min(1).optional(),
});

const createTimeOffSchema = z.object({
  type: z.enum(["VACATION", "SICK", "PERSONAL", "UNPAID"]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  priority: z.number().int().min(0).optional().default(0),
});

function currentMondayDate(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
  return d;
}

function parseWeek(raw: string | undefined): Date {
  if (!raw) return currentMondayDate();
  const d = new Date(raw);
  if (isNaN(d.getTime())) throw new ApiError(400, "INVALID_DATE", "Invalid weekStart date");
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function getEmployeeId(req: import("express").Request): string {
  const id = req.auth?.sub;
  if (!id) throw new ApiError(401, "UNAUTHORIZED", "No employee identity in token");
  return id;
}

// ─── GET /api/portal/schedule ─────────────────────────────────────────────────

portalRouter.get("/schedule", async (req, res) => {
  const employeeId = getEmployeeId(req);
  const { weekStart: ws } = parseQuery(weekStartQuery, req);
  const weekStart = parseWeek(ws);

  const allAssignments = await getAssignmentsForWeekWithDetails(weekStart);
  const mine = allAssignments.filter((a) => a.employee_id === employeeId);

  res.json({ success: true, data: mine });
});

// ─── GET /api/portal/time-off ─────────────────────────────────────────────────

portalRouter.get("/time-off", async (req, res) => {
  const employeeId = getEmployeeId(req);
  const requests = await getRequestsByEmployee(employeeId);
  res.json({ success: true, data: requests });
});

// ─── POST /api/portal/time-off ────────────────────────────────────────────────

portalRouter.post("/time-off", async (req, res) => {
  const employeeId = getEmployeeId(req);
  const body = parseBody(createTimeOffSchema, req);

  const request = await createTimeOffRequest({
    employee_id: employeeId,
    type: body.type,
    start_date: new Date(body.startDate),
    end_date: new Date(body.endDate),
    priority: body.priority,
  });

  res.status(201).json({ success: true, data: request });
});

// ─── GET /api/portal/hours ────────────────────────────────────────────────────

portalRouter.get("/hours", async (req, res) => {
  const employeeId = getEmployeeId(req);
  const { weekStart: ws } = parseQuery(weekStartQuery, req);
  const weekStart = parseWeek(ws);

  const allAssignments = await getAssignmentsForWeekWithDetails(weekStart);
  const mine = allAssignments.filter((a) => a.employee_id === employeeId);
  const weeklyHours = mine.reduce((sum, a) => sum + a.assigned_hours, 0);
  const isAtCap = weeklyHours >= 40;

  // Also fetch employee profile for context
  const employee = await getEmployeeById(employeeId).catch(() => null);

  res.json({
    success: true,
    data: {
      employeeId,
      name: employee?.name ?? "Unknown",
      weeklyHours,
      isAtCap,
      targetHours: employee?.weekly_hours_target ?? 40,
      assignments: mine,
    },
  });
});
