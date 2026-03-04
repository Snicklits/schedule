/**
 * Coverage Routes — Phase 5
 *
 * GET /api/coverage/gaps?weekStart=      — shifts lacking management coverage
 * GET /api/coverage/peak?weekStart=      — peak shifts without a MANAGER
 * GET /api/coverage/check/:weekStart     — combined coverage report for a week
 */

import { Router } from "express";
import {
  getShiftsLackingManagementCoverage,
  getPeakShiftsWithManagerCheck,
} from "../repositories/index.js";
import { parseQuery, parseWeekStart } from "../api/validate.js";
import { weekStartQuerySchema } from "../api/schemas.js";

export const coverageRouter = Router();

// ─── GET /api/coverage/gaps ───────────────────────────────────────────────────

coverageRouter.get("/gaps", async (req, res) => {
  const { weekStart: weekStartStr } = parseQuery(weekStartQuerySchema, req);
  const weekStart = parseWeekStart(weekStartStr);
  const gaps = await getShiftsLackingManagementCoverage(weekStart);
  res.json({ success: true, data: gaps });
});

// ─── GET /api/coverage/peak ───────────────────────────────────────────────────

coverageRouter.get("/peak", async (req, res) => {
  const { weekStart: weekStartStr } = parseQuery(weekStartQuerySchema, req);
  const weekStart = parseWeekStart(weekStartStr);
  const peakShifts = await getPeakShiftsWithManagerCheck(weekStart);
  const missing = peakShifts.filter((p) => !p.hasManager);
  res.json({ success: true, data: missing });
});

// ─── GET /api/coverage/check/:weekStart ──────────────────────────────────────

coverageRouter.get("/check/:weekStart", async (req, res) => {
  const weekStart = parseWeekStart(req.params["weekStart"]);
  const [managementGaps, peakShifts] = await Promise.all([
    getShiftsLackingManagementCoverage(weekStart),
    getPeakShiftsWithManagerCheck(weekStart),
  ]);
  const peakWithoutManager = peakShifts.filter((p) => !p.hasManager);
  res.json({
    success: true,
    data: {
      weekStart: weekStart.toISOString(),
      managementGaps,
      peakWithoutManager,
      isFullyCovered: managementGaps.length === 0 && peakWithoutManager.length === 0,
    },
  });
});
