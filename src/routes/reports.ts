/**
 * Reports Routes — Phase 5
 *
 * GET /api/reports/hours?weekStart=              — weekly hours per employee
 * GET /api/reports/violations?type=&weekStart=   — constraint violations
 * GET /api/reports/management-gaps?weekStart=    — all shifts with missing management coverage
 */

import { Router } from "express";
import {
  getWeeklyHoursSummary,
  getAllViolations,
  getAllManagementGaps,
} from "../repositories/index.js";
import { parseQuery, parseWeekStart } from "../api/validate.js";
import {
  weekStartQuerySchema,
  violationsQuerySchema,
  managementGapsQuerySchema,
} from "../api/schemas.js";

export const reportsRouter = Router();

// ─── GET /api/reports/hours ───────────────────────────────────────────────────

reportsRouter.get("/hours", async (req, res) => {
  const { weekStart: weekStartStr } = parseQuery(weekStartQuerySchema, req);
  const weekStart = parseWeekStart(weekStartStr);
  const summary = await getWeeklyHoursSummary(weekStart);
  res.json({ success: true, data: summary });
});

// ─── GET /api/reports/violations ─────────────────────────────────────────────

reportsRouter.get("/violations", async (req, res) => {
  const { type, weekStart: weekStartStr } = parseQuery(violationsQuerySchema, req);
  const weekStart = weekStartStr ? parseWeekStart(weekStartStr, "weekStart") : undefined;
  const violations = await getAllViolations({
    severity: type as "BLOCKING" | "WARNING" | undefined,
    weekStart,
  });
  res.json({ success: true, data: violations });
});

// ─── GET /api/reports/management-gaps ────────────────────────────────────────

reportsRouter.get("/management-gaps", async (req, res) => {
  const { weekStart: weekStartStr } = parseQuery(managementGapsQuerySchema, req);
  const weekStart = weekStartStr ? parseWeekStart(weekStartStr, "weekStart") : undefined;
  const gaps = await getAllManagementGaps(weekStart);
  res.json({ success: true, data: gaps });
});
