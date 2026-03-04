/**
 * Schedule Route Tests (9 tests)
 *
 * POST /api/schedule/generate
 * GET  /api/schedule/:weekStart
 * PUT  /api/schedule/assignment/:id
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import {
  mintTestToken,
  mockConfig,
  mockEmployee,
  mockRawAssignment,
  mockEngineAssignment,
  mockScheduleResult,
  mockHaltedResult,
} from "./helpers.js";

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("../../repositories/index.js", () => ({
  getAllActiveEmployees: vi.fn(),
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
  getAssignmentsForWeekWithDetails: vi.fn(),
  getAssignmentWithDetails: vi.fn(),
  getAssignmentsForShift: vi.fn(),
  reassignAssignment: vi.fn(),
  getRequestsByEmployee: vi.fn().mockResolvedValue([]),
  getTimeOffById: vi.fn().mockResolvedValue(null),
  createTimeOffRequest: vi.fn().mockResolvedValue({}),
  updateRequestStatus: vi.fn().mockResolvedValue({}),
  deleteTimeOffRequest: vi.fn().mockResolvedValue(undefined),
  getApprovedTimeOffForWeek: vi.fn().mockResolvedValue([]),
  getPendingRequestsForWeek: vi.fn().mockResolvedValue([]),
  getActiveScheduleConfig: vi.fn(),
  saveScheduleGeneration: vi.fn().mockResolvedValue("run-id-123"),
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
  managementTimeOffIsSafe: vi.fn().mockReturnValue({ valid: true, blocking: false, reasons: [] }),
  shiftHasManagementCoverage: vi.fn(),
  peakShiftHasManager: vi.fn().mockReturnValue(true),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import app from "../../app.js";
import * as repo from "../../repositories/index.js";
import * as scheduler from "../../scheduler/index.js";
import * as engine from "../../constraintEngine/index.js";

const token = mintTestToken();

// ─── POST /api/schedule/generate ─────────────────────────────────────────────

describe("POST /api/schedule/generate", () => {
  beforeEach(() => {
    vi.mocked(repo.getAllActiveEmployees).mockResolvedValue([]);
    vi.mocked(repo.getShiftsByWeek).mockResolvedValue([]);
    vi.mocked(repo.getApprovedTimeOffForWeek).mockResolvedValue([]);
    vi.mocked(repo.getPendingRequestsForWeek).mockResolvedValue([]);
    vi.mocked(repo.saveScheduleGeneration).mockResolvedValue("run-id-123");
  });

  it("returns 422 CONFIG_NOT_FOUND when no config exists", async () => {
    vi.mocked(repo.getActiveScheduleConfig).mockResolvedValue(null);

    const res = await request(app)
      .post("/api/schedule/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ weekStart: "2026-03-02" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("CONFIG_NOT_FOUND");
  });

  it("returns 201 with runId and schedule on success", async () => {
    vi.mocked(repo.getActiveScheduleConfig).mockResolvedValue(mockConfig);
    vi.mocked(scheduler.generateSchedule).mockReturnValue(mockScheduleResult);

    const res = await request(app)
      .post("/api/schedule/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ weekStart: "2026-03-02" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.runId).toBe("run-id-123");
  });

  it("returns 422 MANAGEMENT_COVERAGE_ERROR when schedule is HALTED", async () => {
    vi.mocked(repo.getActiveScheduleConfig).mockResolvedValue(mockConfig);
    vi.mocked(scheduler.generateSchedule).mockReturnValue(mockHaltedResult);

    const res = await request(app)
      .post("/api/schedule/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ weekStart: "2026-03-02" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("MANAGEMENT_COVERAGE_ERROR");
    expect(res.body.error.details.errors).toHaveLength(1);
  });

  it("returns 400 for invalid body (missing weekStart)", async () => {
    const res = await request(app)
      .post("/api/schedule/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/schedule/:weekStart ─────────────────────────────────────────────

describe("GET /api/schedule/:weekStart", () => {
  it("returns 400 for an invalid date string", async () => {
    const res = await request(app)
      .get("/api/schedule/not-a-date")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it("returns 200 with assignment list for a valid date", async () => {
    vi.mocked(repo.getAssignmentsForWeekWithDetails).mockResolvedValue([]);

    const res = await request(app)
      .get("/api/schedule/2026-03-02")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ─── PUT /api/schedule/assignment/:id ────────────────────────────────────────

describe("PUT /api/schedule/assignment/:id", () => {
  it("returns 404 when assignment does not exist", async () => {
    vi.mocked(repo.getAssignmentWithDetails).mockResolvedValue(null);

    const res = await request(app)
      .put("/api/schedule/assignment/no-such-id")
      .set("Authorization", `Bearer ${token}`)
      .send({ employeeId: "emp-2" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 200 when reassignment does not break coverage", async () => {
    vi.mocked(repo.getAssignmentWithDetails).mockResolvedValue(mockRawAssignment as never);
    vi.mocked(repo.getAssignmentsForShift).mockResolvedValue([mockEngineAssignment]);
    vi.mocked(repo.getAllActiveEmployees).mockResolvedValue([mockEmployee as never]);
    vi.mocked(engine.shiftHasManagementCoverage).mockReturnValue(true);
    vi.mocked(repo.reassignAssignment).mockResolvedValue(mockRawAssignment as never);

    const res = await request(app)
      .put("/api/schedule/assignment/assign-1")
      .set("Authorization", `Bearer ${token}`)
      .send({ employeeId: "emp-2" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns 422 MANAGEMENT_COVERAGE_REQUIRED when coverage is broken and no reason", async () => {
    vi.mocked(repo.getAssignmentWithDetails).mockResolvedValue(mockRawAssignment as never);
    vi.mocked(repo.getAssignmentsForShift).mockResolvedValue([]);
    vi.mocked(repo.getAllActiveEmployees).mockResolvedValue([]);
    vi.mocked(engine.shiftHasManagementCoverage).mockReturnValue(false);

    const res = await request(app)
      .put("/api/schedule/assignment/assign-1")
      .set("Authorization", `Bearer ${token}`)
      .send({ employeeId: "emp-2" });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("MANAGEMENT_COVERAGE_REQUIRED");
  });

  it("returns 200 when coverage is broken but reason is provided", async () => {
    vi.mocked(repo.getAssignmentWithDetails).mockResolvedValue(mockRawAssignment as never);
    vi.mocked(repo.getAssignmentsForShift).mockResolvedValue([]);
    vi.mocked(repo.getAllActiveEmployees).mockResolvedValue([]);
    vi.mocked(engine.shiftHasManagementCoverage).mockReturnValue(false);
    vi.mocked(repo.getLatestRunForWeek).mockResolvedValue({ id: "run-1" } as never);
    vi.mocked(repo.logViolation).mockResolvedValue({ id: "viol-1" } as never);
    vi.mocked(repo.logManagementOverride).mockResolvedValue({} as never);
    vi.mocked(repo.reassignAssignment).mockResolvedValue(mockRawAssignment as never);

    const res = await request(app)
      .put("/api/schedule/assignment/assign-1")
      .set("Authorization", `Bearer ${token}`)
      .send({ employeeId: "emp-2", reason: "Emergency coverage needed" });

    expect(res.status).toBe(200);
    expect(repo.logViolation).toHaveBeenCalled();
    expect(repo.logManagementOverride).toHaveBeenCalled();
  });
});
