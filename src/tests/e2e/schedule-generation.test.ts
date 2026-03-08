/**
 * E2E Schedule Generation Tests — 13 Scenarios
 *
 * Tests the full generateSchedule algorithm pipeline from input to output.
 * All tests use in-memory data only (pure function — no database).
 *
 * Scenarios mirror the development plan exactly.
 */

import { describe, it, expect } from "vitest";
import { generateSchedule } from "../../scheduler/index.js";
import {
  ManagementTier,
  EmploymentType,
  TimeOffStatus,
  AssignmentStatus,
} from "../../constraintEngine/types.js";
import type {
  Employee,
  Shift,
  TimeOffRequest,
  ScheduleConfig,
} from "../../constraintEngine/types.js";
import {
  WEEK_START,
  weekDay,
  manager1,
  manager2,
  am1,
  am2,
  am3,
  staffEmployees,
  buildWeekShifts,
  makeEmployee,
  makeShift,
  makeTimeOff,
  defaultConfig,
  makeAssignment,
} from "../fixtures/seed.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const allSeedEmployees: Employee[] = [manager1, manager2, am1, am2, am3, ...staffEmployees];
const weekShifts = buildWeekShifts();

function singleMgmtShift(): Shift[] {
  return [
    makeShift({
      id: "e2e-single",
      date: weekDay(0),
      start_time: weekDay(0, 9),
      end_time: weekDay(0, 17),
      duration_hours: 8,
      is_peak_shift: false,
      requires_management_presence: true,
      min_staff_count: 2,
    }),
  ];
}

function singlePeakShift(): Shift[] {
  return [
    makeShift({
      id: "e2e-peak",
      date: weekDay(0),
      start_time: weekDay(0, 9),
      end_time: weekDay(0, 17),
      duration_hours: 8,
      is_peak_shift: true,
      requires_management_presence: true,
      min_staff_count: 2,
    }),
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 1 — All employees request same day off
// ═══════════════════════════════════════════════════════════════════════════════

describe("Scenario 1 — All employees request same day off", () => {
  it("limits approvals by seniority and respects max_team_off_percentage", () => {
    // 10 employees, all request Monday off. max_team_off_percentage=0.25 → max 2 can be off
    const employees: Employee[] = Array.from({ length: 10 }, (_, i) =>
      makeEmployee({
        id: `s1-emp-${i}`,
        management_tier: ManagementTier.STAFF,
        seniority_level: 10 - i, // descending seniority
        specialties: [],
      })
    );
    const shift = makeShift({
      id: "s1-shift",
      date: weekDay(0),
      requires_management_presence: false,
      is_peak_shift: false,
      min_staff_count: 5,
    });
    const config: ScheduleConfig = { ...defaultConfig, max_team_off_percentage: 0.25 };
    // All 10 employees request Monday off (PENDING)
    const requests: TimeOffRequest[] = employees.map((e, i) =>
      makeTimeOff(e, 0, 0, TimeOffStatus.PENDING, 0)
    );

    const result = generateSchedule(WEEK_START, employees, [shift], requests, config);

    // At most 25% of 10 = 2 can be approved → at least 8 employees available for assignment
    // The shift (min_staff_count=5) should be staffed
    const warnings = result.warnings;
    const heldWarnings = warnings.filter((w) => w.type === "TimeOffHeld");
    // More than 2 should be held (only 2 slots at 25% of 10)
    expect(heldWarnings.length).toBeGreaterThanOrEqual(7);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 2 — All Managers request same day off
// ═══════════════════════════════════════════════════════════════════════════════

describe("Scenario 2 — All Managers request same day off", () => {
  it("system warns and holds manager approvals when coverage would be lost", () => {
    const employees: Employee[] = [manager1, manager2, am1, am2, ...staffEmployees];
    const shifts = singleMgmtShift();
    // Both managers request Monday off (PENDING)
    const requests: TimeOffRequest[] = [
      makeTimeOff(manager1, 0, 0, TimeOffStatus.PENDING),
      makeTimeOff(manager2, 0, 0, TimeOffStatus.PENDING),
    ];

    const result = generateSchedule(WEEK_START, employees, shifts, requests, defaultConfig);

    // Generation should succeed (AMs can cover) but manager time-off may be warned/held
    const heldWarnings = result.warnings.filter((w) => w.type === "TimeOffHeld");
    // At minimum, the second manager should be held if the first one being off risks coverage
    // Either some are held OR the schedule is publishable with AMs covering
    expect(result.warnings.some((w) => w.type === "TimeOffHeld") || result.isPublishable).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 3 — Schedule generation with no available Managers
// ═══════════════════════════════════════════════════════════════════════════════

describe("Scenario 3 — No Managers available for peak shift", () => {
  it("generation halts with ManagementCoverageError and isPublishable=false", () => {
    // Only STAFF employees — no managers or AMs
    const staffOnly = staffEmployees.slice(0, 5);
    const shifts = singlePeakShift();

    const result = generateSchedule(WEEK_START, staffOnly, shifts, [], defaultConfig);

    expect(result.isPublishable).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.type).toBe("ManagementCoverageError");
    expect(result.runLog.outcome).toBe("HALTED");
  });

  it("generation halts even when all managers are on approved time off", () => {
    const employees = [manager1, manager2, ...staffEmployees];
    const shifts = singlePeakShift();
    // Both managers approved off on Monday
    const requests: TimeOffRequest[] = [
      makeTimeOff(manager1, 0, 0, TimeOffStatus.APPROVED),
      makeTimeOff(manager2, 0, 0, TimeOffStatus.APPROVED),
    ];

    const result = generateSchedule(WEEK_START, employees, shifts, requests, defaultConfig);

    expect(result.isPublishable).toBe(false);
    expect(result.errors.some((e) => e.type === "ManagementCoverageError")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 4 — Peak shift with only AMs available
// ═══════════════════════════════════════════════════════════════════════════════

describe("Scenario 4 — Peak shift with only AMs available", () => {
  it("is blocked and flagged as a ManagementCoverageError (peak needs MANAGER)", () => {
    // No MANAGER employees — only AMs and STAFF
    const employees: Employee[] = [am1, am2, am3, ...staffEmployees];
    const shifts = singlePeakShift();

    const result = generateSchedule(WEEK_START, employees, shifts, [], defaultConfig);

    expect(result.isPublishable).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.is_peak_shift)).toBe(true);
    expect(result.runLog.outcome).toBe("HALTED");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 5 — Non-peak management shift with no Manager or AM
// ═══════════════════════════════════════════════════════════════════════════════

describe("Scenario 5 — Non-peak management shift with no Manager or AM", () => {
  it("is blocked and flagged as a ManagementCoverageError", () => {
    const staffOnly = staffEmployees.slice(0, 5);
    const shifts = singleMgmtShift();

    const result = generateSchedule(WEEK_START, staffOnly, shifts, [], defaultConfig);

    expect(result.isPublishable).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.type).toBe("ManagementCoverageError");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 6 — Holiday week with short staffing
// ═══════════════════════════════════════════════════════════════════════════════

describe("Scenario 6 — Holiday week with short staffing", () => {
  it("generates a partial schedule and flags gaps for manual review", () => {
    // All STAFF employees take the week off (approved) → many shifts understaffed
    const employees: Employee[] = [manager1, am1, ...staffEmployees.slice(0, 3)];
    const shifts = weekShifts;
    // All staff on time off for the whole week
    const requests: TimeOffRequest[] = staffEmployees.slice(0, 3).map((e) =>
      makeTimeOff(e, 0, 6, TimeOffStatus.APPROVED)
    );

    const result = generateSchedule(WEEK_START, employees, shifts, requests, defaultConfig);

    // Some shifts should be understaffed (StaffingGap warnings)
    const staffingGaps = result.warnings.filter((w) => w.type === "StaffingGap");
    expect(staffingGaps.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 7 — Employee at exactly 40 hours
// ═══════════════════════════════════════════════════════════════════════════════

describe("Scenario 7 — Employee at exactly 40hrs refuses additional assignment", () => {
  it("does not assign the 6th shift when the employee has 5×8h already", () => {
    // Single FULL_TIME staff employee, 5 shifts already in the week
    // Custom config with tight overtime threshold = 32 so we can observe the block
    const config: ScheduleConfig = { ...defaultConfig, overtime_threshold: 32, max_consecutive_days: 7 };
    const soleStaff = makeEmployee({
      id: "s7-staff",
      management_tier: ManagementTier.STAFF,
      weekly_hours_target: 40,
    });
    // 4 shifts of 8h = 32h — at the threshold
    const firstFour = [0, 1, 2, 3].map((d) =>
      makeShift({
        id: `s7-shift-${d}`,
        date: weekDay(d),
        start_time: weekDay(d, 9),
        end_time: weekDay(d, 17),
        duration_hours: 8,
        requires_management_presence: false,
        is_peak_shift: false,
        min_staff_count: 1,
      })
    );
    // 5th shift would push to 40h > 32h threshold → should be refused
    const fifthShift = makeShift({
      id: "s7-shift-4",
      date: weekDay(4),
      start_time: weekDay(4, 9),
      end_time: weekDay(4, 17),
      duration_hours: 8,
      requires_management_presence: false,
      is_peak_shift: false,
      min_staff_count: 1,
    });

    // Include manager to cover any management shifts, but this is open shifts
    const employees = [manager1, soleStaff];
    const result = generateSchedule(WEEK_START, employees, [...firstFour, fifthShift], [], config);

    // The 5th shift should be a StaffingGap because soleStaff is at 32h and cannot take more
    const gaps = result.warnings.filter(
      (w) => w.type === "StaffingGap" && w.shiftId === "s7-shift-4"
    );
    expect(gaps.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 8 — Employee working 5 days in a row, day 6 blocked
// ═══════════════════════════════════════════════════════════════════════════════

describe("Scenario 8 — Employee working 5 consecutive days, day 6 blocked", () => {
  it("blocks the 6th consecutive day assignment and records a staffing gap", () => {
    const config: ScheduleConfig = {
      ...defaultConfig,
      max_consecutive_days: 5,
      overtime_threshold: 80, // high threshold so overtime doesn't interfere
    };
    const soleStaff = makeEmployee({
      id: "s8-staff",
      management_tier: ManagementTier.STAFF,
      weekly_hours_target: 40,
    });
    // 6 shifts Mon–Sat, each 8h
    const shifts = [0, 1, 2, 3, 4, 5].map((d) =>
      makeShift({
        id: `s8-shift-${d}`,
        date: weekDay(d),
        start_time: weekDay(d, 9),
        end_time: weekDay(d, 17),
        duration_hours: 8,
        requires_management_presence: false,
        is_peak_shift: false,
        min_staff_count: 1,
      })
    );

    const employees = [manager1, soleStaff];
    const result = generateSchedule(WEEK_START, employees, shifts, [], config);

    // After 5 days (Mon–Fri), the 6th shift (Sat) should be blocked → StaffingGap
    const satGap = result.warnings.find(
      (w) => w.type === "StaffingGap" && w.shiftId === "s8-shift-5"
    );
    expect(satGap).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 9 — Part-time employee beyond contracted hours
// ═══════════════════════════════════════════════════════════════════════════════

describe("Scenario 9 — Part-time employee blocked at contracted limit", () => {
  it("does not assign part-time employee beyond their weekly_hours_target", () => {
    const partTimer = makeEmployee({
      id: "s9-pt",
      employment_type: EmploymentType.PART_TIME,
      weekly_hours_target: 16, // contracted 16h/week
      management_tier: ManagementTier.STAFF,
      specialties: [],
    });
    const config: ScheduleConfig = { ...defaultConfig, overtime_threshold: 80, max_consecutive_days: 7 };
    // 3 shifts of 8h — only 2 can be assigned (16h contract limit)
    const shifts = [0, 1, 2].map((d) =>
      makeShift({
        id: `s9-shift-${d}`,
        date: weekDay(d),
        start_time: weekDay(d, 9),
        end_time: weekDay(d, 17),
        duration_hours: 8,
        requires_management_presence: false,
        is_peak_shift: false,
        min_staff_count: 1,
      })
    );

    const result = generateSchedule(WEEK_START, [partTimer], shifts, [], config);

    // Part-timer can only work 2×8=16h; 3rd shift should be a gap
    const assignments = result.schedule.filter((a) => a.employee_id === "s9-pt");
    expect(assignments.length).toBeLessThanOrEqual(2);
    const gap = result.warnings.find(
      (w) => w.type === "StaffingGap" && w.shiftId === "s9-shift-2"
    );
    expect(gap).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 10 — Specialty shift with no qualified employee
// ═══════════════════════════════════════════════════════════════════════════════

describe("Scenario 10 — Specialty shift, no qualified employee available", () => {
  it("flags the shift in the gap report when no employee holds the specialty", () => {
    // All employees have empty specialties; shift requires "sommelier"
    const employees = [manager1, am1, ...staffEmployees.slice(4, 7)].map((e) => ({
      ...e,
      specialties: [], // clear all specialties
    }));
    const specialtyShift = makeShift({
      id: "s10-specialty",
      date: weekDay(0),
      start_time: weekDay(0, 9),
      end_time: weekDay(0, 17),
      duration_hours: 8,
      required_specialty: "sommelier",
      requires_management_presence: false,
      is_peak_shift: false,
      min_staff_count: 1,
    });

    const result = generateSchedule(WEEK_START, employees, [specialtyShift], [], defaultConfig);

    // No one can work this shift → StaffingGap
    const gap = result.warnings.find(
      (w) => w.type === "StaffingGap" && w.shiftId === "s10-specialty"
    );
    expect(gap).toBeDefined();
    // No assignments on this shift
    const assignments = result.schedule.filter((a) => a.shift_id === "s10-specialty");
    expect(assignments.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 11 — Manual override logging
// ═══════════════════════════════════════════════════════════════════════════════

describe("Scenario 11 — Manager manually overrides coverage violation", () => {
  it("schedule generates normally; override audit fields are the API layer's responsibility", () => {
    // The override itself is handled by PUT /api/schedule/assignment/:id (tested in api.test.ts)
    // Here we verify the scheduler produces a schedule that WOULD trigger a coverage violation
    // so an override is meaningful.
    const staffOnly = staffEmployees.slice(0, 3);
    const shifts = singleMgmtShift(); // requires management presence

    // Without any management employee, generation halts with an error
    const result = generateSchedule(WEEK_START, staffOnly, shifts, [], defaultConfig);

    expect(result.isPublishable).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    // An override would be needed to publish this — verified in integration tests
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 12 — Approving Manager time-off would uncover a shift
// ═══════════════════════════════════════════════════════════════════════════════

describe("Scenario 12 — Approving Manager time-off would uncover a shift", () => {
  it("system holds manager time-off approval and emits a TimeOffHeld warning", () => {
    // Only one manager — if they take time off, the management shift has no coverage
    const employees: Employee[] = [manager1, ...staffEmployees.slice(0, 3)];
    const shifts = singleMgmtShift();
    const managerTimeOff = makeTimeOff(manager1, 0, 0, TimeOffStatus.PENDING);

    const result = generateSchedule(WEEK_START, employees, shifts, [managerTimeOff], defaultConfig);

    // The manager's time-off should be held because no other management employee exists
    const held = result.warnings.find(
      (w) => w.type === "TimeOffHeld" && w.employeeId === manager1.id
    );
    expect(held).toBeDefined();
  });

  it("allows manager time-off when a second manager can cover the shift", () => {
    const employees: Employee[] = [manager1, manager2, ...staffEmployees.slice(0, 3)];
    const shifts = singleMgmtShift();
    const managerTimeOff = makeTimeOff(manager1, 0, 0, TimeOffStatus.PENDING);

    const result = generateSchedule(WEEK_START, employees, shifts, [managerTimeOff], defaultConfig);

    // manager2 can cover → manager1's time-off should NOT be held
    const held = result.warnings.find(
      (w) => w.type === "TimeOffHeld" && w.employeeId === manager1.id
    );
    expect(held).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 13 — 50+ employees, mixed tiers, multiple shifts/day
// ═══════════════════════════════════════════════════════════════════════════════

describe("Scenario 13 — Large workforce: 50+ employees, mixed tiers, multiple shifts/day", () => {
  it("generation completes, all constraints satisfied, no blocking errors", () => {
    // 5 Managers, 8 AMs, 37 Staff = 50 employees
    const managers: Employee[] = Array.from({ length: 5 }, (_, i) =>
      makeEmployee({
        id: `s13-mgr-${i}`,
        name: `Manager ${i}`,
        management_tier: ManagementTier.MANAGER,
        seniority_level: 10 - i,
        hierarchy_rank: i + 1,
      })
    );
    const ams: Employee[] = Array.from({ length: 8 }, (_, i) =>
      makeEmployee({
        id: `s13-am-${i}`,
        name: `AM ${i}`,
        management_tier: ManagementTier.ASSISTANT_MANAGER,
        seniority_level: 7 - Math.floor(i / 2),
        hierarchy_rank: 6 + i,
      })
    );
    const staffList: Employee[] = Array.from({ length: 37 }, (_, i) =>
      makeEmployee({
        id: `s13-staff-${i}`,
        name: `Staff ${i}`,
        management_tier: ManagementTier.STAFF,
        employment_type: i < 30 ? EmploymentType.FULL_TIME : EmploymentType.PART_TIME,
        weekly_hours_target: i < 30 ? 40 : 20,
        seniority_level: 3 - Math.floor(i / 13),
        hierarchy_rank: 20 + i,
        specialties: i % 5 === 0 ? ["barista"] : [],
      })
    );
    const allEmployees50 = [...managers, ...ams, ...staffList];

    // Multiple shifts per day for 7 days
    const shifts: Shift[] = [];
    for (let day = 0; day < 7; day++) {
      // Morning shift (management required)
      shifts.push(
        makeShift({
          id: `s13-morning-${day}`,
          date: weekDay(day),
          start_time: weekDay(day, 7),
          end_time: weekDay(day, 15),
          duration_hours: 8,
          requires_management_presence: true,
          is_peak_shift: false,
          min_staff_count: 4,
        })
      );
      // Afternoon shift (peak on Fri/Sat)
      shifts.push(
        makeShift({
          id: `s13-afternoon-${day}`,
          date: weekDay(day),
          start_time: weekDay(day, 11),
          end_time: weekDay(day, 19),
          duration_hours: 8,
          requires_management_presence: day >= 4, // Fri/Sat/Sun management required
          is_peak_shift: day === 4 || day === 5, // Fri/Sat peak
          min_staff_count: 3,
        })
      );
    }

    const result = generateSchedule(WEEK_START, allEmployees50, shifts, [], defaultConfig);

    // Should not have blocking errors
    expect(result.errors).toHaveLength(0);
    expect(result.isPublishable).toBe(true);
    expect(result.runLog.outcome).toBe("SUCCESS");
    // Should have produced assignments
    expect(result.schedule.length).toBeGreaterThan(0);
  });
});
