/**
 * Shift Routes — Phase 5
 *
 * GET    /api/shifts?weekStart=      — list shifts (optional week filter)
 * GET    /api/shifts/:id             — get single shift
 * POST   /api/shifts                 — create shift
 * PUT    /api/shifts/:id             — update shift
 * PUT    /api/shifts/:id/mark-peak   — toggle peak flag on a shift
 * DELETE /api/shifts/:id             — delete shift
 */

import { Router } from "express";
import {
  getAllShifts,
  getShiftsByWeek,
  getShiftById,
  createShift,
  updateShift,
  deleteShift,
  markShiftAsPeak,
} from "../repositories/index.js";
import { ApiError } from "../api/errors.js";
import { parseBody, parseQuery, parseWeekStart } from "../api/validate.js";
import {
  createShiftSchema,
  updateShiftSchema,
  shiftsQuerySchema,
  markPeakSchema,
} from "../api/schemas.js";

export const shiftRouter = Router();

// ─── GET /api/shifts ──────────────────────────────────────────────────────────

shiftRouter.get("/", async (req, res) => {
  const { weekStart: weekStartStr } = parseQuery(shiftsQuerySchema, req);
  const shifts = weekStartStr
    ? await getShiftsByWeek(parseWeekStart(weekStartStr))
    : await getAllShifts();
  res.json({ success: true, data: shifts });
});

// ─── GET /api/shifts/:id ──────────────────────────────────────────────────────

shiftRouter.get("/:id", async (req, res) => {
  const shift = await getShiftById(req.params["id"]);
  if (!shift) throw new ApiError(404, "NOT_FOUND", "Shift not found");
  res.json({ success: true, data: shift });
});

// ─── POST /api/shifts ─────────────────────────────────────────────────────────

shiftRouter.post("/", async (req, res) => {
  const body = parseBody(createShiftSchema, req);
  const shift = await createShift({
    date: new Date(body.date),
    start_time: new Date(body.start_time),
    end_time: new Date(body.end_time),
    duration_hours: body.duration_hours,
    required_specialty: body.required_specialty ?? null,
    min_staff_count: body.min_staff_count,
    is_peak_shift: body.is_peak_shift,
    requires_management_presence: body.requires_management_presence,
    location: body.location,
  });
  res.status(201).json({ success: true, data: shift });
});

// ─── PUT /api/shifts/:id ──────────────────────────────────────────────────────

shiftRouter.put("/:id", async (req, res) => {
  const body = parseBody(updateShiftSchema, req);
  const updates = {
    ...(body.date && { date: new Date(body.date) }),
    ...(body.start_time && { start_time: new Date(body.start_time) }),
    ...(body.end_time && { end_time: new Date(body.end_time) }),
    ...(body.duration_hours !== undefined && { duration_hours: body.duration_hours }),
    ...(body.required_specialty !== undefined && { required_specialty: body.required_specialty }),
    ...(body.min_staff_count !== undefined && { min_staff_count: body.min_staff_count }),
    ...(body.is_peak_shift !== undefined && { is_peak_shift: body.is_peak_shift }),
    ...(body.requires_management_presence !== undefined && {
      requires_management_presence: body.requires_management_presence,
    }),
    ...(body.location !== undefined && { location: body.location }),
  };
  const shift = await updateShift(req.params["id"], updates);
  res.json({ success: true, data: shift });
});

// ─── PUT /api/shifts/:id/mark-peak ───────────────────────────────────────────

shiftRouter.put("/:id/mark-peak", async (req, res) => {
  const { isPeak } = parseBody(markPeakSchema, req);
  const existing = await getShiftById(req.params["id"]);
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Shift not found");
  const shift = await markShiftAsPeak(req.params["id"], isPeak);
  res.json({ success: true, data: shift });
});

// ─── DELETE /api/shifts/:id ───────────────────────────────────────────────────

shiftRouter.delete("/:id", async (req, res) => {
  const existing = await getShiftById(req.params["id"]);
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Shift not found");
  await deleteShift(req.params["id"]);
  res.status(204).end();
});
