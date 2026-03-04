/**
 * Time-Off Route Tests (8 tests)
 *
 * POST   /api/time-off
 * PUT    /api/time-off/:id/approve
 * GET    /api/time-off
 * DELETE /api/time-off/:id
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import {
  mintTestToken,
  mockTimeOff,
  mockRawTimeOff,
  mockManagerRawTimeOff,
  mockEmployee,
  mockShift,
  mockEngineAssignment,
} from "./helpers.js";

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("../../repositories/index.js", () => ({
  getAllActiveEmployees: vi.fn().mockResolvedValue([]),
  getEmployeesByTier: vi.fn().mockResolvedValue([]),
  getEmployeeById: vi.fn().mockResolvedValue(null),
  createEmployee: vi.fn().mockResolvedValue({}),
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
  getRequestsByEmployee: vi.fn(),
  getTimeOffById: vi.fn(),
  createTimeOffRequest: vi.fn(),
  updateRequestStatus: vi.fn(),
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
  toEmployee: vi.fn((e: unknown) => e),
  toTimeOffRequest: vi.fn((t: unknown) => t),
  toShift: vi.fn((s: unknown) => s),
}));

vi.mock("../../scheduler/index.js", () => ({
  generateSchedule: vi.fn(),
}));

vi.mock("../../constraintEngine/index.js", () => ({
  managementTimeOffIsSafe: vi.fn(),
  shiftHasManagementCoverage: vi.fn().mockReturnValue(true),
  peakShiftHasManager: vi.fn().mockReturnValue(true),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import app from "../../app.js";
import * as repo from "../../repositories/index.js";
import * as engine from "../../constraintEngine/index.js";

const token = mintTestToken();

// ─── POST /api/time-off ───────────────────────────────────────────────────────

describe("POST /api/time-off", () => {
  it("returns 400 when required fields are missing", async () => {
    const res = await request(app)
      .post("/api/time-off")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 201 on successful creation", async () => {
    vi.mocked(repo.createTimeOffRequest).mockResolvedValue(mockTimeOff);

    const res = await request(app)
      .post("/api/time-off")
      .set("Authorization", `Bearer ${token}`)
      .send({
        employeeId: "emp-1",
        type: "VACATION",
        startDate: "2026-03-10",
        endDate: "2026-03-14",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

// ─── PUT /api/time-off/:id/approve ────────────────────────────────────────────

describe("PUT /api/time-off/:id/approve", () => {
  it("returns 404 when time-off request not found", async () => {
    vi.mocked(repo.getTimeOffById).mockResolvedValue(null);

    const res = await request(app)
      .put("/api/time-off/no-such-id/approve")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "APPROVED", approverId: "mgr-1" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 200 when DENIED (no coverage check needed)", async () => {
    vi.mocked(repo.getTimeOffById).mockResolvedValue(mockRawTimeOff as never);
    vi.mocked(repo.updateRequestStatus).mockResolvedValue(mockTimeOff);

    const res = await request(app)
      .put("/api/time-off/tof-1/approve")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "DENIED", approverId: "mgr-1" });

    expect(res.status).toBe(200);
    expect(repo.updateRequestStatus).toHaveBeenCalledWith("tof-1", "DENIED");
  });

  it("returns 200 when APPROVED for STAFF (no coverage check)", async () => {
    vi.mocked(repo.getTimeOffById).mockResolvedValue(mockRawTimeOff as never);
    // toEmployee returns STAFF employee
    vi.mocked(repo.toEmployee).mockReturnValue({
      id: "emp-2",
      name: "Bob",
      employment_type: "FULL_TIME",
      weekly_hours_target: 40,
      management_tier: "STAFF",
      specialties: [],
      seniority_level: 1,
      hierarchy_rank: 5,
    });
    vi.mocked(repo.updateRequestStatus).mockResolvedValue(mockTimeOff);

    const res = await request(app)
      .put("/api/time-off/tof-1/approve")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "APPROVED", approverId: "mgr-1" });

    expect(res.status).toBe(200);
    expect(engine.managementTimeOffIsSafe).not.toHaveBeenCalled();
  });

  it("returns 409 MANAGEMENT_COVERAGE_UNSAFE when manager time-off breaks coverage", async () => {
    vi.mocked(repo.getTimeOffById).mockResolvedValue(mockManagerRawTimeOff as never);
    vi.mocked(repo.toEmployee).mockReturnValue(mockEmployee as never);
    vi.mocked(repo.getShiftsByWeek).mockResolvedValue([mockShift as never]);
    vi.mocked(repo.getAssignmentsForWeek).mockResolvedValue([mockEngineAssignment]);
    vi.mocked(repo.getAllActiveEmployees).mockResolvedValue([mockEmployee as never]);
    vi.mocked(repo.toTimeOffRequest).mockReturnValue(mockTimeOff);
    vi.mocked(engine.managementTimeOffIsSafe).mockReturnValue({
      valid: false,
      blocking: true,
      reasons: ["Approving would leave shift without management coverage"],
    });

    const res = await request(app)
      .put("/api/time-off/tof-2/approve")
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "APPROVED", approverId: "mgr-1" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("MANAGEMENT_COVERAGE_UNSAFE");
  });
});

// ─── GET /api/time-off ────────────────────────────────────────────────────────

describe("GET /api/time-off", () => {
  it("returns 400 when employeeId is missing", async () => {
    const res = await request(app)
      .get("/api/time-off")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("returns 200 with requests for a valid employeeId", async () => {
    vi.mocked(repo.getRequestsByEmployee).mockResolvedValue([mockTimeOff]);

    const res = await request(app)
      .get("/api/time-off?employeeId=emp-1")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

// ─── DELETE /api/time-off/:id ─────────────────────────────────────────────────

describe("DELETE /api/time-off/:id", () => {
  it("returns 204 on successful deletion", async () => {
    vi.mocked(repo.getTimeOffById).mockResolvedValue(mockRawTimeOff as never);
    vi.mocked(repo.deleteTimeOffRequest).mockResolvedValue(undefined);

    const res = await request(app)
      .delete("/api/time-off/tof-1")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(204);
  });
});
