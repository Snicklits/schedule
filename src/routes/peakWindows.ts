/**
 * Peak Window Routes — Phase 5
 *
 * GET    /api/peak-windows       — list all peak windows
 * POST   /api/peak-windows       — create a peak window
 * DELETE /api/peak-windows/:id   — delete a peak window
 */

import { Router } from "express";
import {
  getAllPeakWindows,
  createPeakWindow,
  deletePeakWindow,
} from "../repositories/index.js";
import { ApiError } from "../api/errors.js";
import { parseBody } from "../api/validate.js";
import { createPeakWindowSchema } from "../api/schemas.js";

export const peakWindowRouter = Router();

// ─── GET /api/peak-windows ────────────────────────────────────────────────────

peakWindowRouter.get("/", async (_req, res) => {
  const windows = await getAllPeakWindows();
  res.json({ success: true, data: windows });
});

// ─── POST /api/peak-windows ───────────────────────────────────────────────────

peakWindowRouter.post("/", async (req, res) => {
  const body = parseBody(createPeakWindowSchema, req);
  const window = await createPeakWindow({
    days: body.days,
    start_time: body.startTime,
    end_time: body.endTime,
    label: body.label,
  });
  res.status(201).json({ success: true, data: window });
});

// ─── DELETE /api/peak-windows/:id ─────────────────────────────────────────────

peakWindowRouter.delete("/:id", async (req, res) => {
  try {
    await deletePeakWindow(req.params["id"]);
    res.status(204).end();
  } catch (err: unknown) {
    // Prisma P2025 = record not found
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      throw new ApiError(404, "NOT_FOUND", "Peak window not found");
    }
    throw err;
  }
});
