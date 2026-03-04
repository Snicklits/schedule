/**
 * Schedule Routes — Phase 5
 *
 * POST /api/schedule/generate       — run the scheduler for a week
 * GET  /api/schedule/:weekStart     — retrieve assignments for a week
 * PUT  /api/schedule/assignment/:id — manual override (with audit trail)
 */

import { Router } from "express";
import type { Assignment } from "../constraintEngine/types.js";
import { AssignmentStatus } from "../constraintEngine/types.js";
import {
  shiftHasManagementCoverage,
  peakShiftHasManager,
} from "../constraintEngine/index.js";
import { generateSchedule } from "../scheduler/index.js";
import {
  getActiveScheduleConfig,
  getAllActiveEmployees,
  getShiftsByWeek,
  getApprovedTimeOffForWeek,
  getPendingRequestsForWeek,
  saveScheduleGeneration,
  getAssignmentsForWeekWithDetails,
  getAssignmentWithDetails,
  getAssignmentsForShift,
  reassignAssignment,
  logViolation,
  logManagementOverride,
  getLatestRunForWeek,
  toShift,
} from "../repositories/index.js";
import { ApiError } from "../api/errors.js";
import { parseBody, parseWeekStart } from "../api/validate.js";
import {
  generateScheduleSchema,
  assignmentOverrideSchema,
} from "../api/schemas.js";

export const scheduleRouter = Router();

// ─── POST /api/schedule/generate ─────────────────────────────────────────────

scheduleRouter.post("/generate", async (req, res) => {
  const { weekStart: weekStartStr } = parseBody(generateScheduleSchema, req);
  const weekStart = parseWeekStart(weekStartStr);

  const [config, employees, shifts, approvedTimeOff, pendingTimeOff] =
    await Promise.all([
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

// ─── GET /api/schedule/:weekStart ─────────────────────────────────────────────

scheduleRouter.get("/:weekStart", async (req, res) => {
  const weekStart = parseWeekStart(req.params["weekStart"]);
  const assignments = await getAssignmentsForWeekWithDetails(weekStart);
  res.json({ success: true, data: assignments });
});

// ─── PUT /api/schedule/assignment/:id ────────────────────────────────────────

scheduleRouter.put("/assignment/:id", async (req, res) => {
  const { employeeId, reason } = parseBody(assignmentOverrideSchema, req);
  const { id } = req.params;

  const rawAssignment = await getAssignmentWithDetails(id);
  if (!rawAssignment) {
    throw new ApiError(404, "NOT_FOUND", "Assignment not found");
  }

  const shift = rawAssignment.shift;

  if (shift.requires_management_presence) {
    const [shiftAssignments, allEmployees] = await Promise.all([
      getAssignmentsForShift(rawAssignment.shift_id),
      getAllActiveEmployees(),
    ]);

    // Simulate: remove current employee, add new one
    const simulated: Assignment[] = [
      ...shiftAssignments.filter(
        (a) => a.employee_id !== rawAssignment.employee_id
      ),
      {
        employee_id: employeeId,
        shift_id: shift.id,
        shift_date: shift.date,
        shift_start_time: shift.start_time,
        shift_end_time: shift.end_time,
        assigned_hours: rawAssignment.assigned_hours,
        status: AssignmentStatus.SCHEDULED,
      },
    ];

    const engineShift = toShift(shift);
    const hasCoverage = shiftHasManagementCoverage(engineShift, simulated, allEmployees);
    const hasPeakManager = shift.is_peak_shift
      ? peakShiftHasManager(engineShift, simulated, allEmployees)
      : true;

    if (!hasCoverage || !hasPeakManager) {
      if (!reason) {
        throw new ApiError(
          422,
          "MANAGEMENT_COVERAGE_REQUIRED",
          "This reassignment would break management coverage. Provide a reason to override."
        );
      }

      // Append-only audit trail
      const weekStart = new Date(shift.date);
      weekStart.setUTCHours(0, 0, 0, 0);
      const latestRun = await getLatestRunForWeek(weekStart);

      if (latestRun) {
        const violation = await logViolation({
          schedule_run_id: latestRun.id,
          shift_id: shift.id,
          employee_id: rawAssignment.employee_id,
          rule: "ManagementCoverageOverride",
          severity: "BLOCKING",
          message: `Manual override: reassigning shift to employee ${employeeId} breaks management coverage`,
        });
        const auth = req.auth ?? { sub: "unknown" };
        await logManagementOverride(violation.id, {
          overridden_by: auth.sub,
          override_reason: reason,
        });
      }
    }
  }

  const updated = await reassignAssignment(id, employeeId);
  res.json({ success: true, data: updated });
});
