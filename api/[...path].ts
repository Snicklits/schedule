import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { TimeOffRequest, Assignment, ManagementTier } from "../src/constraintEngine/types.js";
import { AssignmentStatus } from "../src/constraintEngine/types.js";
import {
  shiftHasManagementCoverage,
  peakShiftHasManager,
  managementTimeOffIsSafe,
} from "../src/constraintEngine/index.js";
import { withHandler } from "./_lib/handler.js";
import { requireAuth } from "./_lib/auth.js";
import type { AuthPayload } from "./_lib/auth.js";
import { parseBody, parseQuery, parseWeekStart } from "./_lib/validate.js";
import { ApiError } from "../src/api/errors.js";
import { prisma } from "../src/lib/prisma.js";
import { generateSchedule } from "../src/scheduler/index.js";
import {
  generateScheduleSchema,
  assignmentOverrideSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeQuerySchema,
  createTimeOffSchema,
  approveTimeOffSchema,
  timeOffQuerySchema,
  createShiftSchema,
  updateShiftSchema,
  shiftsQuerySchema,
  markPeakSchema,
  weekStartQuerySchema,
  violationsQuerySchema,
  managementGapsQuerySchema,
  createPeakWindowSchema,
} from "../src/api/schemas.js";
import {
  getAllActiveEmployees,
  getAllEmployeesWithStatus,
  getEmployeesByTier,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  getAllShifts,
  getShiftsByWeek,
  getShiftById,
  createShift,
  updateShift,
  deleteShift,
  markShiftAsPeak,
  getRequestsByEmployee,
  getAllTimeOffRequests,
  createTimeOffRequest,
  getTimeOffById,
  deleteTimeOffRequest,
  updateRequestStatus,
  getAssignmentsForWeek,
  getActiveScheduleConfig,
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
  toEmployee,
  toTimeOffRequest,
  getShiftsLackingManagementCoverage,
  getPeakShiftsWithManagerCheck,
  getWeeklyHoursSummary,
  getAllViolations,
  getAllManagementGaps,
  getAllPeakWindows,
  createPeakWindow,
  deletePeakWindow,
} from "../src/repositories/index.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function methodNotAllowed(res: VercelResponse): void {
  res.status(405).json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" } });
}

function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
  return d;
}

// ─── Resource handlers ────────────────────────────────────────────────────────

async function handleEmployees(req: VercelRequest, res: VercelResponse, id?: string): Promise<void> {
  if (!id) {
    if (req.method === "GET") {
      const { tier, all } = parseQuery(employeeQuerySchema, req);
      const employees =
        all === "true"
          ? await getAllEmployeesWithStatus()
          : tier
            ? await getEmployeesByTier(tier as ManagementTier)
            : await getAllActiveEmployees();
      res.json({ success: true, data: employees });
    } else if (req.method === "POST") {
      const body = parseBody(createEmployeeSchema, req);
      const employee = await createEmployee({
        name: body.name,
        email: body.email,
        employment_type: body.employment_type,
        weekly_hours_target: body.weekly_hours_target,
        hire_date: new Date(body.hire_date),
        seniority_level: body.seniority_level,
        role: body.role,
        hierarchy_rank: body.hierarchy_rank,
        management_tier: body.management_tier,
        specialties: body.specialties,
      });
      res.status(201).json({ success: true, data: employee });
    } else {
      methodNotAllowed(res);
    }
    return;
  }

  if (req.method === "GET") {
    const employee = await getEmployeeById(id);
    if (!employee) throw new ApiError(404, "NOT_FOUND", "Employee not found");
    res.json({ success: true, data: employee });
  } else if (req.method === "PUT") {
    const body = parseBody(updateEmployeeSchema, req);
    res.json({ success: true, data: await updateEmployee(id, body) });
  } else {
    methodNotAllowed(res);
  }
}

async function handleShifts(req: VercelRequest, res: VercelResponse, id?: string, sub?: string): Promise<void> {
  if (!id) {
    if (req.method === "GET") {
      const { weekStart: ws } = parseQuery(shiftsQuerySchema, req);
      const shifts = ws ? await getShiftsByWeek(parseWeekStart(ws)) : await getAllShifts();
      res.json({ success: true, data: shifts });
    } else if (req.method === "POST") {
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
    } else {
      methodNotAllowed(res);
    }
    return;
  }

  // PUT /api/shifts/:id/mark-peak
  if (sub === "mark-peak") {
    if (req.method !== "PUT") { methodNotAllowed(res); return; }
    const { isPeak } = parseBody(markPeakSchema, req);
    const existing = await getShiftById(id);
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Shift not found");
    res.json({ success: true, data: await markShiftAsPeak(id, isPeak) });
    return;
  }

  if (req.method === "GET") {
    const shift = await getShiftById(id);
    if (!shift) throw new ApiError(404, "NOT_FOUND", "Shift not found");
    res.json({ success: true, data: shift });
  } else if (req.method === "PUT") {
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
    res.json({ success: true, data: await updateShift(id, updates) });
  } else if (req.method === "DELETE") {
    const existing = await getShiftById(id);
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Shift not found");
    await deleteShift(id);
    res.status(204).end();
  } else {
    methodNotAllowed(res);
  }
}

async function handleTimeOff(
  req: VercelRequest,
  res: VercelResponse,
  seg1?: string,
  seg2?: string
): Promise<void> {
  // GET /api/time-off/all
  if (seg1 === "all") {
    if (req.method !== "GET") { methodNotAllowed(res); return; }
    res.json({ success: true, data: await getAllTimeOffRequests() });
    return;
  }

  // PUT /api/time-off/:id/approve
  if (seg1 && seg2 === "approve") {
    if (req.method !== "PUT") { methodNotAllowed(res); return; }
    const { status } = parseBody(approveTimeOffSchema, req);
    const rawRequest = await getTimeOffById(seg1);
    if (!rawRequest) throw new ApiError(404, "NOT_FOUND", "Time-off request not found");

    if (status === "DENIED") {
      res.json({ success: true, data: await updateRequestStatus(seg1, "DENIED") });
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
      const simulatedTimeOff: TimeOffRequest = { ...toTimeOffRequest(rawRequest), status: "APPROVED" };
      const safetyCheck = managementTimeOffIsSafe(employee, simulatedTimeOff, { shifts, assignments }, allEmployees);
      if (!safetyCheck.valid) {
        throw new ApiError(409, "MANAGEMENT_COVERAGE_UNSAFE", "Approving this time-off would break management coverage", { reasons: safetyCheck.reasons });
      }
    }
    res.json({ success: true, data: await updateRequestStatus(seg1, "APPROVED") });
    return;
  }

  // DELETE /api/time-off/:id
  if (seg1) {
    if (req.method !== "DELETE") { methodNotAllowed(res); return; }
    const existing = await getTimeOffById(seg1);
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Time-off request not found");
    await deleteTimeOffRequest(seg1);
    res.status(204).end();
    return;
  }

  // GET/POST /api/time-off
  if (req.method === "GET") {
    const { employeeId } = parseQuery(timeOffQuerySchema, req);
    res.json({ success: true, data: await getRequestsByEmployee(employeeId) });
  } else if (req.method === "POST") {
    const body = parseBody(createTimeOffSchema, req);
    const request = await createTimeOffRequest({
      employee_id: body.employeeId,
      type: body.type,
      start_date: new Date(body.startDate),
      end_date: new Date(body.endDate),
      priority: body.priority,
    });
    res.status(201).json({ success: true, data: request });
  } else {
    methodNotAllowed(res);
  }
}

async function handleSchedule(
  req: VercelRequest,
  res: VercelResponse,
  auth: AuthPayload,
  seg1?: string,
  seg2?: string
): Promise<void> {
  // POST /api/schedule/generate
  if (seg1 === "generate") {
    if (req.method !== "POST") { methodNotAllowed(res); return; }
    const { weekStart: weekStartStr } = parseBody(generateScheduleSchema, req);
    const weekStart = parseWeekStart(weekStartStr);
    const [config, employees, shifts, approvedTimeOff, pendingTimeOff] = await Promise.all([
      getActiveScheduleConfig(),
      getAllActiveEmployees(),
      getShiftsByWeek(weekStart),
      getApprovedTimeOffForWeek(weekStart),
      getPendingRequestsForWeek(weekStart),
    ]);
    if (!config) throw new ApiError(422, "CONFIG_NOT_FOUND", "No active schedule configuration found");
    const result = generateSchedule(weekStart, employees, shifts, [...approvedTimeOff, ...pendingTimeOff], config);
    const runId = await saveScheduleGeneration(weekStart, result);
    if (!result.isPublishable) {
      throw new ApiError(422, "MANAGEMENT_COVERAGE_ERROR", "Schedule generation halted due to management coverage errors", { runId, errors: result.errors, warnings: result.warnings });
    }
    res.status(201).json({ success: true, data: { runId, schedule: result.schedule, warnings: result.warnings } });
    return;
  }

  // PUT /api/schedule/assignment/:id
  if (seg1 === "assignment" && seg2) {
    if (req.method !== "PUT") { methodNotAllowed(res); return; }
    const { employeeId, reason } = parseBody(assignmentOverrideSchema, req);
    const rawAssignment = await getAssignmentWithDetails(seg2);
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
      const hasPeakManager = shift.is_peak_shift ? peakShiftHasManager(engineShift, simulated, allEmployees) : true;
      if (!hasCoverage || !hasPeakManager) {
        if (!reason) {
          throw new ApiError(422, "MANAGEMENT_COVERAGE_REQUIRED", "This reassignment would break management coverage. Provide a reason to override.");
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
          await logManagementOverride(violation.id, { overridden_by: auth.sub, override_reason: reason });
        }
      }
    }
    res.json({ success: true, data: await reassignAssignment(seg2, employeeId) });
    return;
  }

  // GET /api/schedule/:weekStart
  if (seg1) {
    if (req.method !== "GET") { methodNotAllowed(res); return; }
    res.json({ success: true, data: await getAssignmentsForWeekWithDetails(parseWeekStart(seg1)) });
    return;
  }

  res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Route not found" } });
}

async function handleCoverage(req: VercelRequest, res: VercelResponse, seg1?: string, seg2?: string): Promise<void> {
  if (req.method !== "GET") { methodNotAllowed(res); return; }

  // GET /api/coverage/check/:weekStart — combined coverage report (path param)
  if (seg1 === "check") {
    const weekStart = parseWeekStart(seg2, "weekStart");
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
    return;
  }

  const { weekStart: ws } = parseQuery(weekStartQuerySchema, req);
  const weekStart = parseWeekStart(ws);
  if (seg1 === "gaps") {
    res.json({ success: true, data: await getShiftsLackingManagementCoverage(weekStart) });
  } else if (seg1 === "peak") {
    const peakShifts = await getPeakShiftsWithManagerCheck(weekStart);
    res.json({ success: true, data: peakShifts.filter((p) => !p.hasManager) });
  } else {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Route not found" } });
  }
}

async function handleReports(req: VercelRequest, res: VercelResponse, seg1?: string): Promise<void> {
  if (req.method !== "GET") { methodNotAllowed(res); return; }
  if (seg1 === "hours") {
    const { weekStart: ws } = parseQuery(weekStartQuerySchema, req);
    res.json({ success: true, data: await getWeeklyHoursSummary(parseWeekStart(ws)) });
  } else if (seg1 === "violations") {
    const { type, weekStart: ws } = parseQuery(violationsQuerySchema, req);
    res.json({ success: true, data: await getAllViolations({ severity: type as "BLOCKING" | "WARNING" | undefined, weekStart: ws ? parseWeekStart(ws) : undefined }) });
  } else if (seg1 === "management-gaps") {
    const { weekStart: ws } = parseQuery(managementGapsQuerySchema, req);
    const gaps = await getAllManagementGaps(ws ? parseWeekStart(ws) : undefined);
    res.json({ success: true, data: gaps });
  } else {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Route not found" } });
  }
}

async function handleScheduleConfig(req: VercelRequest, res: VercelResponse, id?: string): Promise<void> {
  if (!id) {
    if (req.method === "GET") {
      res.json(await prisma.scheduleConfig.findMany());
    } else if (req.method === "POST") {
      res.status(201).json(await prisma.scheduleConfig.create({ data: req.body }));
    } else {
      methodNotAllowed(res);
    }
    return;
  }
  if (req.method === "GET") {
    const config = await prisma.scheduleConfig.findUnique({ where: { id } });
    if (!config) throw new ApiError(404, "NOT_FOUND", "Schedule config not found");
    res.json(config);
  } else if (req.method === "PUT") {
    res.json(await prisma.scheduleConfig.update({ where: { id }, data: req.body }));
  } else if (req.method === "DELETE") {
    await prisma.scheduleConfig.delete({ where: { id } });
    res.status(204).end();
  } else {
    methodNotAllowed(res);
  }
}

async function handleScheduleRuns(req: VercelRequest, res: VercelResponse, id?: string): Promise<void> {
  if (!id) {
    if (req.method === "GET") {
      res.json(await prisma.scheduleRun.findMany({ orderBy: { generated_at: "desc" } }));
    } else if (req.method === "POST") {
      res.status(201).json(await prisma.scheduleRun.create({ data: req.body }));
    } else {
      methodNotAllowed(res);
    }
    return;
  }
  if (req.method === "GET") {
    const run = await prisma.scheduleRun.findUnique({ where: { id }, include: { constraint_violations: true } });
    if (!run) throw new ApiError(404, "NOT_FOUND", "Schedule run not found");
    res.json(run);
  } else if (req.method === "DELETE") {
    await prisma.scheduleRun.delete({ where: { id } });
    res.status(204).end();
  } else {
    methodNotAllowed(res);
  }
}

async function handlePeakWindows(req: VercelRequest, res: VercelResponse, id?: string): Promise<void> {
  if (!id) {
    if (req.method === "GET") {
      res.json({ success: true, data: await getAllPeakWindows() });
    } else if (req.method === "POST") {
      const body = parseBody(createPeakWindowSchema, req);
      const window = await createPeakWindow({ days: body.days, start_time: body.startTime, end_time: body.endTime, label: body.label });
      res.status(201).json({ success: true, data: window });
    } else {
      methodNotAllowed(res);
    }
    return;
  }
  if (req.method === "DELETE") {
    try {
      await deletePeakWindow(id);
      res.status(204).end();
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2025") {
        throw new ApiError(404, "NOT_FOUND", "Peak window not found");
      }
      throw err;
    }
  } else {
    methodNotAllowed(res);
  }
}

async function handleAssignments(req: VercelRequest, res: VercelResponse, id?: string): Promise<void> {
  if (!id) {
    if (req.method === "GET") {
      res.json(await prisma.assignment.findMany());
    } else if (req.method === "POST") {
      res.status(201).json(await prisma.assignment.create({ data: req.body }));
    } else {
      methodNotAllowed(res);
    }
    return;
  }
  if (req.method === "GET") {
    const assignment = await prisma.assignment.findUnique({ where: { id }, include: { employee: true, shift: true } });
    if (!assignment) { res.status(404).json({ error: "Assignment not found" }); return; }
    res.json(assignment);
  } else if (req.method === "PUT") {
    res.json(await prisma.assignment.update({ where: { id }, data: req.body }));
  } else if (req.method === "DELETE") {
    await prisma.assignment.delete({ where: { id } });
    res.status(204).end();
  } else {
    methodNotAllowed(res);
  }
}

// ─── Main catch-all handler ───────────────────────────────────────────────────

export default withHandler(async (req: VercelRequest, res: VercelResponse) => {
  const rawPath = req.query["path"];
  const segments = Array.isArray(rawPath) ? rawPath : rawPath ? [rawPath] : [];
  const [resource, seg1, seg2] = segments;

  if (resource === "health") {
    res.json({ success: true, status: "ok", timestamp: new Date().toISOString() });
    return;
  }

  const auth = requireAuth(req);

  switch (resource) {
    case "employees":       return handleEmployees(req, res, seg1);
    case "shifts":          return handleShifts(req, res, seg1, seg2);
    case "time-off":        return handleTimeOff(req, res, seg1, seg2);
    case "schedule":        return handleSchedule(req, res, auth, seg1, seg2);
    case "coverage":        return handleCoverage(req, res, seg1, seg2);
    case "reports":         return handleReports(req, res, seg1);
    case "schedule-config": return handleScheduleConfig(req, res, seg1);
    case "schedule-runs":   return handleScheduleRuns(req, res, seg1);
    case "peak-windows":    return handlePeakWindows(req, res, seg1);
    case "assignments":     return handleAssignments(req, res, seg1);
    default:
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Route not found" } });
  }
});
