import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withHandler } from "../_lib/handler.js";
import { requireAuth } from "../_lib/auth.js";
import { parseBody, parseWeekStart } from "../_lib/validate.js";
import { generateSchedule } from "../../src/scheduler/index.js";
import {
  getActiveScheduleConfig,
  getAllActiveEmployees,
  getShiftsByWeek,
  getApprovedTimeOffForWeek,
  getPendingRequestsForWeek,
  saveScheduleGeneration,
} from "../../src/repositories/index.js";
import { ApiError } from "../../src/api/errors.js";
import { generateScheduleSchema } from "../../src/api/schemas.js";

export default withHandler(async (req: VercelRequest, res: VercelResponse) => {
  requireAuth(req);

  if (req.method !== "POST") {
    res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } });
    return;
  }

  const { weekStart: weekStartStr } = parseBody(generateScheduleSchema, req);
  const weekStart = parseWeekStart(weekStartStr);

  const [config, employees, shifts, approvedTimeOff, pendingTimeOff] = await Promise.all([
    getActiveScheduleConfig(),
    getAllActiveEmployees(),
    getShiftsByWeek(weekStart),
    getApprovedTimeOffForWeek(weekStart),
    getPendingRequestsForWeek(weekStart),
  ]);

  if (!config) {
    throw new ApiError(422, "CONFIG_NOT_FOUND", "No active schedule configuration found");
  }

  const timeOffRequests = [...approvedTimeOff, ...pendingTimeOff];
  const result = generateSchedule(weekStart, employees, shifts, timeOffRequests, config);
  const runId = await saveScheduleGeneration(weekStart, result);

  if (!result.isPublishable) {
    throw new ApiError(
      422,
      "MANAGEMENT_COVERAGE_ERROR",
      "Schedule generation halted due to management coverage errors",
      { runId, errors: result.errors, warnings: result.warnings }
    );
  }

  res.status(201).json({
    success: true,
    data: { runId, schedule: result.schedule, warnings: result.warnings },
  });
});
