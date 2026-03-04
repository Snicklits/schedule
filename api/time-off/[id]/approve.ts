import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { TimeOffRequest } from "../../../src/constraintEngine/types.js";
import { managementTimeOffIsSafe } from "../../../src/constraintEngine/index.js";
import { withHandler } from "../../_lib/handler.js";
import { requireAuth } from "../../_lib/auth.js";
import { parseBody } from "../../_lib/validate.js";
import {
  getTimeOffById,
  updateRequestStatus,
  getShiftsByWeek,
  getAssignmentsForWeek,
  getAllActiveEmployees,
  toEmployee,
  toTimeOffRequest,
} from "../../../src/repositories/index.js";
import { ApiError } from "../../../src/api/errors.js";
import { approveTimeOffSchema } from "../../../src/api/schemas.js";

function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay();
  const diff = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

export default withHandler(async (req: VercelRequest, res: VercelResponse) => {
  requireAuth(req);
  const id = req.query["id"] as string;

  if (req.method !== "PUT") {
    res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } });
    return;
  }

  const { status } = parseBody(approveTimeOffSchema, req);

  const rawRequest = await getTimeOffById(id);
  if (!rawRequest) throw new ApiError(404, "NOT_FOUND", "Time-off request not found");

  if (status === "DENIED") {
    const updated = await updateRequestStatus(id, "DENIED");
    res.json({ success: true, data: updated });
    return;
  }

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
  res.json({ success: true, data: updated });
});
