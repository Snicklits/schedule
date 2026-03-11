import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { TimeOffRequest, Assignment, ManagementTier } from "../src/constraintEngine/types.js";
import { AssignmentStatus } from "../src/constraintEngine/types.js";
import {
  shiftHasManagementCoverage,
  peakShiftHasManager,
  managementTimeOffIsSafe,
} from "../src/constraintEngine/index.js";
import { withHandler } from "./_lib/handler.js";
import { requireAuth, optionalAuth } from "./_lib/auth.js";
import type { AuthPayload } from "./_lib/auth.js";
import { parseBody, parseQuery, parseWeekStart } from "./_lib/validate.js";
import { ApiError } from "../src/api/errors.js";
import { prisma } from "../src/lib/prisma.js";
import { generateSchedule } from "../src/scheduler/index.js";
import jwt from "jsonwebtoken";
import {
  generateScheduleSchema,
  assignmentOverrideSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  updateEmployeeExtendedSchema,
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
  loginSchema,
  signupSchema,
  upsertBudgetSchema,
  createHistoricalEventSchema,
  createUpcomingEventSchema,
  updateUpcomingEventSchema,
  eventsTypeQuerySchema,
  updateCompanyConfigSchema,
  uploadLogoSchema,
  uploadAvatarSchema,
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
  // Phase 9
  upsertWeeklyBudget,
  getWeeklyBudget,
  getScheduledHoursForWeek,
  createHistoricalEvent,
  getAllHistoricalEvents,
  calculateRecommendation,
  createUpcomingEvent,
  getAllUpcomingEvents,
  getUpcomingEventsNext30Days,
  updateUpcomingEvent,
  getPaySummary,
  getTeamPaySummary,
  createUserAccount,
  getUserAccountByEmail,
  getUserAccountByEmployeeId,
  getUserAccountByInviteToken,
  activateAccount,
  verifyPassword,
  updateLastLogin,
  refreshInviteToken,
  getAllUserAccountsWithEmployees,
  getCompanyConfig,
  updateCompanyConfig,
} from "../src/repositories/index.js";
import {
  notifySchedulePublished,
  notifyInvite,
  notifyTimeOffDecision,
  notifySwapRequested,
  notifySwapDecision,
} from "../src/services/notifications.js";

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

function mapTierToAccountRole(tier: string): string {
  if (tier === "MANAGER") return "MANAGER";
  if (tier === "ASSISTANT_MANAGER") return "ASSISTANT_MANAGER";
  return "STAFF";
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

      // Auto-create UserAccount with invite token
      const account = await createUserAccount({
        employee_id: employee.id,
        email: employee.email,
        role: mapTierToAccountRole(body.management_tier),
      });

      // Fire-and-forget invite email
      void (async () => {
        try {
          const config = await getCompanyConfig();
          const appUrl = process.env["CLIENT_ORIGIN"] ?? "https://localhost:3000";
          await notifyInvite(
            { name: employee.name, email: employee.email },
            account.invite_token!,
            appUrl,
            config.company_name
          );
        } catch { /* notification errors must not surface */ }
      })();

      res.status(201).json({ success: true, data: { ...employee, account_status: account.status } });
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
    const body = parseBody(updateEmployeeExtendedSchema, req);
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

  // PUT /api/shifts/:id/swap
  if (sub === "swap") {
    const { assignmentId, targetEmployeeId } = req.body as { assignmentId: string; targetEmployeeId: string };
    if (req.method === "POST") {
      const swap = await prisma.shiftSwapRequest.create({
        data: {
          requester_id: assignmentId,
          target_employee_id: targetEmployeeId,
          assignment_id: assignmentId,
          status: "PENDING",
        },
        include: { requester: true, target_employee: true, assignment: { include: { shift: true, employee: true } } },
      });
      res.status(201).json({ success: true, data: swap });
      return;
    }
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
      const updated = await updateRequestStatus(seg1, "DENIED");
      // Fire-and-forget notification
      void (async () => {
        try {
          const config = await getCompanyConfig();
          await notifyTimeOffDecision(
            { name: rawRequest.employee.name, email: rawRequest.employee.email },
            "DENIED",
            rawRequest.start_date.toISOString().slice(0, 10),
            rawRequest.end_date.toISOString().slice(0, 10),
            undefined,
            config.company_name
          );
        } catch { /* ignore */ }
      })();
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
      const simulatedTimeOff: TimeOffRequest = { ...toTimeOffRequest(rawRequest), status: "APPROVED" };
      const safetyCheck = managementTimeOffIsSafe(employee, simulatedTimeOff, { shifts, assignments }, allEmployees);
      if (!safetyCheck.valid) {
        throw new ApiError(409, "MANAGEMENT_COVERAGE_UNSAFE", "Approving this time-off would break management coverage", { reasons: safetyCheck.reasons });
      }
    }
    const updated = await updateRequestStatus(seg1, "APPROVED");
    void (async () => {
      try {
        const config = await getCompanyConfig();
        await notifyTimeOffDecision(
          { name: rawRequest.employee.name, email: rawRequest.employee.email },
          "APPROVED",
          rawRequest.start_date.toISOString().slice(0, 10),
          rawRequest.end_date.toISOString().slice(0, 10),
          undefined,
          config.company_name
        );
      } catch { /* ignore */ }
    })();
    res.json({ success: true, data: updated });
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

    // Budget warning check
    const budget = await getWeeklyBudget(weekStart);
    let budgetWarning: string | null = null;
    if (budget) {
      const scheduledHours = result.schedule.reduce((s, a) => s + a.assigned_hours, 0);
      if (scheduledHours > budget.total_hours_budget) {
        budgetWarning = `Schedule (${scheduledHours.toFixed(1)}h) exceeds weekly budget (${budget.total_hours_budget}h)`;
      }
    }

    if (!result.isPublishable) {
      throw new ApiError(422, "MANAGEMENT_COVERAGE_ERROR", "Schedule generation halted due to management coverage errors", {
        runId,
        errors: result.errors,
        warnings: result.warnings.map((w) => w.message),
        isPublishable: false,
        budgetWarning,
      });
    }

    const warningMessages = result.warnings.map((w) => w.message);
    if (budgetWarning) warningMessages.push(budgetWarning);

    // Fetch full assignment details from DB (with embedded employee + shift)
    const scheduleWithDetails = await getAssignmentsForWeekWithDetails(weekStart);

    res.status(201).json({
      success: true,
      data: {
        runId,
        schedule: scheduleWithDetails,
        errors: [],
        warnings: warningMessages,
        isPublishable: true,
      },
    });
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

// ─── Phase 9: Auth ────────────────────────────────────────────────────────────

const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev-secret";

async function handleAuth(req: VercelRequest, res: VercelResponse, seg1?: string, seg2?: string): Promise<void> {
  // POST /api/auth/login
  if (seg1 === "login") {
    if (req.method !== "POST") { methodNotAllowed(res); return; }
    const { email, password } = parseBody(loginSchema, req);
    const account = await getUserAccountByEmail(email);
    if (!account || account.status === "INVITED") {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }
    if (account.status === "SUSPENDED") {
      throw new ApiError(403, "ACCOUNT_SUSPENDED", "Your account has been suspended");
    }
    const valid = await verifyPassword(account, password);
    if (!valid) throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    await updateLastLogin(account.id);
    const token = jwt.sign(
      { sub: account.employee_id, role: account.role, email: account.email },
      JWT_SECRET,
      { expiresIn: "8h" }
    );
    res.json({ success: true, data: { token, role: account.role, employeeId: account.employee_id } });
    return;
  }

  // POST /api/auth/signup
  if (seg1 === "signup") {
    if (req.method !== "POST") { methodNotAllowed(res); return; }
    const { token, password } = parseBody(signupSchema, req);
    const account = await getUserAccountByInviteToken(token);
    if (!account) throw new ApiError(400, "INVALID_TOKEN", "Invalid or expired invite token");
    if (account.invite_expires_at && account.invite_expires_at < new Date()) {
      throw new ApiError(400, "TOKEN_EXPIRED", "Invite token has expired. Please ask your manager to resend the invite.");
    }
    const activated = await activateAccount(account.id, password);
    const employee = await getEmployeeById(activated.employee_id);
    const jwtToken = jwt.sign(
      { sub: activated.employee_id, role: activated.role, email: activated.email },
      JWT_SECRET,
      { expiresIn: "8h" }
    );
    res.json({ success: true, data: { token: jwtToken, role: activated.role, employeeId: activated.employee_id, name: employee?.name } });
    return;
  }

  // GET /api/auth/invite-info?token=...
  if (seg1 === "invite-info") {
    if (req.method !== "GET") { methodNotAllowed(res); return; }
    const token = Array.isArray(req.query["token"]) ? req.query["token"][0] : req.query["token"];
    if (!token) throw new ApiError(400, "MISSING_TOKEN", "Missing invite token");
    const account = await getUserAccountByInviteToken(token);
    if (!account) throw new ApiError(400, "INVALID_TOKEN", "Invalid or expired invite token");
    if (account.invite_expires_at && account.invite_expires_at < new Date()) {
      throw new ApiError(400, "TOKEN_EXPIRED", "Invite token has expired");
    }
    const employee = await getEmployeeById(account.employee_id);
    res.json({ success: true, data: { email: account.email, name: employee?.name ?? "" } });
    return;
  }

  // POST /api/auth/resend-invite/:employeeId
  if (seg1 === "resend-invite" && seg2) {
    if (req.method !== "POST") { methodNotAllowed(res); return; }
    const account = await getUserAccountByEmployeeId(seg2);
    if (!account) throw new ApiError(404, "NOT_FOUND", "No account found for this employee");
    const updated = await refreshInviteToken(seg2);
    const employee = await getEmployeeById(seg2);
    void (async () => {
      try {
        const config = await getCompanyConfig();
        const appUrl = process.env["CLIENT_ORIGIN"] ?? "https://localhost:3000";
        await notifyInvite(
          { name: employee?.name ?? "", email: updated.email },
          updated.invite_token!,
          appUrl,
          config.company_name
        );
      } catch { /* ignore */ }
    })();
    res.json({ success: true, data: { status: "invite_sent" } });
    return;
  }

  // POST /api/auth/logout — client-side only, just return success
  if (seg1 === "logout") {
    res.json({ success: true });
    return;
  }

  res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Route not found" } });
}

// ─── Phase 9: Budget ──────────────────────────────────────────────────────────

async function handleBudget(req: VercelRequest, res: VercelResponse, auth: AuthPayload, seg1?: string): Promise<void> {
  // POST /api/budget — create/update
  if (!seg1) {
    if (req.method !== "POST") { methodNotAllowed(res); return; }
    const { weekStart: weekStartStr, totalHoursBudget, notes } = parseBody(upsertBudgetSchema, req);
    const weekStart = parseWeekStart(weekStartStr);
    const budget = await upsertWeeklyBudget({
      week_start: weekStart,
      total_hours_budget: totalHoursBudget,
      created_by: auth.sub,
      notes,
    });
    res.status(201).json({ success: true, data: budget });
    return;
  }

  // GET /api/budget/:weekStart
  if (req.method !== "GET") { methodNotAllowed(res); return; }
  const weekStart = parseWeekStart(seg1);
  const [budget, scheduledHours] = await Promise.all([
    getWeeklyBudget(weekStart),
    getScheduledHoursForWeek(weekStart),
  ]);

  if (!budget) {
    res.json({
      success: true,
      data: {
        budget_hours: null,
        scheduled_hours: scheduledHours,
        variance: null,
        status: "NO_BUDGET",
      },
    });
    return;
  }

  const variance = budget.total_hours_budget - scheduledHours;
  const threshold = budget.total_hours_budget * 0.05;
  const status = scheduledHours > budget.total_hours_budget
    ? "OVER"
    : Math.abs(variance) <= threshold
      ? "ON_TRACK"
      : "UNDER";

  res.json({
    success: true,
    data: {
      budget_hours: budget.total_hours_budget,
      scheduled_hours: scheduledHours,
      variance,
      status,
      notes: budget.notes,
      created_by: budget.created_by,
    },
  });
}

// ─── Phase 9: Events ──────────────────────────────────────────────────────────

async function handleEvents(req: VercelRequest, res: VercelResponse, seg1?: string, seg2?: string): Promise<void> {
  // /api/events/historical
  if (seg1 === "historical") {
    if (req.method === "GET") {
      const { type } = parseQuery(eventsTypeQuerySchema, req);
      res.json({ success: true, data: await getAllHistoricalEvents(type) });
    } else if (req.method === "POST") {
      const body = parseBody(createHistoricalEventSchema, req);
      const date = new Date(body.date);
      const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
      const event = await createHistoricalEvent({ ...body, date, day_of_week: dayOfWeek });
      res.status(201).json({ success: true, data: event });
    } else {
      methodNotAllowed(res);
    }
    return;
  }

  // /api/events/upcoming/next30days
  if (seg1 === "upcoming" && seg2 === "next30days") {
    if (req.method !== "GET") { methodNotAllowed(res); return; }
    res.json({ success: true, data: await getUpcomingEventsNext30Days() });
    return;
  }

  // /api/events/upcoming/:id
  if (seg1 === "upcoming" && seg2) {
    if (req.method !== "PUT") { methodNotAllowed(res); return; }
    const body = parseBody(updateUpcomingEventSchema, req);
    res.json({ success: true, data: await updateUpcomingEvent(seg2, body) });
    return;
  }

  // /api/events/upcoming
  if (seg1 === "upcoming") {
    if (req.method === "GET") {
      res.json({ success: true, data: await getAllUpcomingEvents() });
    } else if (req.method === "POST") {
      const body = parseBody(createUpcomingEventSchema, req);
      const date = new Date(body.date);
      const { staff, hours } = await calculateRecommendation(body.name, body.event_type);
      const event = await createUpcomingEvent({
        name: body.name,
        event_type: body.event_type,
        date,
        recommended_staff: staff,
        recommended_hours: hours,
        confirmed_staff: body.confirmed_staff ?? null,
        notes: body.notes ?? null,
      });
      res.status(201).json({ success: true, data: event });
    } else {
      methodNotAllowed(res);
    }
    return;
  }

  res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Route not found" } });
}

// ─── Phase 9: Salary ─────────────────────────────────────────────────────────

async function handleSalary(req: VercelRequest, res: VercelResponse, seg1?: string, seg2?: string, seg3?: string): Promise<void> {
  if (req.method !== "GET") { methodNotAllowed(res); return; }

  // GET /api/salary/team/:weekStart
  if (seg1 === "team" && seg2) {
    const weekStart = parseWeekStart(seg2);
    const result = await getTeamPaySummary(weekStart);
    res.json({ success: true, data: result });
    return;
  }

  // GET /api/salary/:employeeId/:weekStart
  if (seg1 && seg2) {
    const weekStart = parseWeekStart(seg2);
    const summary = await getPaySummary(seg1, weekStart);
    if (!summary) throw new ApiError(404, "NOT_FOUND", "No pay summary available (employee may have no hourly rate set)");
    res.json({ success: true, data: summary });
    return;
  }

  res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Route not found" } });
}

// ─── Phase 9: Company Config ──────────────────────────────────────────────────

async function handleConfig(req: VercelRequest, res: VercelResponse, auth: AuthPayload | null, seg1?: string, seg2?: string): Promise<void> {
  if (seg1 !== "company") {
    res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Route not found" } });
    return;
  }

  // POST /api/config/company/logo
  if (seg2 === "logo") {
    if (req.method !== "POST") { methodNotAllowed(res); return; }
    if (!auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    const { imageBase64, mimeType } = parseBody(uploadLogoSchema, req);
    const url = await uploadToSupabase(imageBase64, `logo-${Date.now()}`, mimeType ?? "image/jpeg", "logos");
    const updated = await updateCompanyConfig({ logo_url: url }, auth.sub);
    res.json({ success: true, data: updated });
    return;
  }

  // GET /api/config/company — public (no auth)
  if (req.method === "GET") {
    res.json({ success: true, data: await getCompanyConfig() });
    return;
  }

  // PUT /api/config/company
  if (req.method === "PUT") {
    if (!auth) throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    const body = parseBody(updateCompanyConfigSchema, req);
    const updated = await updateCompanyConfig(body, auth.sub);
    res.json({ success: true, data: updated });
    return;
  }

  methodNotAllowed(res);
}

// ─── Phase 9: Portal (avatar upload) ─────────────────────────────────────────

async function handlePortal(req: VercelRequest, res: VercelResponse, auth: AuthPayload, seg1?: string): Promise<void> {
  if (seg1 === "avatar") {
    if (req.method !== "POST") { methodNotAllowed(res); return; }
    const { imageBase64, mimeType } = parseBody(uploadAvatarSchema, req);
    const url = await uploadToSupabase(imageBase64, `avatar-${auth.sub}-${Date.now()}`, mimeType ?? "image/jpeg", "avatars");
    // Update employee record
    await prisma.employee.update({ where: { id: auth.sub }, data: { avatar_url: url } });
    res.json({ success: true, data: { avatar_url: url } });
    return;
  }

  if (seg1 === "schedule") {
    if (req.method !== "GET") { methodNotAllowed(res); return; }
    const weekStart = req.query["weekStart"]
      ? parseWeekStart(Array.isArray(req.query["weekStart"]) ? req.query["weekStart"][0]! : req.query["weekStart"])
      : getWeekStartDate(new Date());
    const assignments = await getAssignmentsForWeekWithDetails(weekStart);
    const myAssignments = assignments.filter((a) => a.employee_id === auth.sub);
    res.json({ success: true, data: myAssignments });
    return;
  }

  if (seg1 === "time-off") {
    if (req.method === "GET") {
      const requests = await getRequestsByEmployee(auth.sub);
      res.json({ success: true, data: requests });
    } else if (req.method === "POST") {
      const body = parseBody(createTimeOffSchema, req);
      const request = await createTimeOffRequest({
        employee_id: auth.sub,
        type: body.type,
        start_date: new Date(body.startDate),
        end_date: new Date(body.endDate),
        priority: body.priority,
      });
      res.status(201).json({ success: true, data: request });
    } else {
      methodNotAllowed(res);
    }
    return;
  }

  if (seg1 === "hours") {
    if (req.method !== "GET") { methodNotAllowed(res); return; }
    const weekStart = req.query["weekStart"]
      ? parseWeekStart(Array.isArray(req.query["weekStart"]) ? req.query["weekStart"][0]! : req.query["weekStart"])
      : getWeekStartDate(new Date());
    const summaryRows = await getWeeklyHoursSummary(weekStart);
    const myRow = summaryRows.find((r) => r.employeeId === auth.sub);
    const employee = await getEmployeeById(auth.sub);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    weekEnd.setUTCHours(23, 59, 59, 999);
    const assignments = await getAssignmentsForWeekWithDetails(weekStart);
    const myAssignments = assignments.filter((a) => a.employee_id === auth.sub);
    res.json({
      success: true,
      data: {
        employeeId: auth.sub,
        name: employee?.name ?? "",
        weeklyHours: myRow?.weeklyHours ?? 0,
        isAtCap: myRow?.isAtCap ?? false,
        targetHours: employee?.weekly_hours_target ?? 0,
        assignments: myAssignments,
      },
    });
    return;
  }

  res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Portal route not found" } });
}

// ─── Supabase Storage helper ──────────────────────────────────────────────────

async function uploadToSupabase(
  imageBase64: string,
  filename: string,
  mimeType: string,
  bucket: string
): Promise<string> {
  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseKey = process.env["SUPABASE_SERVICE_KEY"];

  if (!supabaseUrl || !supabaseKey) {
    throw new ApiError(503, "STORAGE_NOT_CONFIGURED", "Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.");
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Strip data URL prefix if present
  const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filename, buffer, { contentType: mimeType, upsert: true });

  if (error) {
    throw new ApiError(500, "UPLOAD_FAILED", `Storage upload failed: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filename);
  return publicUrl;
}

// ─── Main catch-all handler ───────────────────────────────────────────────────

export default withHandler(async (req: VercelRequest, res: VercelResponse) => {
  const rawPath = req.query["path"];
  const segments = Array.isArray(rawPath) ? rawPath : rawPath ? [rawPath] : [];
  const [resource, seg1, seg2, seg3] = segments;

  if (resource === "health") {
    res.json({ success: true, status: "ok", timestamp: new Date().toISOString() });
    return;
  }

  // Auth routes — no JWT required
  if (resource === "auth") {
    return handleAuth(req, res, seg1, seg2);
  }

  // Company config GET — public (no auth required)
  if (resource === "config" && seg1 === "company" && req.method === "GET" && !seg2) {
    return handleConfig(req, res, null, seg1, seg2);
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
    case "budget":          return handleBudget(req, res, auth, seg1);
    case "events":          return handleEvents(req, res, seg1, seg2);
    case "salary":          return handleSalary(req, res, seg1, seg2, seg3);
    case "config":          return handleConfig(req, res, auth, seg1, seg2);
    case "portal":          return handlePortal(req, res, auth, seg1);
    default:
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Route not found" } });
  }
});
