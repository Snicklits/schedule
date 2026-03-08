/**
 * Integration Tests — API Endpoints
 *
 * Uses Supertest against the real Express app.  All database calls are
 * replaced with vi.mock so no PostgreSQL connection is required.
 *
 * Every protected route is tested with a valid JWT (mintTestToken).
 * Repository mocks are reset between tests so state never leaks.
 */

// ─── Mocks must be hoisted before any imports ─────────────────────────────────

import { vi } from "vitest";

// Prevent Prisma from trying to connect (generated client may not exist)
vi.mock("../../lib/prisma.js", () => ({ prisma: {} }));

// Mock all repository functions (no DB access in tests)
vi.mock("../../repositories/index.js", () => ({
  toEmployee: vi.fn((e: Record<string, unknown>) => ({
    id: e["id"],
    name: e["name"],
    employment_type: e["employment_type"],
    weekly_hours_target: e["weekly_hours_target"],
    management_tier: e["management_tier"],
    specialties: (e["specialties"] as string[]) ?? [],
    seniority_level: e["seniority_level"],
    hierarchy_rank: e["hierarchy_rank"],
  })),
  toShift: vi.fn((s: Record<string, unknown>) => ({
    id: s["id"],
    date: s["date"],
    start_time: s["start_time"],
    end_time: s["end_time"],
    duration_hours: s["duration_hours"],
    required_specialty: s["required_specialty"] ?? null,
    min_staff_count: s["min_staff_count"],
    is_peak_shift: s["is_peak_shift"],
    requires_management_presence: s["requires_management_presence"],
  })),
  toTimeOffRequest: vi.fn((r: Record<string, unknown>) => ({
    id: r["id"],
    employee_id: r["employee_id"],
    start_date: r["start_date"],
    end_date: r["end_date"],
    status: r["status"],
    created_at: r["created_at"],
    priority: r["priority"],
  })),
  getAllActiveEmployees: vi.fn(),
  getAllEmployeesWithStatus: vi.fn(),
  getEmployeesByTier: vi.fn(),
  getEmployeeById: vi.fn(),
  createEmployee: vi.fn(),
  updateEmployee: vi.fn(),
  getShiftsByWeek: vi.fn(),
  getActiveScheduleConfig: vi.fn(),
  getApprovedTimeOffForWeek: vi.fn(),
  getPendingRequestsForWeek: vi.fn(),
  saveScheduleGeneration: vi.fn(),
  getAssignmentsForWeekWithDetails: vi.fn(),
  getAssignmentWithDetails: vi.fn(),
  getAssignmentsForShift: vi.fn(),
  reassignAssignment: vi.fn(),
  logViolation: vi.fn(),
  logManagementOverride: vi.fn(),
  getLatestRunForWeek: vi.fn(),
  getAllTimeOffRequests: vi.fn(),
  getRequestsByEmployee: vi.fn(),
  createTimeOffRequest: vi.fn(),
  getTimeOffById: vi.fn(),
  deleteTimeOffRequest: vi.fn(),
  updateRequestStatus: vi.fn(),
  getAssignmentsForWeek: vi.fn(),
}));

vi.mock("../../repositories/swap.js", () => ({
  createSwapRequest: vi.fn(),
  getSwapRequestsByEmployee: vi.fn(),
  getSwapRequestById: vi.fn(),
  updateSwapStatus: vi.fn(),
  getShiftAssignmentsWithEmployees: vi.fn(),
}));

// Prevent email sends during tests
vi.mock("../../services/notifications.js", () => ({
  notifySchedulePublished: vi.fn().mockResolvedValue(undefined),
  notifyTimeOffDecision: vi.fn().mockResolvedValue(undefined),
  notifySwapRequested: vi.fn().mockResolvedValue(undefined),
  notifySwapDecision: vi.fn().mockResolvedValue(undefined),
}));

// ─── Real imports (after mocks are registered) ────────────────────────────────

import { describe, it, expect, beforeEach } from "vitest";
import supertest from "supertest";
import app from "../../app.js";
import { mintTestToken } from "../../middleware/auth.js";
import * as repos from "../../repositories/index.js";
import * as swapRepos from "../../repositories/swap.js";
import {
  WEEK_START,
  weekDay,
  manager1,
  manager2,
  am1,
  staffEmployees,
  buildWeekShifts,
  defaultConfig,
  prismaEmployee,
  prismaShift,
  prismaTimeOff,
  makeTimeOff,
  approvedTimeOff,
} from "../fixtures/seed.js";
import { TimeOffStatus } from "../../constraintEngine/types.js";

// ─── Auth token ───────────────────────────────────────────────────────────────

const TOKEN = mintTestToken("test-admin", "ADMIN");
const auth = { Authorization: `Bearer ${TOKEN}` };

// ─── Typed mock helpers ───────────────────────────────────────────────────────

const mockRepos = repos as {
  getAllActiveEmployees: ReturnType<typeof vi.fn>;
  getAllEmployeesWithStatus: ReturnType<typeof vi.fn>;
  getEmployeeById: ReturnType<typeof vi.fn>;
  createEmployee: ReturnType<typeof vi.fn>;
  getShiftsByWeek: ReturnType<typeof vi.fn>;
  getActiveScheduleConfig: ReturnType<typeof vi.fn>;
  getApprovedTimeOffForWeek: ReturnType<typeof vi.fn>;
  getPendingRequestsForWeek: ReturnType<typeof vi.fn>;
  saveScheduleGeneration: ReturnType<typeof vi.fn>;
  getAssignmentsForWeekWithDetails: ReturnType<typeof vi.fn>;
  getAssignmentWithDetails: ReturnType<typeof vi.fn>;
  getAssignmentsForShift: ReturnType<typeof vi.fn>;
  reassignAssignment: ReturnType<typeof vi.fn>;
  logViolation: ReturnType<typeof vi.fn>;
  logManagementOverride: ReturnType<typeof vi.fn>;
  getLatestRunForWeek: ReturnType<typeof vi.fn>;
  getAllTimeOffRequests: ReturnType<typeof vi.fn>;
  getRequestsByEmployee: ReturnType<typeof vi.fn>;
  createTimeOffRequest: ReturnType<typeof vi.fn>;
  getTimeOffById: ReturnType<typeof vi.fn>;
  deleteTimeOffRequest: ReturnType<typeof vi.fn>;
  updateRequestStatus: ReturnType<typeof vi.fn>;
  getAssignmentsForWeek: ReturnType<typeof vi.fn>;
};

const mockSwap = swapRepos as {
  createSwapRequest: ReturnType<typeof vi.fn>;
  getSwapRequestsByEmployee: ReturnType<typeof vi.fn>;
  getSwapRequestById: ReturnType<typeof vi.fn>;
  updateSwapStatus: ReturnType<typeof vi.fn>;
  getShiftAssignmentsWithEmployees: ReturnType<typeof vi.fn>;
};

// ─── Shared seed data ─────────────────────────────────────────────────────────

const weekShifts = buildWeekShifts();
const allEmployees = [manager1, manager2, am1, ...staffEmployees];
const staff = staffEmployees[0]!;

/** A minimal ScheduleConfig returned by getActiveScheduleConfig mock. */
const mockConfig = {
  ...defaultConfig,
  id: "cfg-1",
  conflict_resolution_strategy: "SENIORITY_FIRST",
  peak_windows: [],
};

// ─── Clean all mocks between tests ───────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Auth
// ═══════════════════════════════════════════════════════════════════════════════

describe("Auth guard", () => {
  it("returns 401 when no Authorization header is provided", async () => {
    const res = await supertest(app).get("/api/employees");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 401 for an invalid token", async () => {
    const res = await supertest(app)
      .get("/api/employees")
      .set("Authorization", "Bearer invalid.token.here");
    expect(res.status).toBe(401);
  });

  it("passes through to route when a valid token is present", async () => {
    mockRepos.getAllActiveEmployees.mockResolvedValue([]);
    const res = await supertest(app).get("/api/employees").set(auth);
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/schedule/generate
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /api/schedule/generate", () => {
  const WEEK_STR = "2026-03-02";

  it("returns 201 with a publishable schedule when generation succeeds", async () => {
    mockRepos.getActiveScheduleConfig.mockResolvedValue(mockConfig);
    mockRepos.getAllActiveEmployees.mockResolvedValue(allEmployees);
    mockRepos.getShiftsByWeek.mockResolvedValue([weekShifts[0]!]); // single manageable shift
    mockRepos.getApprovedTimeOffForWeek.mockResolvedValue([]);
    mockRepos.getPendingRequestsForWeek.mockResolvedValue([]);
    mockRepos.saveScheduleGeneration.mockResolvedValue("run-1");

    const res = await supertest(app)
      .post("/api/schedule/generate")
      .set(auth)
      .send({ weekStart: WEEK_STR });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.runId).toBe("run-1");
    expect(res.body.data.isPublishable).toBe(true);
  });

  it("returns 422 MANAGEMENT_COVERAGE_ERROR when no manager is available for a peak shift", async () => {
    const peakShift = weekShifts.find((s) => s.is_peak_shift)!;
    // Provide only STAFF employees — no managers available
    const staffOnly = staffEmployees.slice(0, 5);

    mockRepos.getActiveScheduleConfig.mockResolvedValue(mockConfig);
    mockRepos.getAllActiveEmployees.mockResolvedValue(staffOnly);
    mockRepos.getShiftsByWeek.mockResolvedValue([peakShift]);
    mockRepos.getApprovedTimeOffForWeek.mockResolvedValue([]);
    mockRepos.getPendingRequestsForWeek.mockResolvedValue([]);
    mockRepos.saveScheduleGeneration.mockResolvedValue("run-halted");

    const res = await supertest(app)
      .post("/api/schedule/generate")
      .set(auth)
      .send({ weekStart: WEEK_STR });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("MANAGEMENT_COVERAGE_ERROR");
  });

  it("returns 422 CONFIG_NOT_FOUND when no schedule config exists", async () => {
    mockRepos.getActiveScheduleConfig.mockResolvedValue(null);
    mockRepos.getAllActiveEmployees.mockResolvedValue([]);
    mockRepos.getShiftsByWeek.mockResolvedValue([]);
    mockRepos.getApprovedTimeOffForWeek.mockResolvedValue([]);
    mockRepos.getPendingRequestsForWeek.mockResolvedValue([]);

    const res = await supertest(app)
      .post("/api/schedule/generate")
      .set(auth)
      .send({ weekStart: WEEK_STR });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("CONFIG_NOT_FOUND");
  });

  it("returns 400 when weekStart is missing from the request body", async () => {
    const res = await supertest(app)
      .post("/api/schedule/generate")
      .set(auth)
      .send({});
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/schedule/:weekStart
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/schedule/:weekStart", () => {
  it("returns schedule assignments for a seeded week", async () => {
    const mockAssignments = [
      { id: "asgn-1", employee: prismaEmployee(manager1), shift: prismaShift(weekShifts[0]!) },
    ];
    mockRepos.getAssignmentsForWeekWithDetails.mockResolvedValue(mockAssignments);

    const res = await supertest(app).get("/api/schedule/2026-03-02").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it("returns an empty array for an unseeded week", async () => {
    mockRepos.getAssignmentsForWeekWithDetails.mockResolvedValue([]);

    const res = await supertest(app).get("/api/schedule/2025-01-06").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it("returns 400 for an invalid weekStart format", async () => {
    const res = await supertest(app).get("/api/schedule/not-a-date").set(auth);
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /api/schedule/assignment/:id
// ═══════════════════════════════════════════════════════════════════════════════

describe("PUT /api/schedule/assignment/:id", () => {
  const openShiftRow = {
    id: "asgn-open",
    employee_id: staff.id,
    shift_id: "shift-open",
    assigned_hours: 8,
    shift: {
      id: "shift-open",
      date: weekDay(3),
      start_time: weekDay(3, 9),
      end_time: weekDay(3, 17),
      duration_hours: 8,
      required_specialty: null,
      min_staff_count: 1,
      is_peak_shift: false,
      requires_management_presence: false,
    },
  };

  it("returns 200 when the assignment is updated successfully (no management requirement)", async () => {
    mockRepos.getAssignmentWithDetails.mockResolvedValue(openShiftRow);
    mockRepos.reassignAssignment.mockResolvedValue({ ...openShiftRow, employee_id: manager1.id });

    const res = await supertest(app)
      .put("/api/schedule/assignment/asgn-open")
      .set(auth)
      .send({ employeeId: manager1.id });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns 404 when the assignment does not exist", async () => {
    mockRepos.getAssignmentWithDetails.mockResolvedValue(null);

    const res = await supertest(app)
      .put("/api/schedule/assignment/nonexistent")
      .set(auth)
      .send({ employeeId: manager1.id });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 422 when override breaks management coverage and no reason is provided", async () => {
    const mgmtShiftRow = {
      id: "asgn-mgmt",
      employee_id: manager1.id,
      shift_id: "shift-mgmt",
      assigned_hours: 8,
      shift: {
        id: "shift-mgmt",
        date: weekDay(0),
        start_time: weekDay(0, 9),
        end_time: weekDay(0, 17),
        duration_hours: 8,
        required_specialty: null,
        min_staff_count: 2,
        is_peak_shift: false,
        requires_management_presence: true,
      },
    };
    // getAssignmentsForShift returns only the manager being reassigned (no other management)
    mockRepos.getAssignmentWithDetails.mockResolvedValue(mgmtShiftRow);
    mockRepos.getAssignmentsForShift.mockResolvedValue([
      {
        employee_id: manager1.id,
        shift_id: "shift-mgmt",
        shift_date: weekDay(0),
        shift_start_time: weekDay(0, 9),
        shift_end_time: weekDay(0, 17),
        assigned_hours: 8,
        status: "SCHEDULED",
      },
    ]);
    // getAllActiveEmployees returns only STAFF as the new candidate
    mockRepos.getAllActiveEmployees.mockResolvedValue([staff]);

    const res = await supertest(app)
      .put("/api/schedule/assignment/asgn-mgmt")
      .set(auth)
      .send({ employeeId: staff.id }); // STAFF replacing only MANAGER → coverage broken

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("MANAGEMENT_COVERAGE_REQUIRED");
  });

  it("returns 200 and logs override when reason is provided for coverage-breaking reassignment", async () => {
    const mgmtShiftRow = {
      id: "asgn-mgmt2",
      employee_id: manager1.id,
      shift_id: "shift-mgmt2",
      assigned_hours: 8,
      shift: {
        id: "shift-mgmt2",
        date: weekDay(0),
        start_time: weekDay(0, 9),
        end_time: weekDay(0, 17),
        duration_hours: 8,
        required_specialty: null,
        min_staff_count: 2,
        is_peak_shift: false,
        requires_management_presence: true,
      },
    };
    mockRepos.getAssignmentWithDetails.mockResolvedValue(mgmtShiftRow);
    mockRepos.getAssignmentsForShift.mockResolvedValue([]);
    mockRepos.getAllActiveEmployees.mockResolvedValue([staff]);
    mockRepos.getLatestRunForWeek.mockResolvedValue({ id: "run-1" });
    mockRepos.logViolation.mockResolvedValue({ id: "viol-1" });
    mockRepos.logManagementOverride.mockResolvedValue(undefined);
    mockRepos.reassignAssignment.mockResolvedValue({ ...mgmtShiftRow, employee_id: staff.id });

    const res = await supertest(app)
      .put("/api/schedule/assignment/asgn-mgmt2")
      .set(auth)
      .send({ employeeId: staff.id, reason: "Emergency coverage needed" });

    expect(res.status).toBe(200);
    expect(mockRepos.logViolation).toHaveBeenCalled();
    expect(mockRepos.logManagementOverride).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/employees
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/employees", () => {
  it("returns all active employees", async () => {
    mockRepos.getAllActiveEmployees.mockResolvedValue(allEmployees);

    const res = await supertest(app).get("/api/employees").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(allEmployees.length);
  });

  it("returns an empty array when there are no employees", async () => {
    mockRepos.getAllActiveEmployees.mockResolvedValue([]);

    const res = await supertest(app).get("/api/employees").set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/employees
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /api/employees", () => {
  const validPayload = {
    name: "New Employee",
    email: "new@example.com",
    employment_type: "FULL_TIME",
    weekly_hours_target: 40,
    hire_date: "2026-01-01",
    seniority_level: 2,
    role: "Barista",
    hierarchy_rank: 10,
    management_tier: "STAFF",
    specialties: ["barista"],
  };

  it("returns 201 with the created employee on valid input", async () => {
    const created = { id: "new-emp-1", ...manager1, name: "New Employee" };
    mockRepos.createEmployee.mockResolvedValue(created);

    const res = await supertest(app)
      .post("/api/employees")
      .set(auth)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(mockRepos.createEmployee).toHaveBeenCalledOnce();
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await supertest(app)
      .post("/api/employees")
      .set(auth)
      .send({ name: "Incomplete" }); // missing email, employment_type, etc.
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is invalid", async () => {
    const res = await supertest(app)
      .post("/api/employees")
      .set(auth)
      .send({ ...validPayload, email: "not-an-email" });
    expect(res.status).toBe(400);
  });

  it("returns error (non-2xx) when the database rejects a duplicate email", async () => {
    const dbError = new Error("Unique constraint violation on email");
    (dbError as NodeJS.ErrnoException).code = "P2002"; // Prisma unique violation code
    mockRepos.createEmployee.mockRejectedValue(dbError);

    const res = await supertest(app)
      .post("/api/employees")
      .set(auth)
      .send(validPayload);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/time-off
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /api/time-off", () => {
  it("returns 201 when a valid time-off request is created", async () => {
    const created = {
      id: "tor-new",
      employee_id: staff.id,
      type: "VACATION",
      start_date: weekDay(0),
      end_date: weekDay(2),
      status: "PENDING",
      priority: 0,
      created_at: new Date(),
    };
    mockRepos.createTimeOffRequest.mockResolvedValue(created);

    const res = await supertest(app)
      .post("/api/time-off")
      .set(auth)
      .send({
        employeeId: staff.id,
        type: "VACATION",
        startDate: "2026-03-02",
        endDate: "2026-03-04",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await supertest(app)
      .post("/api/time-off")
      .set(auth)
      .send({ type: "VACATION" }); // missing employeeId, startDate, endDate
    expect(res.status).toBe(400);
  });

  it("returns 400 when time-off type is invalid", async () => {
    const res = await supertest(app)
      .post("/api/time-off")
      .set(auth)
      .send({
        employeeId: staff.id,
        type: "HOLIDAY", // not a valid enum value
        startDate: "2026-03-02",
        endDate: "2026-03-02",
      });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /api/time-off/:id/approve
// ═══════════════════════════════════════════════════════════════════════════════

describe("PUT /api/time-off/:id/approve", () => {
  it("returns 200 when a STAFF time-off request is approved (no coverage check needed)", async () => {
    const tor = makeTimeOff(staff, 0, 0, TimeOffStatus.PENDING);
    const prismaRow = prismaTimeOff(tor, staff);

    mockRepos.getTimeOffById.mockResolvedValue(prismaRow);
    mockRepos.updateRequestStatus.mockResolvedValue({ ...prismaRow, status: "APPROVED" });

    const res = await supertest(app)
      .put(`/api/time-off/${tor.id}/approve`)
      .set(auth)
      .send({ status: "APPROVED", approverId: "admin" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockRepos.updateRequestStatus).toHaveBeenCalledWith(tor.id, "APPROVED");
  });

  it("returns 200 when a time-off request is DENIED (skips coverage check)", async () => {
    const tor = makeTimeOff(manager1, 0, 0, TimeOffStatus.PENDING);
    const prismaRow = prismaTimeOff(tor, manager1, "mgr@test.com");

    mockRepos.getTimeOffById.mockResolvedValue(prismaRow);
    mockRepos.updateRequestStatus.mockResolvedValue({ ...prismaRow, status: "DENIED" });

    const res = await supertest(app)
      .put(`/api/time-off/${tor.id}/approve`)
      .set(auth)
      .send({ status: "DENIED", approverId: "admin" });

    expect(res.status).toBe(200);
    expect(mockRepos.getShiftsByWeek).not.toHaveBeenCalled(); // no coverage check for DENIED
  });

  it("returns 404 when the time-off request does not exist", async () => {
    mockRepos.getTimeOffById.mockResolvedValue(null);

    const res = await supertest(app)
      .put("/api/time-off/nonexistent/approve")
      .set(auth)
      .send({ status: "APPROVED", approverId: "admin" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 409 MANAGEMENT_COVERAGE_UNSAFE when approving leaves a shift uncovered", async () => {
    // manager1 takes Mon off; they are the only management on Monday's shift
    const tor = makeTimeOff(manager1, 0, 0, TimeOffStatus.PENDING);
    const prismaRow = prismaTimeOff(tor, manager1, "mgr@test.com");
    const monShift = weekShifts[0]!; // Monday mgmt shift

    mockRepos.getTimeOffById.mockResolvedValue(prismaRow);
    // Return Monday's shift
    mockRepos.getShiftsByWeek.mockResolvedValue([monShift]);
    // manager1 is the only assignment on the Monday shift
    mockRepos.getAssignmentsForWeek.mockResolvedValue([
      {
        employee_id: manager1.id,
        shift_id: monShift.id,
        shift_date: monShift.date,
        shift_start_time: monShift.start_time,
        shift_end_time: monShift.end_time,
        assigned_hours: 8,
        status: "SCHEDULED",
      },
    ]);
    // Only manager1 in the employee list — approving leaves no coverage
    mockRepos.getAllActiveEmployees.mockResolvedValue([manager1, ...staffEmployees]);

    const res = await supertest(app)
      .put(`/api/time-off/${tor.id}/approve`)
      .set(auth)
      .send({ status: "APPROVED", approverId: "admin" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("MANAGEMENT_COVERAGE_UNSAFE");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/shifts/swap
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /api/shifts/swap", () => {
  const assignmentRow = {
    id: "asgn-swap-1",
    employee_id: staff.id,
    shift_id: "shift-swap",
    assigned_hours: 8,
    shift: {
      id: "shift-swap",
      date: weekDay(0),
      start_time: weekDay(0, 9),
      end_time: weekDay(0, 17),
      duration_hours: 8,
      required_specialty: null,
      min_staff_count: 1,
      is_peak_shift: false,
      requires_management_presence: false,
    },
  };

  it("returns 201 when a valid swap request is created", async () => {
    const targetStaff = staffEmployees[1]!;
    mockRepos.getAssignmentWithDetails.mockResolvedValue(assignmentRow);
    mockSwap.createSwapRequest.mockResolvedValue({
      id: "swap-1",
      requester_id: staff.id,
      target_employee_id: targetStaff.id,
      assignment_id: assignmentRow.id,
      status: "PENDING",
      requester: { name: staff.name, email: "staff@test.com" },
      target_employee: { name: targetStaff.name, email: "staff2@test.com" },
      assignment: assignmentRow,
    });

    const res = await supertest(app)
      .post("/api/shifts/swap")
      .set(auth)
      .send({ assignmentId: assignmentRow.id, targetEmployeeId: targetStaff.id });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it("returns 400 when requester tries to swap with themselves", async () => {
    mockRepos.getAssignmentWithDetails.mockResolvedValue(assignmentRow);

    const res = await supertest(app)
      .post("/api/shifts/swap")
      .set(auth)
      .send({ assignmentId: assignmentRow.id, targetEmployeeId: staff.id }); // same employee

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_SWAP");
  });

  it("returns 404 when the assignment does not exist", async () => {
    mockRepos.getAssignmentWithDetails.mockResolvedValue(null);

    const res = await supertest(app)
      .post("/api/shifts/swap")
      .set(auth)
      .send({ assignmentId: "nonexistent", targetEmployeeId: staffEmployees[1]!.id });

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /api/shifts/swap/:id/approve
// ═══════════════════════════════════════════════════════════════════════════════

describe("PUT /api/shifts/swap/:id/approve", () => {
  const monShift = weekShifts[0]!;

  const pendingSwap = {
    id: "swap-pending",
    requester_id: staff.id,
    target_employee_id: staffEmployees[1]!.id,
    assignment_id: "asgn-1",
    status: "PENDING",
    manager_note: null,
    requester: { id: staff.id, name: staff.name, email: "staff@test.com", management_tier: "STAFF" },
    target_employee: { id: staffEmployees[1]!.id, name: "Staff 2", email: "staff2@test.com", management_tier: "STAFF" },
    assignment: {
      id: "asgn-1",
      shift_id: monShift.id,
      shift: {
        id: monShift.id,
        date: monShift.date,
        start_time: monShift.start_time,
        end_time: monShift.end_time,
        requires_management_presence: false,
        is_peak_shift: false,
      },
    },
  };

  it("returns 200 when a safe STAFF-to-STAFF swap is approved", async () => {
    mockSwap.getSwapRequestById.mockResolvedValue(pendingSwap);
    mockRepos.reassignAssignment.mockResolvedValue({});
    mockSwap.updateSwapStatus.mockResolvedValue({ ...pendingSwap, status: "APPROVED" });

    const res = await supertest(app)
      .put("/api/shifts/swap/swap-pending/approve")
      .set(auth)
      .send({ status: "APPROVED" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns 200 when a swap request is DENIED (no coverage check)", async () => {
    mockSwap.getSwapRequestById.mockResolvedValue(pendingSwap);
    mockSwap.updateSwapStatus.mockResolvedValue({ ...pendingSwap, status: "DENIED" });

    const res = await supertest(app)
      .put("/api/shifts/swap/swap-pending/approve")
      .set(auth)
      .send({ status: "DENIED" });

    expect(res.status).toBe(200);
  });

  it("returns 404 when the swap request does not exist", async () => {
    mockSwap.getSwapRequestById.mockResolvedValue(null);

    const res = await supertest(app)
      .put("/api/shifts/swap/nonexistent/approve")
      .set(auth)
      .send({ status: "APPROVED" });

    expect(res.status).toBe(404);
  });

  it("returns 409 ALREADY_RESOLVED when trying to approve a non-PENDING swap", async () => {
    mockSwap.getSwapRequestById.mockResolvedValue({ ...pendingSwap, status: "APPROVED" });

    const res = await supertest(app)
      .put("/api/shifts/swap/swap-pending/approve")
      .set(auth)
      .send({ status: "APPROVED" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ALREADY_RESOLVED");
  });

  it("returns 409 MANAGEMENT_COVERAGE_UNSAFE when swap removes last manager from a management-required shift", async () => {
    const mgrSwap = {
      ...pendingSwap,
      id: "swap-mgr",
      requester_id: manager1.id,
      target_employee_id: staff.id,
      requester: {
        id: manager1.id,
        name: manager1.name,
        email: "mgr@test.com",
        management_tier: "MANAGER",
      },
      target_employee: {
        id: staff.id,
        name: staff.name,
        email: "staff@test.com",
        management_tier: "STAFF",
      },
      assignment: {
        id: "asgn-mgr-shift",
        shift_id: "shift-mgmt-req",
        shift: {
          id: "shift-mgmt-req",
          date: monShift.date,
          start_time: monShift.start_time,
          end_time: monShift.end_time,
          requires_management_presence: true,
          is_peak_shift: false,
        },
      },
    };
    mockSwap.getSwapRequestById.mockResolvedValue(mgrSwap);
    // Only the manager is assigned to the shift (requester)
    mockSwap.getShiftAssignmentsWithEmployees.mockResolvedValue([
      {
        employee_id: manager1.id,
        employee: { management_tier: "MANAGER" },
      },
    ]);

    const res = await supertest(app)
      .put("/api/shifts/swap/swap-mgr/approve")
      .set(auth)
      .send({ status: "APPROVED" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("MANAGEMENT_COVERAGE_UNSAFE");
  });
});
