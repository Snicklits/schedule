/**
 * Auth Tests (6 tests)
 *
 * Verifies that:
 *  - /health is publicly accessible
 *  - /api/* routes require a valid JWT
 *  - Valid tokens allow access
 *  - Zod validation fires for bad request bodies
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { mintTestToken } from "./helpers.js";

// ─── Module mocks (hoisted) ───────────────────────────────────────────────────

vi.mock("../../repositories/index.js", () => ({
  getAllActiveEmployees: vi.fn().mockResolvedValue([]),
  getEmployeesByTier: vi.fn().mockResolvedValue([]),
  getEmployeeById: vi.fn().mockResolvedValue(null),
  createEmployee: vi.fn().mockResolvedValue({
    id: "emp-new",
    name: "Test",
    employment_type: "FULL_TIME",
    weekly_hours_target: 40,
    management_tier: "STAFF",
    specialties: [],
    seniority_level: 1,
    hierarchy_rank: 10,
  }),
  updateEmployee: vi.fn().mockResolvedValue({}),
  getShiftsByWeek: vi.fn().mockResolvedValue([]),
  getAllShifts: vi.fn().mockResolvedValue([]),
  getShiftById: vi.fn().mockResolvedValue(null),
  createShift: vi.fn().mockResolvedValue({}),
  updateShift: vi.fn().mockResolvedValue({}),
  deleteShift: vi.fn().mockResolvedValue(undefined),
  getAssignmentsForWeek: vi.fn().mockResolvedValue([]),
  getAssignmentsForWeekWithDetails: vi.fn().mockResolvedValue([]),
  getAssignmentWithDetails: vi.fn().mockResolvedValue(null),
  getAssignmentsForShift: vi.fn().mockResolvedValue([]),
  reassignAssignment: vi.fn().mockResolvedValue({}),
  getRequestsByEmployee: vi.fn().mockResolvedValue([]),
  getTimeOffById: vi.fn().mockResolvedValue(null),
  createTimeOffRequest: vi.fn().mockResolvedValue({}),
  updateRequestStatus: vi.fn().mockResolvedValue({}),
  deleteTimeOffRequest: vi.fn().mockResolvedValue(undefined),
  getApprovedTimeOffForWeek: vi.fn().mockResolvedValue([]),
  getPendingRequestsForWeek: vi.fn().mockResolvedValue([]),
  getActiveScheduleConfig: vi.fn().mockResolvedValue(null),
  saveScheduleGeneration: vi.fn().mockResolvedValue("run-id"),
  logViolation: vi.fn().mockResolvedValue({ id: "viol-1" }),
  logManagementOverride: vi.fn().mockResolvedValue({}),
  getLatestRunForWeek: vi.fn().mockResolvedValue(null),
  getShiftsLackingManagementCoverage: vi.fn().mockResolvedValue([]),
  getPeakShiftsWithManagerCheck: vi.fn().mockResolvedValue([]),
  getWeeklyHoursSummary: vi.fn().mockResolvedValue([]),
  getAllViolations: vi.fn().mockResolvedValue([]),
  getAllManagementGaps: vi.fn().mockResolvedValue([]),
  getAllPeakWindows: vi.fn().mockResolvedValue([]),
  createPeakWindow: vi.fn().mockResolvedValue({}),
  deletePeakWindow: vi.fn().mockResolvedValue(undefined),
  toEmployee: vi.fn().mockReturnValue({}),
  toTimeOffRequest: vi.fn().mockReturnValue({}),
  toShift: vi.fn().mockReturnValue({}),
}));

vi.mock("../../scheduler/index.js", () => ({
  generateSchedule: vi.fn(),
}));

vi.mock("../../constraintEngine/index.js", () => ({
  managementTimeOffIsSafe: vi.fn().mockReturnValue({ valid: true, blocking: false, reasons: [] }),
  shiftHasManagementCoverage: vi.fn().mockReturnValue(true),
  peakShiftHasManager: vi.fn().mockReturnValue(true),
}));

// ─── Import app after mocks ───────────────────────────────────────────────────

import app from "../../app.js";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Health endpoint (public)", () => {
  it("GET /health returns 200 without auth", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe("ok");
  });
});

describe("Auth middleware", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const res = await request(app).get("/api/employees");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 for an invalid token", async () => {
    const res = await request(app)
      .get("/api/employees")
      .set("Authorization", "Bearer not-a-valid-jwt");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 200 for a valid token", async () => {
    const token = mintTestToken();
    const res = await request(app)
      .get("/api/employees")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe("Employee creation validation", () => {
  const token = mintTestToken();

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Only Name" }); // missing email, employment_type, etc.
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 201 when all required fields are provided", async () => {
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "New Employee",
        email: "new@example.com",
        employment_type: "FULL_TIME",
        weekly_hours_target: 40,
        hire_date: "2026-01-01",
        seniority_level: 1,
        role: "Barista",
        hierarchy_rank: 10,
        management_tier: "STAFF",
        specialties: [],
      });
    expect(res.status).toBe(201);
  });
});
