/**
 * Constraint Engine — Unit Tests (Phase 2)
 *
 * Covers every function exported from the engine, with a dedicated section
 * for management-coverage rules (the highest-priority / BLOCKING category).
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  isAvailable,
  getWeeklyHours,
  getConsecutiveDays,
  wouldCauseOvertime,
  wouldExceedConsecutiveDays,
  hasSpecialty,
  shiftHasManagementCoverage,
  peakShiftHasManager,
  managementTimeOffIsSafe,
  canWorkShift,
} from "./index.js";
import {
  ManagementTier,
  EmploymentType,
  TimeOffStatus,
  AssignmentStatus,
} from "./types.js";
import type {
  Employee,
  Shift,
  Assignment,
  TimeOffRequest,
  ScheduleConfig,
  CanWorkShiftContext,
  WeekSchedule,
} from "./types.js";

// ─── Shared Fixtures ────────────────────────────────────────────────────────

/** Default ScheduleConfig used throughout tests unless overridden. */
const defaultConfig: ScheduleConfig = {
  max_consecutive_days: 5,
  max_weekly_hours: 40,
  overtime_threshold: 40,
  min_rest_hours_between_shifts: 10,
  schedule_period_days: 7,
  max_team_off_percentage: 0.25,
};

// Reference week: Mon 2 Mar 2026
const WEEK_START = new Date("2026-03-02T00:00:00.000Z");

// Helper: build a Date for a given day offset within the reference week
function weekDay(offset: number, hour = 0, minute = 0): Date {
  const d = new Date(WEEK_START);
  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

// ── Employees ──────────────────────────────────────────────────────────────

const manager: Employee = {
  id: "emp-mgr",
  name: "Alice Manager",
  employment_type: EmploymentType.FULL_TIME,
  weekly_hours_target: 40,
  management_tier: ManagementTier.MANAGER,
  specialties: ["barista"],
};

const assistantManager: Employee = {
  id: "emp-amgr",
  name: "Bob Assistant",
  employment_type: EmploymentType.FULL_TIME,
  weekly_hours_target: 40,
  management_tier: ManagementTier.ASSISTANT_MANAGER,
  specialties: [],
};

const staffEmployee: Employee = {
  id: "emp-staff",
  name: "Carol Staff",
  employment_type: EmploymentType.FULL_TIME,
  weekly_hours_target: 40,
  management_tier: ManagementTier.STAFF,
  specialties: ["barista"],
};

const partTimeEmployee: Employee = {
  id: "emp-pt",
  name: "Dan Part-time",
  employment_type: EmploymentType.PART_TIME,
  weekly_hours_target: 20,
  management_tier: ManagementTier.STAFF,
  specialties: [],
};

const allEmployees: Employee[] = [
  manager,
  assistantManager,
  staffEmployee,
  partTimeEmployee,
];

// ── Shifts ─────────────────────────────────────────────────────────────────

/** Standard 8-hour weekday shift (Mon, requires management, not peak). */
const regularShift: Shift = {
  id: "shift-mon",
  date: weekDay(0),
  start_time: weekDay(0, 9),
  end_time: weekDay(0, 17),
  duration_hours: 8,
  required_specialty: null,
  min_staff_count: 2,
  is_peak_shift: false,
  requires_management_presence: true,
};

/** Peak shift on Tuesday — needs a MANAGER specifically. */
const peakShift: Shift = {
  id: "shift-peak",
  date: weekDay(1),
  start_time: weekDay(1, 9),
  end_time: weekDay(1, 17),
  duration_hours: 8,
  required_specialty: null,
  min_staff_count: 3,
  is_peak_shift: true,
  requires_management_presence: true,
};

/** Shift that requires the "barista" specialty. */
const specialtyShift: Shift = {
  id: "shift-spec",
  date: weekDay(2),
  start_time: weekDay(2, 9),
  end_time: weekDay(2, 17),
  duration_hours: 8,
  required_specialty: "barista",
  min_staff_count: 1,
  is_peak_shift: false,
  requires_management_presence: false,
};

/** Simple shift with no management requirement. */
const openShift: Shift = {
  id: "shift-open",
  date: weekDay(3),
  start_time: weekDay(3, 9),
  end_time: weekDay(3, 17),
  duration_hours: 8,
  required_specialty: null,
  min_staff_count: 1,
  is_peak_shift: false,
  requires_management_presence: false,
};

// ── Assignment builder ─────────────────────────────────────────────────────

function makeAssignment(
  employee: Employee,
  shift: Shift,
  status: Assignment["status"] = AssignmentStatus.SCHEDULED
): Assignment {
  return {
    employee_id: employee.id,
    shift_id: shift.id,
    shift_date: shift.date,
    shift_start_time: shift.start_time,
    shift_end_time: shift.end_time,
    assigned_hours: shift.duration_hours,
    status,
  };
}

// ── Context builder ────────────────────────────────────────────────────────

function makeContext(
  overrides: Partial<CanWorkShiftContext> = {}
): CanWorkShiftContext {
  return {
    weekStart: WEEK_START,
    assignments: [],
    employees: allEmployees,
    approvedTimeOff: [],
    config: defaultConfig,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

// ─── isAvailable ────────────────────────────────────────────────────────────

describe("isAvailable", () => {
  it("returns true when employee has no time-off requests", () => {
    expect(isAvailable(staffEmployee, weekDay(0), [])).toBe(true);
  });

  it("returns true when time-off request is PENDING (not yet approved)", () => {
    const req: TimeOffRequest = {
      id: "tor-1",
      employee_id: staffEmployee.id,
      start_date: weekDay(0),
      end_date: weekDay(0),
      status: TimeOffStatus.PENDING,
    };
    expect(isAvailable(staffEmployee, weekDay(0), [req])).toBe(true);
  });

  it("returns false when employee has APPROVED time-off on that date", () => {
    const req: TimeOffRequest = {
      id: "tor-2",
      employee_id: staffEmployee.id,
      start_date: weekDay(0),
      end_date: weekDay(2),
      status: TimeOffStatus.APPROVED,
    };
    expect(isAvailable(staffEmployee, weekDay(1), [req])).toBe(false);
  });

  it("returns true when approved time-off belongs to a different employee", () => {
    const req: TimeOffRequest = {
      id: "tor-3",
      employee_id: manager.id,
      start_date: weekDay(0),
      end_date: weekDay(4),
      status: TimeOffStatus.APPROVED,
    };
    expect(isAvailable(staffEmployee, weekDay(0), [req])).toBe(true);
  });
});

// ─── getWeeklyHours ─────────────────────────────────────────────────────────

describe("getWeeklyHours", () => {
  it("returns 0 when there are no assignments", () => {
    expect(getWeeklyHours(staffEmployee, WEEK_START, [])).toBe(0);
  });

  it("sums hours for the employee within the week", () => {
    const a1 = makeAssignment(staffEmployee, regularShift); // 8h Mon
    const a2 = makeAssignment(staffEmployee, peakShift);    // 8h Tue
    expect(getWeeklyHours(staffEmployee, WEEK_START, [a1, a2])).toBe(16);
  });

  it("ignores CANCELLED assignments", () => {
    const a1 = makeAssignment(staffEmployee, regularShift);
    const a2 = makeAssignment(staffEmployee, peakShift, AssignmentStatus.CANCELLED);
    expect(getWeeklyHours(staffEmployee, WEEK_START, [a1, a2])).toBe(8);
  });

  it("ignores assignments belonging to a different employee", () => {
    const a1 = makeAssignment(manager, regularShift); // different employee
    expect(getWeeklyHours(staffEmployee, WEEK_START, [a1])).toBe(0);
  });

  it("ignores assignments outside the 7-day window", () => {
    // Build a shift in the NEXT week
    const nextWeekShift: Shift = {
      ...regularShift,
      id: "shift-next",
      date: weekDay(7),
    };
    const a = makeAssignment(staffEmployee, nextWeekShift);
    expect(getWeeklyHours(staffEmployee, WEEK_START, [a])).toBe(0);
  });
});

// ─── getConsecutiveDays ──────────────────────────────────────────────────────

describe("getConsecutiveDays", () => {
  it("returns 0 when there are no prior assignments", () => {
    expect(getConsecutiveDays(staffEmployee, weekDay(4), [])).toBe(0);
  });

  it("counts consecutive days immediately before the target date", () => {
    // Mon, Tue, Wed assigned — checking Thursday
    const assignments = [
      makeAssignment(staffEmployee, regularShift),          // Mon (offset 0)
      makeAssignment(staffEmployee, peakShift),             // Tue (offset 1)
      makeAssignment(staffEmployee, specialtyShift),        // Wed (offset 2)
    ];
    // Thursday = weekDay(3)
    expect(getConsecutiveDays(staffEmployee, weekDay(3), assignments)).toBe(3);
  });

  it("stops counting at a gap in the schedule", () => {
    // Mon and Wed assigned (Tuesday is a gap) — checking Thursday
    const assignments = [
      makeAssignment(staffEmployee, regularShift),   // Mon
      makeAssignment(staffEmployee, specialtyShift), // Wed
    ];
    expect(getConsecutiveDays(staffEmployee, weekDay(3), assignments)).toBe(1);
  });
});

// ─── wouldCauseOvertime ──────────────────────────────────────────────────────

describe("wouldCauseOvertime", () => {
  it("returns false when employee has no existing hours", () => {
    expect(
      wouldCauseOvertime(staffEmployee, regularShift, WEEK_START, [], defaultConfig)
    ).toBe(false);
  });

  it("returns false when adding the shift stays at exactly the threshold", () => {
    // 32h existing + 8h shift = 40h (equal to threshold, not over)
    const shiftA: Shift = { ...openShift, id: "a", duration_hours: 8 };
    const shiftB: Shift = { ...openShift, id: "b", duration_hours: 8 };
    const shiftC: Shift = { ...openShift, id: "c", duration_hours: 8 };
    const shiftD: Shift = { ...openShift, id: "d", duration_hours: 8, date: weekDay(4), start_time: weekDay(4, 9), end_time: weekDay(4, 17) };
    const assignments = [
      makeAssignment(staffEmployee, shiftA),
      makeAssignment(staffEmployee, shiftB),
      makeAssignment(staffEmployee, shiftC),
    ];
    // 24h already; adding 8h new shift = 32h — still under 40
    expect(
      wouldCauseOvertime(staffEmployee, shiftD, WEEK_START, assignments, defaultConfig)
    ).toBe(false);
  });

  it("returns true when employee is at 40h and would go over", () => {
    // 5 × 8h shifts already assigned this week
    const weekShifts: Shift[] = [0, 1, 2, 3, 4].map((d) => ({
      ...openShift,
      id: `ot-${d}`,
      date: weekDay(d),
      start_time: weekDay(d, 8),
      end_time: weekDay(d, 16),
    }));
    const assignments = weekShifts.map((s) => makeAssignment(staffEmployee, s));

    // New shift on Sat (offset 5)
    const satShift: Shift = {
      ...openShift,
      id: "ot-5",
      date: weekDay(5),
      start_time: weekDay(5, 9),
      end_time: weekDay(5, 17),
    };
    expect(
      wouldCauseOvertime(staffEmployee, satShift, WEEK_START, assignments, defaultConfig)
    ).toBe(true);
  });
});

// ─── wouldExceedConsecutiveDays ──────────────────────────────────────────────

describe("wouldExceedConsecutiveDays", () => {
  it("returns false when the streak is below the limit", () => {
    const assignments = [0, 1, 2, 3].map((d) => {
      const s: Shift = { ...openShift, id: `cd-${d}`, date: weekDay(d) };
      return makeAssignment(staffEmployee, s);
    });
    // 4 consecutive days (Mon–Thu), checking Friday — streak would be 5 (≤ 5)
    expect(
      wouldExceedConsecutiveDays(staffEmployee, weekDay(4), assignments, defaultConfig)
    ).toBe(false);
  });

  it("returns true when the streak equals max_consecutive_days (adding one more exceeds it)", () => {
    const assignments = [0, 1, 2, 3, 4].map((d) => {
      const s: Shift = { ...openShift, id: `cd-${d}`, date: weekDay(d) };
      return makeAssignment(staffEmployee, s);
    });
    // 5 consecutive days already (Mon–Fri); adding Saturday would make 6 > 5
    expect(
      wouldExceedConsecutiveDays(staffEmployee, weekDay(5), assignments, defaultConfig)
    ).toBe(true);
  });
});

// ─── hasSpecialty ───────────────────────────────────────────────────────────

describe("hasSpecialty", () => {
  it("returns true when no specialty is required (null)", () => {
    expect(hasSpecialty(staffEmployee, null)).toBe(true);
  });

  it("returns true when employee holds the required specialty", () => {
    expect(hasSpecialty(staffEmployee, "barista")).toBe(true);
  });

  it("returns false when employee lacks the required specialty", () => {
    expect(hasSpecialty(assistantManager, "barista")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Management Coverage (dedicated section — BLOCKING rules)
// ═══════════════════════════════════════════════════════════════════════════

describe("Management Coverage", () => {
  // ── shiftHasManagementCoverage ──────────────────────────────────────────

  describe("shiftHasManagementCoverage", () => {
    it("returns false when there are no assignments at all", () => {
      expect(
        shiftHasManagementCoverage(regularShift, [], allEmployees)
      ).toBe(false);
    });

    it("returns false when only STAFF are assigned", () => {
      const a = makeAssignment(staffEmployee, regularShift);
      expect(
        shiftHasManagementCoverage(regularShift, [a], allEmployees)
      ).toBe(false);
    });

    it("returns true when an ASSISTANT_MANAGER is assigned", () => {
      const a = makeAssignment(assistantManager, regularShift);
      expect(
        shiftHasManagementCoverage(regularShift, [a], allEmployees)
      ).toBe(true);
    });

    it("returns true when a MANAGER is assigned", () => {
      const a = makeAssignment(manager, regularShift);
      expect(
        shiftHasManagementCoverage(regularShift, [a], allEmployees)
      ).toBe(true);
    });

    it("ignores CANCELLED assignments", () => {
      const a = makeAssignment(
        assistantManager,
        regularShift,
        AssignmentStatus.CANCELLED
      );
      expect(
        shiftHasManagementCoverage(regularShift, [a], allEmployees)
      ).toBe(false);
    });
  });

  // ── peakShiftHasManager ─────────────────────────────────────────────────

  describe("peakShiftHasManager", () => {
    it("returns false when no assignments exist", () => {
      expect(peakShiftHasManager(peakShift, [], allEmployees)).toBe(false);
    });

    it("returns false when only ASSISTANT_MANAGER is assigned (not enough for peak)", () => {
      const a = makeAssignment(assistantManager, peakShift);
      expect(peakShiftHasManager(peakShift, [a], allEmployees)).toBe(false);
    });

    it("returns false when only STAFF is assigned", () => {
      const a = makeAssignment(staffEmployee, peakShift);
      expect(peakShiftHasManager(peakShift, [a], allEmployees)).toBe(false);
    });

    it("returns true when a MANAGER is assigned", () => {
      const a = makeAssignment(manager, peakShift);
      expect(peakShiftHasManager(peakShift, [a], allEmployees)).toBe(true);
    });

    it("ignores CANCELLED assignments when checking for manager", () => {
      const a = makeAssignment(manager, peakShift, AssignmentStatus.CANCELLED);
      expect(peakShiftHasManager(peakShift, [a], allEmployees)).toBe(false);
    });
  });

  // ── managementTimeOffIsSafe ─────────────────────────────────────────────

  describe("managementTimeOffIsSafe", () => {
    const timeOffMon: TimeOffRequest = {
      id: "tor-mgr-mon",
      employee_id: manager.id,
      start_date: weekDay(0),
      end_date: weekDay(0),
      status: TimeOffStatus.PENDING,
    };

    it("returns valid for a STAFF employee (their absence never affects management coverage)", () => {
      const schedule: WeekSchedule = {
        shifts: [regularShift],
        assignments: [makeAssignment(staffEmployee, regularShift)],
      };
      const staffTimeOff: TimeOffRequest = {
        ...timeOffMon,
        id: "tor-staff",
        employee_id: staffEmployee.id,
      };
      const result = managementTimeOffIsSafe(
        staffEmployee,
        staffTimeOff,
        schedule,
        allEmployees
      );
      expect(result.valid).toBe(true);
    });

    it("returns valid when manager takes time off but another manager covers the shift", () => {
      const manager2: Employee = {
        ...manager,
        id: "emp-mgr2",
        name: "Eve Manager",
      };
      const schedule: WeekSchedule = {
        shifts: [regularShift],
        assignments: [
          makeAssignment(manager, regularShift),
          makeAssignment(manager2, regularShift),
        ],
      };
      const result = managementTimeOffIsSafe(
        manager,
        timeOffMon,
        schedule,
        [...allEmployees, manager2]
      );
      expect(result.valid).toBe(true);
    });

    it("returns invalid (blocking) when approving manager time-off leaves a shift without management coverage", () => {
      const schedule: WeekSchedule = {
        shifts: [regularShift],
        // Manager is the ONLY assigned employee — no coverage remains without them
        assignments: [makeAssignment(manager, regularShift)],
      };
      const result = managementTimeOffIsSafe(
        manager,
        timeOffMon,
        schedule,
        allEmployees
      );
      expect(result.valid).toBe(false);
      expect(result.blocking).toBe(true);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it("returns invalid when manager taking time-off leaves a peak shift without a MANAGER (only AM remains)", () => {
      const schedule: WeekSchedule = {
        shifts: [peakShift],
        assignments: [
          makeAssignment(manager, peakShift),
          makeAssignment(assistantManager, peakShift),
        ],
      };
      const timeOffTue: TimeOffRequest = {
        id: "tor-mgr-tue",
        employee_id: manager.id,
        start_date: weekDay(1),
        end_date: weekDay(1),
        status: TimeOffStatus.PENDING,
      };
      const result = managementTimeOffIsSafe(
        manager,
        timeOffTue,
        schedule,
        allEmployees
      );
      expect(result.valid).toBe(false);
      expect(result.blocking).toBe(true);
    });

    it("returns valid when manager is not assigned to any shift during their time-off", () => {
      const schedule: WeekSchedule = {
        shifts: [regularShift],
        // Manager is NOT assigned to the shift
        assignments: [makeAssignment(assistantManager, regularShift)],
      };
      const result = managementTimeOffIsSafe(
        manager,
        timeOffMon,
        schedule,
        allEmployees
      );
      expect(result.valid).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// canWorkShift — general constraints
// ═══════════════════════════════════════════════════════════════════════════

describe("canWorkShift", () => {
  // ── Valid baseline ──────────────────────────────────────────────────────

  it("returns valid with no reasons when all constraints are satisfied", () => {
    // Manager on a regular shift, no other violations
    const result = canWorkShift(
      manager,
      openShift, // no management requirement, no specialty, not peak
      makeContext()
    );
    expect(result.valid).toBe(true);
    expect(result.blocking).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  // ── Priority 1: Approved time off (BLOCKING) ────────────────────────────

  it("returns invalid+blocking when employee is on approved time off", () => {
    const req: TimeOffRequest = {
      id: "tor-a",
      employee_id: staffEmployee.id,
      start_date: openShift.date,
      end_date: openShift.date,
      status: TimeOffStatus.APPROVED,
    };
    const result = canWorkShift(
      staffEmployee,
      openShift,
      makeContext({ approvedTimeOff: [req] })
    );
    expect(result.valid).toBe(false);
    expect(result.blocking).toBe(true);
    expect(result.reasons.some((r) => r.includes("time off"))).toBe(true);
  });

  // ── Priority 2: Management coverage (BLOCKING) ──────────────────────────

  it("returns invalid+blocking when STAFF tries to be the only person on a management-required shift", () => {
    // regularShift requires management presence; no other assignees → STAFF alone can't satisfy it
    const result = canWorkShift(
      staffEmployee,
      regularShift,
      makeContext({ assignments: [] })
    );
    expect(result.valid).toBe(false);
    expect(result.blocking).toBe(true);
    expect(result.reasons.some((r) => r.includes("management presence"))).toBe(true);
  });

  it("returns valid when STAFF is added alongside an already-assigned manager", () => {
    const mgrAssignment = makeAssignment(manager, regularShift);
    const result = canWorkShift(
      staffEmployee,
      regularShift,
      makeContext({ assignments: [mgrAssignment] })
    );
    expect(result.valid).toBe(true);
  });

  // ── Priority 3: Peak-shift MANAGER requirement (BLOCKING) ───────────────

  it("returns invalid+blocking when ASSISTANT_MANAGER is the only candidate on a peak shift", () => {
    const result = canWorkShift(
      assistantManager,
      peakShift,
      makeContext({ assignments: [] })
    );
    expect(result.valid).toBe(false);
    expect(result.blocking).toBe(true);
    expect(result.reasons.some((r) => r.includes("Peak shift"))).toBe(true);
  });

  it("returns valid for a MANAGER on a peak shift", () => {
    const result = canWorkShift(manager, peakShift, makeContext());
    expect(result.valid).toBe(true);
  });

  // ── Priority 4: Overtime ────────────────────────────────────────────────

  it("returns invalid (non-blocking) when employee is at the overtime threshold", () => {
    // 5 × 8h = 40h already assigned (Mon–Fri)
    const existing = [0, 1, 2, 3, 4].map((d) => {
      const s: Shift = {
        ...openShift,
        id: `ot-${d}`,
        date: weekDay(d),
        start_time: weekDay(d, 8),
        end_time: weekDay(d, 16),
      };
      return makeAssignment(staffEmployee, s);
    });
    const satShift: Shift = {
      ...openShift,
      id: "ot-sat",
      date: weekDay(5),
      start_time: weekDay(5, 9),
      end_time: weekDay(5, 17),
    };
    const result = canWorkShift(
      staffEmployee,
      satShift,
      makeContext({ assignments: existing })
    );
    expect(result.valid).toBe(false);
    expect(result.blocking).toBe(false);
    expect(result.reasons.some((r) => r.includes("overtime"))).toBe(true);
  });

  // ── Priority 5: Max consecutive days ───────────────────────────────────

  it("returns invalid (non-blocking) when employee already has 5 consecutive days", () => {
    const existing = [0, 1, 2, 3, 4].map((d) => {
      const s: Shift = {
        ...openShift,
        id: `cs-${d}`,
        date: weekDay(d),
        start_time: weekDay(d, 9),
        end_time: weekDay(d, 17),
      };
      return makeAssignment(staffEmployee, s);
    });
    const satShift: Shift = {
      ...openShift,
      id: "cs-sat",
      date: weekDay(5),
      start_time: weekDay(5, 9),
      end_time: weekDay(5, 17),
    };
    const result = canWorkShift(
      staffEmployee,
      satShift,
      makeContext({ assignments: existing })
    );
    expect(result.valid).toBe(false);
    expect(result.blocking).toBe(false);
    expect(
      result.reasons.some((r) => r.includes("consecutive days"))
    ).toBe(true);
  });

  // ── Priority 6: Specialty mismatch ─────────────────────────────────────

  it("returns invalid (non-blocking) when employee lacks the required specialty", () => {
    // assistantManager has no specialties; specialtyShift requires "barista"
    const result = canWorkShift(
      assistantManager,
      specialtyShift,
      makeContext()
    );
    expect(result.valid).toBe(false);
    expect(result.blocking).toBe(false);
    expect(result.reasons.some((r) => r.includes("specialty"))).toBe(true);
  });

  // ── Priority 7: Minimum rest ────────────────────────────────────────────

  it("returns invalid (non-blocking) when there is insufficient rest before the shift", () => {
    // Previous shift ends at 23:00 Mon; new shift starts at 07:00 Tue → 8h gap < 10h minimum
    const nightShift: Shift = {
      ...openShift,
      id: "night",
      date: weekDay(0),
      start_time: weekDay(0, 15),
      end_time: weekDay(0, 23),
      duration_hours: 8,
    };
    const earlyShift: Shift = {
      ...openShift,
      id: "early",
      date: weekDay(1),
      start_time: weekDay(1, 7),
      end_time: weekDay(1, 15),
      duration_hours: 8,
    };
    const result = canWorkShift(
      staffEmployee,
      earlyShift,
      makeContext({ assignments: [makeAssignment(staffEmployee, nightShift)] })
    );
    expect(result.valid).toBe(false);
    expect(result.blocking).toBe(false);
    expect(result.reasons.some((r) => r.includes("rest"))).toBe(true);
  });

  // ── Priority 8: Part-time hour cap ─────────────────────────────────────

  it("returns invalid (non-blocking) when part-time employee would exceed contracted hours", () => {
    // Part-time cap is 20h; give them 16h of existing shifts this week
    const existing = [0, 1].map((d) => {
      const s: Shift = {
        ...openShift,
        id: `pt-${d}`,
        date: weekDay(d),
        start_time: weekDay(d, 9),
        end_time: weekDay(d, 17),
        duration_hours: 8,
      };
      return makeAssignment(partTimeEmployee, s);
    });
    // Trying to add an 8h shift would push to 24h > 20h cap
    const newShift: Shift = {
      ...openShift,
      id: "pt-new",
      date: weekDay(2),
      start_time: weekDay(2, 9),
      end_time: weekDay(2, 17),
      duration_hours: 8,
    };
    const result = canWorkShift(
      partTimeEmployee,
      newShift,
      makeContext({ assignments: existing })
    );
    expect(result.valid).toBe(false);
    expect(result.blocking).toBe(false);
    expect(
      result.reasons.some((r) => r.includes("contracted weekly hours"))
    ).toBe(true);
  });

  // ── All violations collected (no short-circuit) ─────────────────────────

  it("collects multiple independent violations in one pass", () => {
    // Set up: overtime AND specialty mismatch AND part-time cap all violated simultaneously
    const existing = [0, 1, 2, 3, 4].map((d) => {
      const s: Shift = {
        ...openShift,
        id: `multi-${d}`,
        date: weekDay(d),
        start_time: weekDay(d, 9),
        end_time: weekDay(d, 17),
        duration_hours: 8,
      };
      return makeAssignment(partTimeEmployee, s);
    });
    const extraShift: Shift = {
      ...specialtyShift, // requires "barista"
      id: "multi-extra",
      date: weekDay(5),
      start_time: weekDay(5, 9),
      end_time: weekDay(5, 17),
      duration_hours: 8,
    };
    const result = canWorkShift(
      partTimeEmployee, // no specialties, part-time cap already exceeded
      extraShift,
      makeContext({ assignments: existing })
    );
    expect(result.valid).toBe(false);
    // Should contain at least: overtime, consecutive days, specialty, part-time cap
    expect(result.reasons.length).toBeGreaterThanOrEqual(3);
  });

  // ── Blocking flag is false for warning-only violations ──────────────────

  it("sets blocking=false when only warning-level constraints are violated", () => {
    const existing = [0, 1, 2, 3, 4].map((d) => {
      const s: Shift = {
        ...openShift,
        id: `warn-${d}`,
        date: weekDay(d),
        start_time: weekDay(d, 9),
        end_time: weekDay(d, 17),
        duration_hours: 8,
      };
      return makeAssignment(staffEmployee, s);
    });
    const satShift: Shift = {
      ...openShift,
      id: "warn-sat",
      date: weekDay(5),
      start_time: weekDay(5, 9),
      end_time: weekDay(5, 17),
    };
    const result = canWorkShift(
      staffEmployee,
      satShift,
      makeContext({ assignments: existing })
    );
    expect(result.valid).toBe(false);
    expect(result.blocking).toBe(false);
  });
});
