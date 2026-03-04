import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Assignment } from "../../../src/constraintEngine/types.js";
import { AssignmentStatus } from "../../../src/constraintEngine/types.js";
import {
  shiftHasManagementCoverage,
  peakShiftHasManager,
} from "../../../src/constraintEngine/index.js";
import { withHandler } from "../../_lib/handler.js";
import { requireAuth } from "../../_lib/auth.js";
import { parseBody } from "../../_lib/validate.js";
import {
  getAllActiveEmployees,
  getAssignmentWithDetails,
  getAssignmentsForShift,
  reassignAssignment,
  logViolation,
  logManagementOverride,
  getLatestRunForWeek,
  toShift,
} from "../../../src/repositories/index.js";
import { ApiError } from "../../../src/api/errors.js";
import { assignmentOverrideSchema } from "../../../src/api/schemas.js";

export default withHandler(async (req: VercelRequest, res: VercelResponse) => {
  const auth = requireAuth(req);
  const id = req.query["id"] as string;

  if (req.method !== "PUT") {
    res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } });
    return;
  }

  const { employeeId, reason } = parseBody(assignmentOverrideSchema, req);

  const rawAssignment = await getAssignmentWithDetails(id);
  if (!rawAssignment) throw new ApiError(404, "NOT_FOUND", "Assignment not found");

  const shift = rawAssignment.shift;

  if (shift.requires_management_presence) {
    const [shiftAssignments, allEmployees] = await Promise.all([
      getAssignmentsForShift(rawAssignment.shift_id),
      getAllActiveEmployees(),
    ]);

    const simulated: Assignment[] = [
      ...shiftAssignments.filter((a) => a.employee_id !== rawAssignment.employee_id),
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
