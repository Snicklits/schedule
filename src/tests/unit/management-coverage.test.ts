/**
 * Management Coverage — Dedicated Unit Tests  (Priority 2 & 3 BLOCKING rules)
 *
 * Tests run first because management coverage is the highest-priority class of
 * BLOCKING constraint.  Every function is covered with explicit pass and fail
 * cases for every scenario described in the development plan.
 *
 * Functions under test:
 *   • shiftHasManagementCoverage
 *   • peakShiftHasManager
 *   • managementTimeOffIsSafe
 */

import { describe, it, expect } from "vitest";
import {
  shiftHasManagementCoverage,
  peakShiftHasManager,
  managementTimeOffIsSafe,
} from "../../constraintEngine/index.js";
import {
  ManagementTier,
  EmploymentType,
  TimeOffStatus,
  AssignmentStatus,
} from "../../constraintEngine/types.js";
import type {
  Employee,
  Shift,
  Assignment,
  TimeOffRequest,
  WeekSchedule,
} from "../../constraintEngine/types.js";
import {
  WEEK_START,
  weekDay,
  manager1,
  manager2,
  am1,
  am2,
  staffEmployees,
  makeShift,
  makeAssignment,
  makeTimeOff,
} from "../fixtures/seed.js";

// ─── Local helpers ────────────────────────────────────────────────────────────

const staff = staffEmployees[0]!;
const staff2 = staffEmployees[1]!;

const regularShift: Shift = makeShift({
  id: "mc-reg",
  date: weekDay(0),
  start_time: weekDay(0, 9),
  end_time: weekDay(0, 17),
  is_peak_shift: false,
  requires_management_presence: true,
});

const peakShift: Shift = makeShift({
  id: "mc-peak",
  date: weekDay(1),
  start_time: weekDay(1, 11),
  end_time: weekDay(1, 19),
  is_peak_shift: true,
  requires_management_presence: true,
});

const openShift: Shift = makeShift({
  id: "mc-open",
  date: weekDay(2),
  requires_management_presence: false,
  is_peak_shift: false,
});

const allEmployees: Employee[] = [manager1, manager2, am1, am2, staff, staff2];

// ═══════════════════════════════════════════════════════════════════════════════
// shiftHasManagementCoverage
// ═══════════════════════════════════════════════════════════════════════════════

describe("shiftHasManagementCoverage", () => {
  it("PASS — returns true when a MANAGER is the sole assignee", () => {
    const assignments = [makeAssignment(manager1, regularShift)];
    expect(shiftHasManagementCoverage(regularShift, assignments, allEmployees)).toBe(true);
  });

  it("PASS — returns true when an ASSISTANT_MANAGER is assigned", () => {
    const assignments = [makeAssignment(am1, regularShift)];
    expect(shiftHasManagementCoverage(regularShift, assignments, allEmployees)).toBe(true);
  });

  it("PASS — returns true when both MANAGER and STAFF are assigned", () => {
    const assignments = [
      makeAssignment(manager1, regularShift),
      makeAssignment(staff, regularShift),
    ];
    expect(shiftHasManagementCoverage(regularShift, assignments, allEmployees)).toBe(true);
  });

  it("FAIL — returns false when only STAFF are assigned", () => {
    const assignments = [
      makeAssignment(staff, regularShift),
      makeAssignment(staff2, regularShift),
    ];
    expect(shiftHasManagementCoverage(regularShift, assignments, allEmployees)).toBe(false);
  });

  it("FAIL — returns false when there are no assignments at all", () => {
    expect(shiftHasManagementCoverage(regularShift, [], allEmployees)).toBe(false);
  });

  it("FAIL — ignores CANCELLED assignments (MANAGER cancelled → no coverage)", () => {
    const assignments = [
      makeAssignment(manager1, regularShift, AssignmentStatus.CANCELLED),
      makeAssignment(staff, regularShift),
    ];
    expect(shiftHasManagementCoverage(regularShift, assignments, allEmployees)).toBe(false);
  });

  it("PASS — counts non-cancelled MANAGER alongside cancelled STAFF", () => {
    const assignments = [
      makeAssignment(manager1, regularShift),
      makeAssignment(staff, regularShift, AssignmentStatus.CANCELLED),
    ];
    expect(shiftHasManagementCoverage(regularShift, assignments, allEmployees)).toBe(true);
  });

  it("FAIL — ignores assignments for a different shift", () => {
    // MANAGER is assigned to a different shift, not to regularShift
    const assignments = [makeAssignment(manager1, openShift)];
    expect(shiftHasManagementCoverage(regularShift, assignments, allEmployees)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// peakShiftHasManager
// ═══════════════════════════════════════════════════════════════════════════════

describe("peakShiftHasManager", () => {
  it("PASS — returns true when a MANAGER is assigned to the peak shift", () => {
    const assignments = [makeAssignment(manager1, peakShift)];
    expect(peakShiftHasManager(peakShift, assignments, allEmployees)).toBe(true);
  });

  it("PASS — returns true when MANAGER is assigned alongside STAFF", () => {
    const assignments = [
      makeAssignment(manager1, peakShift),
      makeAssignment(staff, peakShift),
    ];
    expect(peakShiftHasManager(peakShift, assignments, allEmployees)).toBe(true);
  });

  it("FAIL — returns false when only ASSISTANT_MANAGER is assigned (AM not sufficient for peak)", () => {
    const assignments = [makeAssignment(am1, peakShift)];
    expect(peakShiftHasManager(peakShift, assignments, allEmployees)).toBe(false);
  });

  it("FAIL — returns false when only STAFF are assigned", () => {
    const assignments = [makeAssignment(staff, peakShift)];
    expect(peakShiftHasManager(peakShift, assignments, allEmployees)).toBe(false);
  });

  it("FAIL — returns false when no one is assigned", () => {
    expect(peakShiftHasManager(peakShift, [], allEmployees)).toBe(false);
  });

  it("FAIL — ignores CANCELLED MANAGER assignments (cancelled manager ≠ coverage)", () => {
    const assignments = [
      makeAssignment(manager1, peakShift, AssignmentStatus.CANCELLED),
      makeAssignment(am1, peakShift),
    ];
    expect(peakShiftHasManager(peakShift, assignments, allEmployees)).toBe(false);
  });

  it("FAIL — AM assigned to peak and manager assigned to different shift → no peak manager", () => {
    const assignments = [
      makeAssignment(am1, peakShift),
      makeAssignment(manager1, regularShift), // different shift
    ];
    expect(peakShiftHasManager(peakShift, assignments, allEmployees)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// managementTimeOffIsSafe
// ═══════════════════════════════════════════════════════════════════════════════

describe("managementTimeOffIsSafe", () => {
  // Time-off for manager1 on Monday (offset 0)
  const mgrTimeOffMon: TimeOffRequest = makeTimeOff(
    manager1,
    0, // Mon
    0,
    TimeOffStatus.PENDING
  );

  // Time-off for am1 on Monday
  const amTimeOffMon: TimeOffRequest = makeTimeOff(
    am1,
    0,
    0,
    TimeOffStatus.PENDING
  );

  // ─── STAFF time-off (never affects management coverage) ──────────────────

  it("PASS — STAFF time-off is always safe (no management impact)", () => {
    const schedule: WeekSchedule = {
      shifts: [regularShift],
      assignments: [makeAssignment(staff, regularShift)],
    };
    const staffTimeOff = makeTimeOff(staff, 0, 0, TimeOffStatus.PENDING);
    const result = managementTimeOffIsSafe(staff, staffTimeOff, schedule, allEmployees);
    expect(result.valid).toBe(true);
    expect(result.blocking).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  // ─── MANAGER time-off with coverage intact ───────────────────────────────

  it("PASS — manager time off leaves coverage intact (second manager remains)", () => {
    const schedule: WeekSchedule = {
      shifts: [regularShift],
      assignments: [
        makeAssignment(manager1, regularShift),
        makeAssignment(manager2, regularShift),
      ],
    };
    const result = managementTimeOffIsSafe(
      manager1,
      mgrTimeOffMon,
      schedule,
      allEmployees
    );
    expect(result.valid).toBe(true);
    expect(result.blocking).toBe(false);
  });

  it("PASS — manager time off leaves coverage intact (AM remains on non-peak shift)", () => {
    const schedule: WeekSchedule = {
      shifts: [regularShift],
      assignments: [
        makeAssignment(manager1, regularShift),
        makeAssignment(am1, regularShift),
      ],
    };
    const result = managementTimeOffIsSafe(
      manager1,
      mgrTimeOffMon,
      schedule,
      allEmployees
    );
    expect(result.valid).toBe(true);
    expect(result.blocking).toBe(false);
  });

  it("PASS — manager not assigned to any shift during time-off period → always safe", () => {
    const schedule: WeekSchedule = {
      shifts: [regularShift],
      // manager1 NOT assigned — AM covers the shift
      assignments: [makeAssignment(am1, regularShift)],
    };
    const result = managementTimeOffIsSafe(
      manager1,
      mgrTimeOffMon,
      schedule,
      allEmployees
    );
    expect(result.valid).toBe(true);
  });

  // ─── MANAGER time-off leaves a shift uncovered ───────────────────────────

  it("FAIL — approving manager time-off leaves management-required shift uncovered", () => {
    const schedule: WeekSchedule = {
      shifts: [regularShift],
      // manager1 is the ONLY management employee on the shift
      assignments: [
        makeAssignment(manager1, regularShift),
        makeAssignment(staff, regularShift),
      ],
    };
    const result = managementTimeOffIsSafe(
      manager1,
      mgrTimeOffMon,
      schedule,
      allEmployees
    );
    expect(result.valid).toBe(false);
    expect(result.blocking).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons[0]).toMatch(/management coverage/i);
  });

  it("FAIL — approving manager time-off leaves peak shift without MANAGER (only AM remains)", () => {
    const timeOffTue = makeTimeOff(manager1, 1, 1, TimeOffStatus.PENDING);
    const schedule: WeekSchedule = {
      shifts: [peakShift],
      assignments: [
        makeAssignment(manager1, peakShift),
        makeAssignment(am1, peakShift), // AM stays but peak needs MANAGER
      ],
    };
    const result = managementTimeOffIsSafe(
      manager1,
      timeOffTue,
      schedule,
      allEmployees
    );
    expect(result.valid).toBe(false);
    expect(result.blocking).toBe(true);
    expect(result.reasons.some((r) => r.includes("peak shift"))).toBe(true);
  });

  // ─── AM time-off with Manager still present ──────────────────────────────

  it("PASS — AM time off with Manager still present on non-peak shift", () => {
    const schedule: WeekSchedule = {
      shifts: [regularShift],
      assignments: [
        makeAssignment(manager1, regularShift),
        makeAssignment(am1, regularShift),
      ],
    };
    const result = managementTimeOffIsSafe(
      am1,
      amTimeOffMon,
      schedule,
      allEmployees
    );
    expect(result.valid).toBe(true);
    expect(result.blocking).toBe(false);
  });

  it("FAIL — AM time off leaves non-peak shift with only STAFF coverage", () => {
    const schedule: WeekSchedule = {
      shifts: [regularShift],
      // AM is the only management employee
      assignments: [
        makeAssignment(am1, regularShift),
        makeAssignment(staff, regularShift),
      ],
    };
    const result = managementTimeOffIsSafe(
      am1,
      amTimeOffMon,
      schedule,
      allEmployees
    );
    expect(result.valid).toBe(false);
    expect(result.blocking).toBe(true);
  });

  // ─── Shift outside the time-off date range ───────────────────────────────

  it("PASS — shift falls outside time-off date range (no impact)", () => {
    // manager1 takes Monday off, but the only shift is on Wednesday
    const wedShift = makeShift({
      id: "mc-wed",
      date: weekDay(2),
      start_time: weekDay(2, 9),
      end_time: weekDay(2, 17),
      requires_management_presence: true,
    });
    const schedule: WeekSchedule = {
      shifts: [wedShift],
      assignments: [makeAssignment(manager1, wedShift)],
    };
    // time-off is only on Monday (offset 0)
    const result = managementTimeOffIsSafe(
      manager1,
      mgrTimeOffMon, // Mon only
      schedule,
      allEmployees
    );
    expect(result.valid).toBe(true);
  });

  // ─── Multi-day time-off spanning multiple shifts ──────────────────────────

  it("FAIL — multi-day time-off leaves multiple shifts uncovered", () => {
    const thuShift = makeShift({
      id: "mc-thu",
      date: weekDay(3),
      start_time: weekDay(3, 9),
      end_time: weekDay(3, 17),
      requires_management_presence: true,
    });
    const friShift = makeShift({
      id: "mc-fri",
      date: weekDay(4),
      start_time: weekDay(4, 9),
      end_time: weekDay(4, 17),
      requires_management_presence: true,
    });
    const schedule: WeekSchedule = {
      shifts: [thuShift, friShift],
      assignments: [
        makeAssignment(manager1, thuShift),
        makeAssignment(manager1, friShift),
      ],
    };
    // Manager1 takes Thu–Fri off, no other manager assigned
    const multiDayTimeOff = makeTimeOff(manager1, 3, 4, TimeOffStatus.PENDING);
    const result = managementTimeOffIsSafe(
      manager1,
      multiDayTimeOff,
      schedule,
      allEmployees
    );
    expect(result.valid).toBe(false);
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  });
});
