/**
 * Coverage, Reports, Peak Windows, Employees, and Shifts Tests (12 tests)
 */

import { vi, describe, it, expect } from "vitest";
import request from "supertest";
import { mintTestToken, mockShift, mockEmployee } from "./helpers.js";

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("../../repositories/index.js", () => ({
  getAllActiveEmployees: vi.fn().mockResolvedValue([]),
  getEmployeesByTier: vi.fn().mockResolvedValue([]),
  getEmployeeById: vi.fn(),
  createEmployee: vi.fn().mockResolvedValue({}),
  updateEmployee: vi.fn().mockResolvedValue({}),
  getShiftsByWeek: vi.fn().mockResolvedValue([]),
  getAllShifts: vi.fn().mockResolvedValue([]),
  getShiftById: vi.fn(),
  createShift: vi.fn().mockResolvedValue({}),
  updateShift: vi.fn().mockResolvedValue({}),
  deleteShift: vi.fn().mockResolvedValue(undefined),
  markShiftAsPeak: vi.fn(),
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
  getShiftsLackingManagementCoverage: vi.fn(),
  getPeakShiftsWithManagerCheck: vi.fn(),
  getWeeklyHoursSummary: vi.fn(),
  getAllViolations: vi.fn(),
  getAllManagementGaps: vi.fn().mockResolvedValue([]),
  getAllPeakWindows: vi.fn(),
  createPeakWindow: vi.fn(),
  deletePeakWindow: vi.fn(),
  toEmployee: vi.fn((e: unknown) => e),
  toTimeOffRequest: vi.fn((t: unknown) => t),
  toShift: vi.fn((s: unknown) => s),
}));

vi.mock("../../scheduler/index.js", () => ({
  generateSchedule: vi.fn(),
}));

vi.mock("../../constraintEngine/index.js", () => ({
  managementTimeOffIsSafe: vi.fn().mockReturnValue({ valid: true, blocking: false, reasons: [] }),
  shiftHasManagementCoverage: vi.fn().mockReturnValue(true),
  peakShiftHasManager: vi.fn().mockReturnValue(true),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import app from "../../app.js";
import * as repo from "../../repositories/index.js";

const token = mintTestToken();

// ─── Coverage endpoints ───────────────────────────────────────────────────────

describe("GET /api/coverage/gaps", () => {
  it("returns 400 when weekStart is missing", async () => {
    const res = await request(app)
      .get("/api/coverage/gaps")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("returns 200 with gaps list", async () => {
    vi.mocked(repo.getShiftsLackingManagementCoverage).mockResolvedValue([mockShift as never]);

    const res = await request(app)
      .get("/api/coverage/gaps?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe("GET /api/coverage/peak", () => {
  it("returns 200 with only peak shifts missing a MANAGER", async () => {
    vi.mocked(repo.getPeakShiftsWithManagerCheck).mockResolvedValue([
      { shift: mockShift as never, hasManager: false },
      { shift: { ...mockShift, id: "shift-2" } as never, hasManager: true },
    ]);

    const res = await request(app)
      .get("/api/coverage/peak?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Only the one without a manager should be returned
    expect(res.body.data).toHaveLength(1);
  });
});

// ─── Reports endpoints ────────────────────────────────────────────────────────

describe("GET /api/reports/hours", () => {
  it("returns 200 with hours summary", async () => {
    vi.mocked(repo.getWeeklyHoursSummary).mockResolvedValue([
      { employeeId: "emp-1", name: "Alice", weeklyHours: 40, isAtCap: true },
    ]);

    const res = await request(app)
      .get("/api/reports/hours?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].isAtCap).toBe(true);
  });
});

describe("GET /api/reports/violations", () => {
  it("returns 200 with violations list filtered by type", async () => {
    vi.mocked(repo.getAllViolations).mockResolvedValue([
      {
        id: "v-1",
        schedule_run_id: "run-1",
        shift_id: "shift-1",
        employee_id: null,
        rule: "ManagementCoverageError",
        severity: "BLOCKING",
        message: "No manager",
        overridden_by: null,
        override_reason: null,
        override_at: null,
      },
    ]);

    const res = await request(app)
      .get("/api/reports/violations?type=BLOCKING&weekStart=2026-03-02")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

// ─── Peak window endpoints ────────────────────────────────────────────────────

describe("GET /api/peak-windows", () => {
  it("returns 200 with all peak windows", async () => {
    vi.mocked(repo.getAllPeakWindows).mockResolvedValue([
      { id: "pw-1", days: ["MON"], start_time: "11:00", end_time: "14:00", label: "Lunch" },
    ]);

    const res = await request(app)
      .get("/api/peak-windows")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe("POST /api/peak-windows", () => {
  it("returns 400 for invalid body", async () => {
    const res = await request(app)
      .post("/api/peak-windows")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("returns 201 on successful creation", async () => {
    vi.mocked(repo.createPeakWindow).mockResolvedValue({
      id: "pw-new",
      days: ["MON", "TUE"],
      start_time: "11:00",
      end_time: "14:00",
      label: "Lunch Peak",
    });

    const res = await request(app)
      .post("/api/peak-windows")
      .set("Authorization", `Bearer ${token}`)
      .send({ days: ["MON", "TUE"], startTime: "11:00", endTime: "14:00", label: "Lunch Peak" });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe("pw-new");
  });
});

describe("DELETE /api/peak-windows/:id", () => {
  it("returns 204 on successful deletion", async () => {
    vi.mocked(repo.deletePeakWindow).mockResolvedValue(undefined);

    const res = await request(app)
      .delete("/api/peak-windows/pw-1")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(204);
  });
});

// ─── Employee endpoints ───────────────────────────────────────────────────────

describe("GET /api/employees", () => {
  it("returns 200 with employee list (no filter)", async () => {
    vi.mocked(repo.getAllActiveEmployees).mockResolvedValue([mockEmployee as never]);

    const res = await request(app)
      .get("/api/employees")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe("GET /api/employees/:id", () => {
  it("returns 200 when employee exists", async () => {
    vi.mocked(repo.getEmployeeById).mockResolvedValue(mockEmployee as never);

    const res = await request(app)
      .get("/api/employees/emp-1")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe("emp-1");
  });

  it("returns 404 when employee does not exist", async () => {
    vi.mocked(repo.getEmployeeById).mockResolvedValue(null);

    const res = await request(app)
      .get("/api/employees/no-such-id")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

// ─── PUT /api/shifts/:id/mark-peak ───────────────────────────────────────────

describe("PUT /api/shifts/:id/mark-peak", () => {
  it("returns 404 when shift does not exist", async () => {
    vi.mocked(repo.getShiftById).mockResolvedValue(null);

    const res = await request(app)
      .put("/api/shifts/no-such-id/mark-peak")
      .set("Authorization", `Bearer ${token}`)
      .send({ isPeak: true });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 200 and marks the shift as peak", async () => {
    vi.mocked(repo.getShiftById).mockResolvedValue(mockShift as never);
    vi.mocked(repo.markShiftAsPeak).mockResolvedValue({ ...mockShift, is_peak_shift: true } as never);

    const res = await request(app)
      .put("/api/shifts/shift-1/mark-peak")
      .set("Authorization", `Bearer ${token}`)
      .send({ isPeak: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(repo.markShiftAsPeak).toHaveBeenCalledWith("shift-1", true);
  });

  it("returns 400 for missing isPeak field", async () => {
    const res = await request(app)
      .put("/api/shifts/shift-1/mark-peak")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/coverage/check/:weekStart ──────────────────────────────────────

describe("GET /api/coverage/check/:weekStart", () => {
  it("returns 200 with isFullyCovered true when no gaps", async () => {
    vi.mocked(repo.getShiftsLackingManagementCoverage).mockResolvedValue([]);
    vi.mocked(repo.getPeakShiftsWithManagerCheck).mockResolvedValue([]);

    const res = await request(app)
      .get("/api/coverage/check/2026-03-02")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isFullyCovered).toBe(true);
    expect(res.body.data.managementGaps).toHaveLength(0);
    expect(res.body.data.peakWithoutManager).toHaveLength(0);
  });

  it("returns 200 with isFullyCovered false when gaps exist", async () => {
    vi.mocked(repo.getShiftsLackingManagementCoverage).mockResolvedValue([mockShift as never]);
    vi.mocked(repo.getPeakShiftsWithManagerCheck).mockResolvedValue([
      { shift: mockShift as never, hasManager: false },
    ]);

    const res = await request(app)
      .get("/api/coverage/check/2026-03-02")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.isFullyCovered).toBe(false);
    expect(res.body.data.managementGaps).toHaveLength(1);
    expect(res.body.data.peakWithoutManager).toHaveLength(1);
  });

  it("returns 400 for an invalid date", async () => {
    const res = await request(app)
      .get("/api/coverage/check/not-a-date")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/reports/management-gaps ────────────────────────────────────────

describe("GET /api/reports/management-gaps", () => {
  it("returns 200 with all management gaps (no weekStart)", async () => {
    vi.mocked(repo.getAllManagementGaps).mockResolvedValue([
      { shift: mockShift as never, missingTier: "MANAGER_OR_AM" },
    ]);

    const res = await request(app)
      .get("/api/reports/management-gaps")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].missingTier).toBe("MANAGER_OR_AM");
  });

  it("returns 200 scoped to a week when weekStart is provided", async () => {
    vi.mocked(repo.getAllManagementGaps).mockResolvedValue([]);

    const res = await request(app)
      .get("/api/reports/management-gaps?weekStart=2026-03-02")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(repo.getAllManagementGaps).toHaveBeenCalledWith(expect.any(Date));
  });
});
