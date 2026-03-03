/**
 * Scheduler — Unit Tests (Phase 3)
 *
 * Organised into five sections matching the spec:
 *   1. Management Pre-fill
 *   2. General Assignment
 *   3. Output Structure
 *   4. Conflict Resolution
 *   5. scoreCandidateForShift
 */

import { describe, it, expect } from "vitest";
import { generateSchedule, resolveTimeOffConflicts, scoreCandidateForShift } from "./index.js";
import {
  ManagementTier,
  EmploymentType,
  TimeOffStatus,
  AssignmentStatus,
} from "../constraintEngine/types.js";
import type {
  Employee,
  Shift,
  TimeOffRequest,
  ScheduleConfig,
  Assignment,
} from "../constraintEngine/types.js";
import {
  WEEK_START,
  wd,
  allEmployees,
  standardWeekShifts,
  defaultConfig,
  mgr1, mgr2,
  am1, am2, am3,
  s1, s2, s3, s4, s5, s6, s7, s8, s9, s10,
  shiftMonDay, shiftMonEve, shiftTueDay, shiftWedDay,
  shiftThuPeak, shiftFriDay, shiftSatOpen,
} from "./fixtures.js";

// ─── Small helpers ────────────────────────────────────────────────────────────

function makeShift(overrides: Partial<Shift> & Pick<Shift, "id">): Shift {
  return {
    date: wd(0),
    start_time: wd(0, 9),
    end_time: wd(0, 17),
    duration_hours: 8,
    required_specialty: null,
    min_staff_count: 1,
    is_peak_shift: false,
    requires_management_presence: false,
    ...overrides,
  };
}

function approvedOff(employee: Employee, dayOffset: number): TimeOffRequest {
  return {
    id: `tor-${employee.id}-${dayOffset}`,
    employee_id: employee.id,
    start_date: wd(dayOffset),
    end_date: wd(dayOffset),
    status: TimeOffStatus.APPROVED,
    created_at: new Date("2026-02-01T00:00:00Z"),
  };
}

/** Employees excluding specific ones by id. */
function without(...ids: string[]): Employee[] {
  return allEmployees.filter((e) => !ids.includes(e.id));
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Management Pre-fill
// ═══════════════════════════════════════════════════════════════════════════

describe("Management Pre-fill", () => {
  it("halts with ManagementCoverageError when no Managers are available for a peak shift", () => {
    const peak: Shift = makeShift({
      id: "peak-only",
      is_peak_shift: true,
      requires_management_presence: true,
      min_staff_count: 1,
    });

    // Both managers on approved time off
    const timeOff = [approvedOff(mgr1, 0), approvedOff(mgr2, 0)];

    const result = generateSchedule(
      WEEK_START,
      allEmployees,
      [peak],
      timeOff,
      defaultConfig
    );

    expect(result.isPublishable).toBe(false);
    expect(result.runLog.outcome).toBe("HALTED");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].type).toBe("ManagementCoverageError");
    expect(result.errors[0].is_peak_shift).toBe(true);
    expect(result.errors[0].reason).toMatch(/No available Managers/i);
  });

  it("halts and flags correctly when only AMs are available for a peak shift", () => {
    const peak: Shift = makeShift({
      id: "peak-no-mgr",
      is_peak_shift: true,
      requires_management_presence: true,
      min_staff_count: 1,
    });

    // Remove managers entirely — only AMs and STAFF remain
    const employees = without("mgr-1", "mgr-2");

    const result = generateSchedule(
      WEEK_START,
      employees,
      [peak],
      [],
      defaultConfig
    );

    expect(result.isPublishable).toBe(false);
    expect(result.runLog.outcome).toBe("HALTED");
    expect(result.errors[0].is_peak_shift).toBe(true);
    expect(result.errors[0].reason).toMatch(/No available Managers/i);
  });

  it("halts when no Manager or AM is available for a management-required non-peak shift", () => {
    const mgmtShift: Shift = makeShift({
      id: "mgmt-only",
      is_peak_shift: false,
      requires_management_presence: true,
      min_staff_count: 1,
    });

    // All managers and AMs on time off
    const timeOff = [
      approvedOff(mgr1, 0), approvedOff(mgr2, 0),
      approvedOff(am1, 0),  approvedOff(am2, 0), approvedOff(am3, 0),
    ];

    const result = generateSchedule(
      WEEK_START,
      allEmployees,
      [mgmtShift],
      timeOff,
      defaultConfig
    );

    expect(result.isPublishable).toBe(false);
    expect(result.runLog.outcome).toBe("HALTED");
    expect(result.errors[0].type).toBe("ManagementCoverageError");
  });

  it("produces assignments with management coverage on all shifts in a normal week", () => {
    const result = generateSchedule(
      WEEK_START,
      allEmployees,
      standardWeekShifts,
      [],
      defaultConfig
    );

    // Every management-required shift should have coverage
    const mgmtShifts = standardWeekShifts.filter(
      (s) => s.requires_management_presence
    );
    for (const shift of mgmtShifts) {
      const shiftAssignments = result.schedule.filter(
        (a) => a.shift_id === shift.id
      );
      const assignedEmployees = shiftAssignments.map(
        (a) => allEmployees.find((e) => e.id === a.employee_id)!
      );
      const hasManagement = assignedEmployees.some(
        (e) =>
          e.management_tier === ManagementTier.MANAGER ||
          e.management_tier === ManagementTier.ASSISTANT_MANAGER
      );
      expect(hasManagement, `Shift ${shift.id} missing management coverage`).toBe(true);
    }

    // Peak shifts specifically need a MANAGER
    const peakShifts = standardWeekShifts.filter((s) => s.is_peak_shift);
    for (const shift of peakShifts) {
      const shiftAssignments = result.schedule.filter(
        (a) => a.shift_id === shift.id
      );
      const assignedEmployees = shiftAssignments.map(
        (a) => allEmployees.find((e) => e.id === a.employee_id)!
      );
      const hasManager = assignedEmployees.some(
        (e) => e.management_tier === ManagementTier.MANAGER
      );
      expect(hasManager, `Peak shift ${shift.id} missing MANAGER`).toBe(true);
    }
  });

  it("assigns the highest-seniority Manager to a peak shift", () => {
    const peak: Shift = makeShift({
      id: "peak-priority",
      date: wd(0),
      start_time: wd(0, 9),
      end_time: wd(0, 17),
      is_peak_shift: true,
      requires_management_presence: true,
      min_staff_count: 1,
    });

    const result = generateSchedule(WEEK_START, allEmployees, [peak], [], defaultConfig);

    expect(result.isPublishable).toBe(true);
    const mgrAssignment = result.schedule.find(
      (a) => a.shift_id === peak.id &&
             allEmployees.find((e) => e.id === a.employee_id)?.management_tier === ManagementTier.MANAGER
    );
    // mgr1 has higher seniority (10) than mgr2 (8) → should be assigned
    expect(mgrAssignment?.employee_id).toBe(mgr1.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. General Assignment
// ═══════════════════════════════════════════════════════════════════════════

describe("General Assignment", () => {
  it("does not assign additional shifts to a full-time employee already at 40h", () => {
    // Create a scenario where s1 has exactly 40h already (5 × 8h shifts Mon–Fri)
    // plus one extra open shift on Sat — s1 should not appear in the Sat assignment
    const shifts: Shift[] = [0, 1, 2, 3, 4].map((d) =>
      makeShift({
        id: `daily-${d}`,
        date: wd(d),
        start_time: wd(d, 9),
        end_time: wd(d, 17),
        duration_hours: 8,
        requires_management_presence: false,
        is_peak_shift: false,
        min_staff_count: 1,
      })
    );
    const satShift: Shift = makeShift({
      id: "sat-extra",
      date: wd(5),
      start_time: wd(5, 9),
      end_time: wd(5, 17),
      duration_hours: 8,
      requires_management_presence: false,
      min_staff_count: 1,
    });

    // Only s1 is in the pool — they will fill Mon–Fri (40h), then be blocked on Sat
    const result = generateSchedule(
      WEEK_START,
      [s1],
      [...shifts, satShift],
      [],
      defaultConfig
    );

    const satAssignments = result.schedule.filter(
      (a) => a.shift_id === satShift.id
    );
    expect(satAssignments.map((a) => a.employee_id)).not.toContain(s1.id);
  });

  it("does not assign a 6th consecutive day to an employee at the consecutive-day limit", () => {
    // 5 consecutive days of shifts, then a 6th
    const shifts: Shift[] = [0, 1, 2, 3, 4].map((d) =>
      makeShift({
        id: `consec-${d}`,
        date: wd(d),
        start_time: wd(d, 9),
        end_time: wd(d, 17),
        duration_hours: 8,
        requires_management_presence: false,
        min_staff_count: 1,
      })
    );
    const sixthShift: Shift = makeShift({
      id: "consec-6",
      date: wd(5),
      start_time: wd(5, 9),
      end_time: wd(5, 17),
      duration_hours: 8,
      requires_management_presence: false,
      min_staff_count: 1,
    });

    const result = generateSchedule(
      WEEK_START,
      [s3], // single STAFF employee, no specialties, FT 40h
      [...shifts, sixthShift],
      [],
      defaultConfig
    );

    // s3 should NOT appear on the 6th shift
    const sixthAssignments = result.schedule.filter(
      (a) => a.shift_id === sixthShift.id
    );
    expect(sixthAssignments.map((a) => a.employee_id)).not.toContain(s3.id);
  });

  it("only fills a specialty shift with qualified employees", () => {
    const baristaShift: Shift = makeShift({
      id: "barista-shift",
      date: wd(0),
      start_time: wd(0, 9),
      end_time: wd(0, 17),
      required_specialty: "barista",
      requires_management_presence: false,
      is_peak_shift: false,
      min_staff_count: 2,
    });

    // Use all staff — only barista-qualified ones should be assigned
    const staffOnly = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10];
    const baristaIds = staffOnly
      .filter((e) => e.specialties.includes("barista"))
      .map((e) => e.id); // s1, s4, s8

    const result = generateSchedule(
      WEEK_START,
      staffOnly,
      [baristaShift],
      [],
      defaultConfig
    );

    const assigned = result.schedule
      .filter((a) => a.shift_id === baristaShift.id)
      .map((a) => a.employee_id);

    // Every assigned employee must hold the barista specialty
    for (const empId of assigned) {
      expect(baristaIds).toContain(empId);
    }
    expect(assigned.length).toBeGreaterThan(0);
  });

  it("meets min_staff_count when enough candidates are available", () => {
    const shift: Shift = makeShift({
      id: "staff-fill",
      date: wd(0),
      start_time: wd(0, 9),
      end_time: wd(0, 17),
      requires_management_presence: false,
      is_peak_shift: false,
      min_staff_count: 3,
    });

    // Pool of 5 staff — more than enough
    const result = generateSchedule(
      WEEK_START,
      [s1, s2, s3, s5, s7],
      [shift],
      [],
      defaultConfig
    );

    const assignedCount = result.schedule.filter(
      (a) => a.shift_id === shift.id
    ).length;
    expect(assignedCount).toBe(3);
  });

  it("emits a StaffingGapWarning when min_staff_count cannot be met", () => {
    const shift: Shift = makeShift({
      id: "understaffed",
      date: wd(0),
      start_time: wd(0, 9),
      end_time: wd(0, 17),
      requires_management_presence: false,
      is_peak_shift: false,
      min_staff_count: 5,
      duration_hours: 8,
    });

    // Only 2 eligible staff employees
    const result = generateSchedule(
      WEEK_START,
      [s3, s7], // both FULL_TIME, no specialties, no conflicts
      [shift],
      [],
      defaultConfig
    );

    const gapWarnings = result.warnings.filter((w) => w.type === "StaffingGap");
    expect(gapWarnings.length).toBeGreaterThan(0);
    expect(gapWarnings[0].shiftId).toBe(shift.id);
  });

  it("assigns employees with most hours still needed (hours_gap scoring) preferentially", () => {
    // Both employees have identical seniority and hierarchy_rank so only
    // hours_gap and the ID tiebreaker differentiate them.
    //
    // IDs: 'alpha' < 'beta' lexicographically, so 'alpha' wins the shift1
    // tiebreaker.  After shift1, 'beta' is at 0 h while 'alpha' is at 8 h.
    // For shift2, 'beta' has the larger hours gap → higher score → wins.
    const alpha: Employee = {
      ...s3,
      id: "alpha",
      seniority_level: 3,
      hierarchy_rank: 8,
    };
    const beta: Employee = {
      ...s3,
      id: "beta",
      seniority_level: 3,
      hierarchy_rank: 8,
    };

    const shift1: Shift = makeShift({
      id: "hgap-shift-1",
      date: wd(0),
      start_time: wd(0, 9),
      end_time: wd(0, 17),
      duration_hours: 8,
      requires_management_presence: false,
      min_staff_count: 1, // 1 slot — 'alpha' wins by ID tiebreaker (a < b)
    });
    const shift2: Shift = makeShift({
      id: "hgap-shift-2",
      date: wd(1),
      start_time: wd(1, 9),
      end_time: wd(1, 17),
      duration_hours: 8,
      requires_management_presence: false,
      min_staff_count: 1, // 1 slot — 'beta' wins: 0 h worked → gap 40 > alpha's gap 32
    });

    const result = generateSchedule(
      WEEK_START,
      [alpha, beta],
      [shift1, shift2],
      [],
      defaultConfig
    );

    // alpha won shift1 by tiebreaker → beta has 0 h → larger gap → wins shift2
    const shift1Winner = result.schedule.find((a) => a.shift_id === shift1.id)?.employee_id;
    const shift2Winner = result.schedule.find((a) => a.shift_id === shift2.id)?.employee_id;
    expect(shift1Winner).toBe(alpha.id);
    expect(shift2Winner).toBe(beta.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Output Structure
// ═══════════════════════════════════════════════════════════════════════════

describe("Output Structure", () => {
  it("sets isPublishable=false when any ManagementCoverageError exists", () => {
    const peak: Shift = makeShift({
      id: "pub-peak",
      is_peak_shift: true,
      requires_management_presence: true,
      min_staff_count: 1,
    });
    const timeOff = [approvedOff(mgr1, 0), approvedOff(mgr2, 0)];

    const result = generateSchedule(WEEK_START, allEmployees, [peak], timeOff, defaultConfig);

    expect(result.isPublishable).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("sets isPublishable=true when only warnings exist (no blocking errors)", () => {
    // Shift that needs more staff than available → StaffingGapWarning only
    const openShift: Shift = makeShift({
      id: "warn-only",
      date: wd(0),
      start_time: wd(0, 9),
      end_time: wd(0, 17),
      requires_management_presence: false,
      is_peak_shift: false,
      min_staff_count: 10, // impossible to fill, but not a blocking error
    });

    const result = generateSchedule(
      WEEK_START,
      [s3, s7],
      [openShift],
      [],
      defaultConfig
    );

    expect(result.errors).toHaveLength(0);
    expect(result.isPublishable).toBe(true);
    expect(result.warnings.some((w) => w.type === "StaffingGap")).toBe(true);
  });

  it("includes a run log with timestamp, weekStart, and configSnapshot on success", () => {
    const result = generateSchedule(
      WEEK_START,
      allEmployees,
      standardWeekShifts,
      [],
      defaultConfig
    );

    expect(result.runLog.timestamp).toBeInstanceOf(Date);
    expect(result.runLog.weekStart.getTime()).toBe(WEEK_START.getTime());
    expect(result.runLog.configSnapshot.overtime_threshold).toBe(
      defaultConfig.overtime_threshold
    );
    expect(result.runLog.outcome).toBe("SUCCESS");
  });

  it("includes a run log with outcome=HALTED when management pre-fill fails", () => {
    const peak: Shift = makeShift({
      id: "halt-log",
      is_peak_shift: true,
      requires_management_presence: true,
      min_staff_count: 1,
    });
    const timeOff = [approvedOff(mgr1, 0), approvedOff(mgr2, 0)];

    const result = generateSchedule(WEEK_START, allEmployees, [peak], timeOff, defaultConfig);

    expect(result.runLog.outcome).toBe("HALTED");
    expect(result.runLog.errors.length).toBeGreaterThan(0);
  });

  it("configSnapshot in run log is a deep copy and not mutated by later changes", () => {
    const config: ScheduleConfig = { ...defaultConfig };
    const result = generateSchedule(WEEK_START, allEmployees, standardWeekShifts, [], config);

    // Mutate the original config after the call
    (config as ScheduleConfig).overtime_threshold = 999;

    // Snapshot should not reflect the mutation
    expect(result.runLog.configSnapshot.overtime_threshold).toBe(40);
  });

  it("result is deterministic: same inputs always produce the same schedule", () => {
    const r1 = generateSchedule(WEEK_START, allEmployees, standardWeekShifts, [], defaultConfig);
    const r2 = generateSchedule(WEEK_START, allEmployees, standardWeekShifts, [], defaultConfig);

    const ids1 = r1.schedule.map((a) => `${a.employee_id}:${a.shift_id}`).sort();
    const ids2 = r2.schedule.map((a) => `${a.employee_id}:${a.shift_id}`).sort();
    expect(ids1).toEqual(ids2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Conflict Resolution
// ═══════════════════════════════════════════════════════════════════════════

describe("Conflict Resolution", () => {
  it("approves the higher-seniority employee when team-off percentage limit is reached", () => {
    // Config: only 1 employee can be off per day (≤ 1/15 ≈ 6.7%), so limit = 7%
    const tightConfig: ScheduleConfig = {
      ...defaultConfig,
      max_team_off_percentage: 0.07, // ~1 person out of 15
    };

    const highSeniority: TimeOffRequest = {
      id: "tor-high",
      employee_id: s1.id, // seniority 4 — higher
      start_date: wd(0),
      end_date: wd(0),
      status: TimeOffStatus.PENDING,
      created_at: new Date("2026-02-10T10:00:00Z"),
    };
    const lowSeniority: TimeOffRequest = {
      id: "tor-low",
      employee_id: s10.id, // seniority 1 — lower
      start_date: wd(0),
      end_date: wd(0),
      status: TimeOffStatus.PENDING,
      created_at: new Date("2026-02-10T09:00:00Z"), // submitted earlier
    };

    const { approvedRequests, warnings } = resolveTimeOffConflicts(
      allEmployees,
      standardWeekShifts,
      [highSeniority, lowSeniority],
      tightConfig
    );

    const approvedIds = approvedRequests.map((r) => r.employee_id);

    // Higher seniority (s1) should be approved; lower seniority (s10) denied
    expect(approvedIds).toContain(s1.id);
    expect(approvedIds).not.toContain(s10.id);
    // A TimeOffHeld warning should explain the denial
    expect(warnings.some((w) => w.type === "TimeOffHeld" && w.employeeId === s10.id)).toBe(true);
  });

  it("approves first-come-first-served within the same seniority tier when limit allows only one", () => {
    const tightConfig: ScheduleConfig = {
      ...defaultConfig,
      max_team_off_percentage: 0.07, // ~1 out of 15
    };

    // s3 and s5 both have seniority 3 — FCFS should apply
    const firstRequest: TimeOffRequest = {
      id: "tor-fcfs-1",
      employee_id: s3.id,
      start_date: wd(2),
      end_date: wd(2),
      status: TimeOffStatus.PENDING,
      created_at: new Date("2026-02-05T08:00:00Z"), // earlier
    };
    const secondRequest: TimeOffRequest = {
      id: "tor-fcfs-2",
      employee_id: s5.id,
      start_date: wd(2),
      end_date: wd(2),
      status: TimeOffStatus.PENDING,
      created_at: new Date("2026-02-05T09:00:00Z"), // later
    };

    const { approvedRequests } = resolveTimeOffConflicts(
      allEmployees,
      standardWeekShifts,
      [firstRequest, secondRequest],
      tightConfig
    );

    const approvedIds = approvedRequests.map((r) => r.employee_id);
    expect(approvedIds).toContain(s3.id);
    expect(approvedIds).not.toContain(s5.id);
  });

  it("holds management time-off for manual review when no other management employee is available", () => {
    // Only mgr1 is management on a day with a management-required shift;
    // mgr2 is already approved off on the same day
    const mgr2Off: TimeOffRequest = {
      id: "tor-mgr2",
      employee_id: mgr2.id,
      start_date: wd(1), // Tuesday
      end_date: wd(1),
      status: TimeOffStatus.APPROVED,
      created_at: new Date("2026-02-01T00:00:00Z"),
    };

    // All AMs also approved off on Tuesday
    const amOffs: TimeOffRequest[] = [am1, am2, am3].map((e) => ({
      id: `tor-${e.id}-tue`,
      employee_id: e.id,
      start_date: wd(1),
      end_date: wd(1),
      status: TimeOffStatus.APPROVED,
      created_at: new Date("2026-02-01T00:00:00Z"),
    }));

    // Now mgr1 requests time off on Tuesday — should be HELD
    const mgr1Request: TimeOffRequest = {
      id: "tor-mgr1-tue",
      employee_id: mgr1.id,
      start_date: wd(1),
      end_date: wd(1),
      status: TimeOffStatus.PENDING,
      created_at: new Date("2026-02-10T10:00:00Z"),
    };

    const { approvedRequests, warnings } = resolveTimeOffConflicts(
      allEmployees,
      [shiftTueDay], // management-required shift on Tuesday
      [mgr2Off, ...amOffs, mgr1Request],
      defaultConfig
    );

    const approvedIds = approvedRequests.map((r) => r.employee_id);
    expect(approvedIds).not.toContain(mgr1.id);
    expect(
      warnings.some(
        (w) => w.type === "TimeOffHeld" && w.employeeId === mgr1.id
      )
    ).toBe(true);
  });

  it("respects already-APPROVED requests without re-processing them", () => {
    const alreadyApproved: TimeOffRequest = {
      id: "tor-existing",
      employee_id: s3.id,
      start_date: wd(0),
      end_date: wd(0),
      status: TimeOffStatus.APPROVED,
    };

    const { approvedRequests } = resolveTimeOffConflicts(
      allEmployees,
      standardWeekShifts,
      [alreadyApproved],
      defaultConfig
    );

    expect(approvedRequests.map((r) => r.employee_id)).toContain(s3.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. scoreCandidateForShift
// ═══════════════════════════════════════════════════════════════════════════

describe("scoreCandidateForShift", () => {
  const baseCtx = {
    weekStart: WEEK_START,
    assignments: [] as Assignment[],
    config: defaultConfig,
  };

  it("returns a higher score for an employee with higher seniority (all else equal)", () => {
    const shift = makeShift({ id: "score-shift" });
    const scoreS1 = scoreCandidateForShift(s1, shift, baseCtx); // seniority 4
    const scoreS7 = scoreCandidateForShift(s7, shift, baseCtx); // seniority 2
    expect(scoreS1).toBeGreaterThan(scoreS7);
  });

  it("returns a higher score for an employee with a larger hours gap", () => {
    const shift = makeShift({ id: "gap-shift" });

    // Give s3 8h of existing assignments (less gap)
    const existingAssignment: Assignment = {
      employee_id: s3.id,
      shift_id: "existing",
      shift_date: wd(0),
      shift_start_time: wd(0, 9),
      shift_end_time: wd(0, 17),
      assigned_hours: 8,
      status: AssignmentStatus.SCHEDULED,
    };
    const ctxWithAssignment = { ...baseCtx, assignments: [existingAssignment] };

    // s3 seniority 3, now has 8h → gap 32h
    const s3WithWork = scoreCandidateForShift(s3, shift, ctxWithAssignment);
    // Another s3-seniority employee at 0h → gap 40h → should score higher
    const freshEmployee: Employee = {
      ...s5,
      seniority_level: 3,
      hierarchy_rank: 8, // same as s3
    };
    const freshScore = scoreCandidateForShift(freshEmployee, shift, baseCtx);
    expect(freshScore).toBeGreaterThan(s3WithWork);
  });

  it("returns a lower score for an employee who has worked more undesirable shifts", () => {
    const shift = makeShift({ id: "fair-shift" });

    // Give s3 a Saturday (undesirable) assignment
    const satAssignment: Assignment = {
      employee_id: s3.id,
      shift_id: "sat-prev",
      shift_date: wd(5), // Saturday
      shift_start_time: wd(5, 10),
      shift_end_time: wd(5, 18),
      assigned_hours: 8,
      status: AssignmentStatus.SCHEDULED,
    };
    const ctxWithSat = { ...baseCtx, assignments: [satAssignment] };

    const scoreWithSat = scoreCandidateForShift(s3, shift, ctxWithSat);
    const scoreWithout = scoreCandidateForShift(s3, shift, baseCtx);
    expect(scoreWithout).toBeGreaterThan(scoreWithSat);
  });

  it("respects custom scoring weights from ScheduleConfig", () => {
    const shift = makeShift({ id: "weight-shift" });

    // With seniority weight = 0 and hours_gap weight = 100, hours gap dominates
    const customConfig: ScheduleConfig = {
      ...defaultConfig,
      scoring_weights: {
        seniority: 0,
        hours_gap: 100,
        fairness: 0,
        hierarchy_rank: 0,
      },
    };
    const ctx = { weekStart: WEEK_START, assignments: [], config: customConfig };

    // s1 has target 40h, s9 has target 16h — at 0h, s1 has larger gap
    const scoreS1 = scoreCandidateForShift(s1, shift, ctx);
    const scoreS9 = scoreCandidateForShift(s9, shift, ctx);
    expect(scoreS1).toBeGreaterThan(scoreS9);
  });

  it("is a pure function: identical inputs always return the same score", () => {
    const shift = makeShift({ id: "pure-shift" });
    const score1 = scoreCandidateForShift(s1, shift, baseCtx);
    const score2 = scoreCandidateForShift(s1, shift, baseCtx);
    expect(score1).toBe(score2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. peak_windows pre-processing
// ═══════════════════════════════════════════════════════════════════════════

describe("peak_windows pre-processing", () => {
  it("marks a shift as peak when it overlaps a configured peak window", () => {
    const nonPeakShift: Shift = makeShift({
      id: "pw-shift",
      date: wd(0),
      start_time: wd(0, 11),
      end_time: wd(0, 15),
      duration_hours: 4,
      is_peak_shift: false,       // NOT peak in input
      requires_management_presence: true,
      min_staff_count: 1,
    });

    const configWithWindows: ScheduleConfig = {
      ...defaultConfig,
      peak_windows: [{ start: "11:00", end: "14:00" }],
    };

    // With only AMs available, if the shift is treated as peak (needs MANAGER) it halts
    const amOnly = [am1, am2, am3, s1, s2];
    const result = generateSchedule(WEEK_START, amOnly, [nonPeakShift], [], configWithWindows);

    // The shift was re-flagged as peak → MANAGER required → none available → HALTED
    expect(result.runLog.outcome).toBe("HALTED");
    expect(result.errors[0].is_peak_shift).toBe(true);
  });

  it("does not alter a shift that does not overlap any peak window", () => {
    const shift: Shift = makeShift({
      id: "no-overlap",
      date: wd(0),
      start_time: wd(0, 8),
      end_time: wd(0, 11),
      duration_hours: 3,
      is_peak_shift: false,
      requires_management_presence: false,
      min_staff_count: 1,
    });

    const configWithWindows: ScheduleConfig = {
      ...defaultConfig,
      peak_windows: [{ start: "17:00", end: "22:00" }],
    };

    const result = generateSchedule(WEEK_START, [s3], [shift], [], configWithWindows);
    // Should NOT halt because the shift didn't get flagged as peak
    expect(result.errors).toHaveLength(0);
  });
});
