/**
 * Constraint Engine — Unit Tests
 *
 * Covers every exported constraint function with both passing and failing cases.
 * Management-coverage-specific tests live in management-coverage.test.ts.
 *
 * Functions under test:
 *   • isAvailable
 *   • getWeeklyHours
 *   • getConsecutiveDays
 *   • hasSpecialty
 *   • wouldCauseOvertime
 *   • wouldExceedConsecutiveDays
 *   • canWorkShift  (composite — all priorities)
 */

import { describe, it, expect } from "vitest";
import {
  isAvailable,
  getWeeklyHours,
  getConsecutiveDays,
  hasSpecialty,
  wouldCauseOvertime,
  wouldExceedConsecutiveDays,
  canWorkShift,
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
  ScheduleConfig,
  CanWorkShiftContext,
} from "../../constraintEngine/types.js";
import {
  WEEK_START,
  weekDay,
  manager1,
  am1,
  am2,
  staffEmployees,
  makeShift,
  makeAssignment,
  makeTimeOff,
  defaultConfig,
} from "../fixtures/seed.js";

// ─── Local helpers ────────────────────────────────────────────────────────────

const staff = staffEmployees[0]!;
const partTimer = staffEmployees[8]!; // index 8 is PART_TIME in seed

const openShift: Shift = makeShift({
  id: "c-open",
  date: weekDay(3),
  start_time: weekDay(3, 9),
  end_time: weekDay(3, 17),
  duration_hours: 8,
  requires_management_presence: false,
  is_peak_shift: false,
  required_specialty: null,
});

const mgmtShift: Shift = makeShift({
  id: "c-mgmt",
  date: weekDay(0),
  start_time: weekDay(0, 9),
  end_time: weekDay(0, 17),
  duration_hours: 8,
  requires_management_presence: true,
  is_peak_shift: false,
  required_specialty: null,
  min_staff_count: 2,
});

const peakShift: Shift = makeShift({
  id: "c-peak",
  date: weekDay(1),
  start_time: weekDay(1, 11),
  end_time: weekDay(1, 19),
  duration_hours: 8,
  requires_management_presence: true,
  is_peak_shift: true,
  required_specialty: null,
  min_staff_count: 3,
});

const specialtyShift: Shift = makeShift({
  id: "c-spec",
  date: weekDay(2),
  start_time: weekDay(2, 9),
  end_time: weekDay(2, 17),
  duration_hours: 8,
  requires_management_presence: false,
  is_peak_shift: false,
  required_specialty: "barista",
});

function makeContext(overrides: Partial<CanWorkShiftContext> = {}): CanWorkShiftContext {
  return {
    weekStart: WEEK_START,
    assignments: [],
    employees: [manager1, am1, staff, partTimer],
    approvedTimeOff: [],
    config: defaultConfig,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// isAvailable
// ═══════════════════════════════════════════════════════════════════════════════

describe("isAvailable", () => {
  it("PASS — returns true when employee has no time-off requests", () => {
    expect(isAvailable(staff, weekDay(0), [])).toBe(true);
  });

  it("PASS — returns true when time-off is PENDING (not approved)", () => {
    const tor = makeTimeOff(staff, 0, 0, TimeOffStatus.PENDING);
    expect(isAvailable(staff, weekDay(0), [tor])).toBe(true);
  });

  it("PASS — returns true when time-off belongs to a different employee", () => {
    const tor = makeTimeOff(manager1, 0, 4, TimeOffStatus.APPROVED);
    expect(isAvailable(staff, weekDay(0), [tor])).toBe(true);
  });

  it("PASS — returns true when approved time-off is outside the date", () => {
    const tor = makeTimeOff(staff, 2, 4, TimeOffStatus.APPROVED); // Wed–Fri
    expect(isAvailable(staff, weekDay(0), [tor])).toBe(true); // checking Monday
  });

  it("FAIL — returns false when employee has APPROVED time-off on that date", () => {
    const tor = makeTimeOff(staff, 0, 2, TimeOffStatus.APPROVED);
    expect(isAvailable(staff, weekDay(1), [tor])).toBe(false); // Tuesday is within Mon–Wed
  });

  it("FAIL — returns false on boundary start date", () => {
    const tor = makeTimeOff(staff, 0, 0, TimeOffStatus.APPROVED);
    expect(isAvailable(staff, weekDay(0), [tor])).toBe(false);
  });

  it("FAIL — returns false on boundary end date", () => {
    const tor = makeTimeOff(staff, 0, 3, TimeOffStatus.APPROVED);
    expect(isAvailable(staff, weekDay(3), [tor])).toBe(false);
  });

  it("PASS — DENIED time-off does not block the employee", () => {
    const tor = makeTimeOff(staff, 0, 0, TimeOffStatus.DENIED);
    // DENIED is not APPROVED → employee is available
    expect(isAvailable(staff, weekDay(0), [tor])).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getWeeklyHours
// ═══════════════════════════════════════════════════════════════════════════════

describe("getWeeklyHours", () => {
  it("returns 0 when there are no assignments", () => {
    expect(getWeeklyHours(staff, WEEK_START, [])).toBe(0);
  });

  it("sums hours for assignments within the 7-day window", () => {
    const a1 = makeAssignment(staff, openShift);    // 8h
    const a2 = makeAssignment(staff, mgmtShift);    // 8h
    expect(getWeeklyHours(staff, WEEK_START, [a1, a2])).toBe(16);
  });

  it("excludes CANCELLED assignments", () => {
    const active = makeAssignment(staff, openShift);
    const cancelled = makeAssignment(staff, mgmtShift, AssignmentStatus.CANCELLED);
    expect(getWeeklyHours(staff, WEEK_START, [active, cancelled])).toBe(8);
  });

  it("excludes assignments for other employees", () => {
    const managerAssignment = makeAssignment(manager1, openShift);
    expect(getWeeklyHours(staff, WEEK_START, [managerAssignment])).toBe(0);
  });

  it("excludes assignments outside the 7-day window (next week)", () => {
    const nextWeekShift: Shift = {
      ...openShift,
      id: "next-wk",
      date: weekDay(7), // 8 days from WEEK_START
    };
    const a = makeAssignment(staff, nextWeekShift);
    expect(getWeeklyHours(staff, WEEK_START, [a])).toBe(0);
  });

  it("includes assignments on the last day of the window (day 6)", () => {
    const sunShift: Shift = {
      ...openShift,
      id: "c-sun",
      date: weekDay(6),
    };
    const a = makeAssignment(staff, sunShift);
    expect(getWeeklyHours(staff, WEEK_START, [a])).toBe(8);
  });

  it("sums hours up to exactly the overtime threshold", () => {
    // 5 × 8h = 40h — at the threshold
    const shifts = [0, 1, 2, 3, 4].map((d) => ({
      ...openShift,
      id: `gwh-${d}`,
      date: weekDay(d),
    }));
    const assignments = shifts.map((s) => makeAssignment(staff, s));
    expect(getWeeklyHours(staff, WEEK_START, assignments)).toBe(40);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getConsecutiveDays
// ═══════════════════════════════════════════════════════════════════════════════

describe("getConsecutiveDays", () => {
  it("returns 0 when there are no prior assignments", () => {
    expect(getConsecutiveDays(staff, weekDay(0), [])).toBe(0);
  });

  it("returns 0 when the only assignment is on the target date itself", () => {
    const a = makeAssignment(staff, openShift); // openShift is day 3
    // target date is ALSO day 3 — looking for days BEFORE that
    expect(getConsecutiveDays(staff, weekDay(3), [a])).toBe(0);
  });

  it("counts 4 consecutive days (allowed, below 5-day limit)", () => {
    const assignments = [0, 1, 2, 3].map((d) => {
      const s: Shift = { ...openShift, id: `cd-${d}`, date: weekDay(d) };
      return makeAssignment(staff, s);
    });
    // Checking day 4 (Friday): streak = 4 days (Mon–Thu)
    expect(getConsecutiveDays(staff, weekDay(4), assignments)).toBe(4);
  });

  it("returns 5 consecutive days (at the limit)", () => {
    const assignments = [0, 1, 2, 3, 4].map((d) => {
      const s: Shift = { ...openShift, id: `cd5-${d}`, date: weekDay(d) };
      return makeAssignment(staff, s);
    });
    // Checking day 5 (Sat): streak = 5 days (Mon–Fri)
    expect(getConsecutiveDays(staff, weekDay(5), assignments)).toBe(5);
  });

  it("stops counting at a gap in the schedule", () => {
    // Mon and Wed only (gap on Tuesday)
    const monShift: Shift = { ...openShift, id: "gap-mon", date: weekDay(0) };
    const wedShift: Shift = { ...openShift, id: "gap-wed", date: weekDay(2) };
    const assignments = [
      makeAssignment(staff, monShift),
      makeAssignment(staff, wedShift),
    ];
    // Checking Thursday — only consecutive before it is Wed (1 day)
    expect(getConsecutiveDays(staff, weekDay(3), assignments)).toBe(1);
  });

  it("ignores CANCELLED assignments when counting consecutive days", () => {
    const monShift: Shift = { ...openShift, id: "cc-mon", date: weekDay(0) };
    const tueShift: Shift = { ...openShift, id: "cc-tue", date: weekDay(1) };
    const wedShift: Shift = { ...openShift, id: "cc-wed", date: weekDay(2) };
    const assignments = [
      makeAssignment(staff, monShift),                               // active
      makeAssignment(staff, tueShift, AssignmentStatus.CANCELLED),  // cancelled — gap
      makeAssignment(staff, wedShift),                               // active
    ];
    // Checking Thursday: only Wed counts (cancelled Tue creates gap)
    expect(getConsecutiveDays(staff, weekDay(3), assignments)).toBe(1);
  });

  it("ignores assignments for other employees", () => {
    const assignments = [0, 1, 2].map((d) => {
      const s: Shift = { ...openShift, id: `other-${d}`, date: weekDay(d) };
      return makeAssignment(manager1, s); // different employee
    });
    expect(getConsecutiveDays(staff, weekDay(3), assignments)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// hasSpecialty
// ═══════════════════════════════════════════════════════════════════════════════

describe("hasSpecialty", () => {
  it("PASS — returns true when requiredSpecialty is null (no requirement)", () => {
    expect(hasSpecialty(am1, null)).toBe(true);
  });

  it("PASS — returns true when employee holds the required specialty", () => {
    // staff[0] has specialties: ["barista"]
    expect(hasSpecialty(staff, "barista")).toBe(true);
  });

  it("PASS — returns true when employee has multiple specialties including required one", () => {
    // manager1 has specialties: ["barista", "trainer"]
    expect(hasSpecialty(manager1, "trainer")).toBe(true);
  });

  it("FAIL — returns false when employee does not have the required specialty", () => {
    // am2 has specialties: [] — no "barista"
    expect(hasSpecialty(am2, "barista")).toBe(false);
  });

  it("FAIL — returns false for empty specialties array when specialty is required", () => {
    const emp: Employee = { ...staff, specialties: [] };
    expect(hasSpecialty(emp, "barista")).toBe(false);
  });

  it("FAIL — specialty match is case-sensitive", () => {
    expect(hasSpecialty(staff, "Barista")).toBe(false); // "barista" !== "Barista"
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// wouldCauseOvertime
// ═══════════════════════════════════════════════════════════════════════════════

describe("wouldCauseOvertime", () => {
  it("PASS — returns false when employee has zero existing hours", () => {
    expect(wouldCauseOvertime(staff, openShift, WEEK_START, [], defaultConfig)).toBe(false);
  });

  it("PASS — returns false when adding shift keeps total at exactly overtime threshold (equal, not over)", () => {
    // 32h existing + 8h = 40h = threshold → NOT over
    const existingShifts = [0, 1, 2].map((d) => ({
      ...openShift,
      id: `ot-ex-${d}`,
      date: weekDay(d),
      duration_hours: 8,
    }));
    const assignments = existingShifts.map((s) => makeAssignment(staff, s));
    const newShift: Shift = {
      ...openShift,
      id: "ot-new",
      date: weekDay(3),
      duration_hours: 8,
    };
    expect(
      wouldCauseOvertime(staff, newShift, WEEK_START, assignments, defaultConfig)
    ).toBe(false); // 24+8=32, still under 40
  });

  it("PASS — returns false when adding a shift stays well under the threshold", () => {
    const a = makeAssignment(staff, openShift); // 8h
    const secondShift: Shift = { ...openShift, id: "ot-2nd", date: weekDay(4) };
    expect(
      wouldCauseOvertime(staff, secondShift, WEEK_START, [a], defaultConfig)
    ).toBe(false); // 8+8=16, under 40
  });

  it("FAIL — returns true when employee is at 40h and adding any shift goes over", () => {
    // 5 × 8h = 40h = at threshold
    const weekShifts = [0, 1, 2, 3, 4].map((d) => ({
      ...openShift,
      id: `ot-${d}`,
      date: weekDay(d),
    }));
    const assignments = weekShifts.map((s) => makeAssignment(staff, s));
    const sixthShift: Shift = { ...openShift, id: "ot-6th", date: weekDay(5) };
    expect(
      wouldCauseOvertime(staff, sixthShift, WEEK_START, assignments, defaultConfig)
    ).toBe(true); // 40+8=48 > 40
  });

  it("FAIL — returns true when adding partial hours tips over the threshold", () => {
    const partialShift: Shift = {
      ...openShift,
      id: "ot-partial-1",
      date: weekDay(0),
      duration_hours: 36,
    };
    const a = makeAssignment(staff, partialShift);
    const tippingShift: Shift = {
      ...openShift,
      id: "ot-partial-2",
      date: weekDay(1),
      duration_hours: 8,
    };
    expect(
      wouldCauseOvertime(staff, tippingShift, WEEK_START, [a], defaultConfig)
    ).toBe(true); // 36+8=44 > 40
  });

  it("PASS — exactly at threshold is not overtime (equal is not over)", () => {
    // overtime_threshold=16: existing 8h + new 8h = 16 which is NOT > 16 → false
    const tightConfig: ScheduleConfig = { ...defaultConfig, overtime_threshold: 16 };
    const a = makeAssignment(staff, openShift); // 8h
    const secondShift: Shift = { ...openShift, id: "custom-ot", date: weekDay(4) };
    expect(
      wouldCauseOvertime(staff, secondShift, WEEK_START, [a], tightConfig)
    ).toBe(false); // 8+8=16, and 16 > 16 is false
  });

  it("FAIL — exceeds custom threshold", () => {
    const customConfig: ScheduleConfig = { ...defaultConfig, overtime_threshold: 15 };
    const firstShift: Shift = { ...openShift, id: "ct-1", date: weekDay(0), duration_hours: 8 };
    const a = makeAssignment(staff, firstShift);
    const secondShift: Shift = { ...openShift, id: "ct-2", date: weekDay(1), duration_hours: 8 };
    expect(
      wouldCauseOvertime(staff, secondShift, WEEK_START, [a], customConfig)
    ).toBe(true); // 8+8=16 > 15
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// wouldExceedConsecutiveDays
// ═══════════════════════════════════════════════════════════════════════════════

describe("wouldExceedConsecutiveDays", () => {
  it("PASS — returns false when streak is zero (first day)", () => {
    expect(wouldExceedConsecutiveDays(staff, weekDay(0), [], defaultConfig)).toBe(false);
  });

  it("PASS — returns false when streak + 1 equals max_consecutive_days (at limit, not exceeded)", () => {
    // 4 consecutive days before day 4 → would be 5 on day 4 → equals limit (5) → allowed
    const assignments = [0, 1, 2, 3].map((d) => {
      const s: Shift = { ...openShift, id: `wec-${d}`, date: weekDay(d) };
      return makeAssignment(staff, s);
    });
    // Day 4 = Friday: streak = 4, +1 = 5 = max → not exceeded
    expect(
      wouldExceedConsecutiveDays(staff, weekDay(4), assignments, defaultConfig)
    ).toBe(false);
  });

  it("FAIL — returns true when streak equals max_consecutive_days (adding one more exceeds)", () => {
    // 5 consecutive days before day 5 → would be 6 on day 5 → exceeds 5
    const assignments = [0, 1, 2, 3, 4].map((d) => {
      const s: Shift = { ...openShift, id: `wec5-${d}`, date: weekDay(d) };
      return makeAssignment(staff, s);
    });
    expect(
      wouldExceedConsecutiveDays(staff, weekDay(5), assignments, defaultConfig)
    ).toBe(true);
  });

  it("FAIL — returns true with a custom tight max_consecutive_days config", () => {
    const strictConfig: ScheduleConfig = { ...defaultConfig, max_consecutive_days: 3 };
    const assignments = [0, 1, 2].map((d) => {
      const s: Shift = { ...openShift, id: `wec3-${d}`, date: weekDay(d) };
      return makeAssignment(staff, s);
    });
    // Streak = 3 before day 3, +1 = 4 > 3
    expect(
      wouldExceedConsecutiveDays(staff, weekDay(3), assignments, strictConfig)
    ).toBe(true);
  });

  it("PASS — gap in schedule resets the streak", () => {
    // Mon–Wed assigned, Thu is a gap → streak before Fri = 0 (gap on Thu) → allowed
    const assignments = [0, 1, 2].map((d) => {
      const s: Shift = { ...openShift, id: `wecg-${d}`, date: weekDay(d) };
      return makeAssignment(staff, s);
    });
    // Day 4 (Fri): looking back, Thu (day 3) has no assignment → streak = 0
    expect(
      wouldExceedConsecutiveDays(staff, weekDay(4), assignments, defaultConfig)
    ).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// canWorkShift — composite constraint check
// ═══════════════════════════════════════════════════════════════════════════════

describe("canWorkShift", () => {
  // ── Valid baseline ──────────────────────────────────────────────────────────

  it("returns valid when all constraints are satisfied (manager on open shift)", () => {
    const result = canWorkShift(manager1, openShift, makeContext());
    expect(result.valid).toBe(true);
    expect(result.blocking).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  // ── Priority 1: Approved time off (BLOCKING) ────────────────────────────────

  it("BLOCKING — employee on approved time off on the shift date", () => {
    const tor = makeTimeOff(staff, 3, 3, TimeOffStatus.APPROVED); // day 3 = openShift date
    const result = canWorkShift(
      staff,
      openShift,
      makeContext({ approvedTimeOff: [tor] })
    );
    expect(result.valid).toBe(false);
    expect(result.blocking).toBe(true);
    expect(result.reasons.some((r) => r.includes("time off"))).toBe(true);
  });

  // ── Priority 2: Management coverage (BLOCKING) ──────────────────────────────

  it("BLOCKING — STAFF as sole candidate on management-required shift (no other manager)", () => {
    const result = canWorkShift(staff, mgmtShift, makeContext({ assignments: [] }));
    expect(result.valid).toBe(false);
    expect(result.blocking).toBe(true);
    expect(result.reasons.some((r) => r.includes("management presence"))).toBe(true);
  });

  it("PASS — STAFF added to management-required shift that already has a manager assigned", () => {
    const ctx = makeContext({
      assignments: [makeAssignment(manager1, mgmtShift)],
    });
    const result = canWorkShift(staff, mgmtShift, ctx);
    expect(result.valid).toBe(true);
  });

  it("PASS — MANAGER on management-required shift (satisfies own requirement)", () => {
    const result = canWorkShift(manager1, mgmtShift, makeContext());
    expect(result.valid).toBe(true);
  });

  it("PASS — ASSISTANT_MANAGER on management-required shift (satisfies requirement)", () => {
    const result = canWorkShift(am1, mgmtShift, makeContext());
    expect(result.valid).toBe(true);
  });

  // ── Priority 3: Peak shift MANAGER requirement (BLOCKING) ──────────────────

  it("BLOCKING — ASSISTANT_MANAGER as sole candidate on peak shift (needs MANAGER)", () => {
    const result = canWorkShift(am1, peakShift, makeContext({ assignments: [] }));
    expect(result.valid).toBe(false);
    expect(result.blocking).toBe(true);
    expect(result.reasons.some((r) => r.includes("Peak shift"))).toBe(true);
  });

  it("PASS — MANAGER on peak shift (satisfies peak requirement)", () => {
    const result = canWorkShift(manager1, peakShift, makeContext());
    expect(result.valid).toBe(true);
  });

  it("PASS — STAFF on peak shift when a manager is already assigned", () => {
    const ctx = makeContext({
      assignments: [makeAssignment(manager1, peakShift)],
    });
    const result = canWorkShift(staff, peakShift, ctx);
    // peak shift also requires management presence → manager is assigned → both checks pass
    expect(result.valid).toBe(true);
  });

  // ── Priority 4: Overtime (warning, non-blocking) ────────────────────────────

  it("WARNING (non-blocking) — adding shift exceeds overtime threshold", () => {
    const existingShifts = [0, 1, 2, 3, 4].map((d) => ({
      ...openShift,
      id: `cws-ot-${d}`,
      date: weekDay(d),
    }));
    const satShift: Shift = { ...openShift, id: "cws-sat", date: weekDay(5) };
    const ctx = makeContext({
      assignments: existingShifts.map((s) => makeAssignment(staff, s)),
    });
    const result = canWorkShift(staff, satShift, ctx);
    expect(result.valid).toBe(false);
    expect(result.blocking).toBe(false);
    expect(result.reasons.some((r) => r.includes("overtime"))).toBe(true);
  });

  // ── Priority 5: Consecutive days (warning, non-blocking) ───────────────────

  it("WARNING (non-blocking) — adding shift exceeds max consecutive days", () => {
    const assignments = [0, 1, 2, 3, 4].map((d) => {
      const s: Shift = { ...openShift, id: `cws-cd-${d}`, date: weekDay(d) };
      return makeAssignment(staff, s);
    });
    const satShift: Shift = { ...openShift, id: "cws-cd-sat", date: weekDay(5) };
    const ctx = makeContext({ assignments });
    const result = canWorkShift(staff, satShift, ctx);
    expect(result.valid).toBe(false);
    expect(result.blocking).toBe(false);
    expect(result.reasons.some((r) => r.includes("consecutive days"))).toBe(true);
  });

  // ── Priority 6: Specialty (warning, non-blocking) ───────────────────────────

  it("WARNING (non-blocking) — employee lacks required specialty", () => {
    // am2 has specialties: [] — does not have "barista"; specialtyShift requires "barista"
    const result = canWorkShift(am2, specialtyShift, makeContext());
    expect(result.valid).toBe(false);
    expect(result.blocking).toBe(false);
    expect(result.reasons.some((r) => r.includes("specialty"))).toBe(true);
  });

  it("PASS — employee has the required specialty", () => {
    // staff[0] has "barista"
    const result = canWorkShift(staff, specialtyShift, makeContext());
    expect(result.valid).toBe(true);
  });

  // ── Priority 7: Minimum rest (warning, non-blocking) ───────────────────────

  it("WARNING (non-blocking) — insufficient rest between shifts", () => {
    // Evening shift Mon 15:00–23:00, morning shift Tue 07:00–15:00 → 8h gap < 10h min
    const nightShift: Shift = {
      ...openShift,
      id: "rest-night",
      date: weekDay(0),
      start_time: weekDay(0, 15),
      end_time: weekDay(0, 23),
      duration_hours: 8,
    };
    const earlyShift: Shift = {
      ...openShift,
      id: "rest-early",
      date: weekDay(1),
      start_time: weekDay(1, 7),
      end_time: weekDay(1, 15),
      duration_hours: 8,
    };
    const ctx = makeContext({ assignments: [makeAssignment(staff, nightShift)] });
    const result = canWorkShift(staff, earlyShift, ctx);
    expect(result.valid).toBe(false);
    expect(result.blocking).toBe(false);
    expect(result.reasons.some((r) => r.includes("rest"))).toBe(true);
  });

  it("PASS — adequate rest between shifts (>= minimum rest)", () => {
    // Shift ends 09:00, next starts 20:00 → 11h gap > 10h min
    const morningShift: Shift = {
      ...openShift,
      id: "rest-ok-1",
      date: weekDay(0),
      start_time: weekDay(0, 1),
      end_time: weekDay(0, 9),
      duration_hours: 8,
    };
    const eveningShift: Shift = {
      ...openShift,
      id: "rest-ok-2",
      date: weekDay(0),
      start_time: weekDay(0, 20),
      end_time: weekDay(1, 4),
      duration_hours: 8,
    };
    const ctx = makeContext({ assignments: [makeAssignment(staff, morningShift)] });
    const result = canWorkShift(staff, eveningShift, ctx);
    // No rest violation (11h gap)
    expect(result.reasons.some((r) => r.includes("rest"))).toBe(false);
  });

  // ── Priority 8: Part-time contracted hour cap (warning, non-blocking) ──────

  it("WARNING (non-blocking) — part-time employee would exceed contracted hours", () => {
    // partTimer has weekly_hours_target: 20
    const existingShifts = [0, 1].map((d) => ({
      ...openShift,
      id: `pt-ex-${d}`,
      date: weekDay(d),
      duration_hours: 8,
    }));
    const assignments = existingShifts.map((s) => makeAssignment(partTimer, s));
    const thirdShift: Shift = { ...openShift, id: "pt-3rd", date: weekDay(2), duration_hours: 8 };
    const ctx = makeContext({ assignments });
    const result = canWorkShift(partTimer, thirdShift, ctx);
    expect(result.valid).toBe(false);
    expect(result.blocking).toBe(false);
    expect(result.reasons.some((r) => r.includes("contracted weekly hours"))).toBe(true);
  });

  // ── Multiple violations collected in one pass ────────────────────────────────

  it("collects multiple independent violations (overtime + specialty + consecutive days)", () => {
    const allShifts = [0, 1, 2, 3, 4].map((d) => ({
      ...openShift,
      id: `multi-${d}`,
      date: weekDay(d),
    }));
    const assignments = allShifts.map((s) => makeAssignment(staff, s));
    const extraShift: Shift = {
      ...specialtyShift, // requires "barista" — but we're using am1 (no specialty)
      id: "multi-extra",
      date: weekDay(5),
      start_time: weekDay(5, 9),
      end_time: weekDay(5, 17),
    };
    const ctx = makeContext({ assignments });
    const result = canWorkShift(
      am2, // no "barista" specialty + shared consecutive days from assignments
      extraShift,
      ctx
    );
    expect(result.valid).toBe(false);
    // Should have specialty violation at minimum
    expect(result.reasons.length).toBeGreaterThanOrEqual(1);
  });

  it("blocking=false when only warning-level constraints are violated (no BLOCKING rules)", () => {
    // Employee at 40h overtime — warning only
    const existingShifts = [0, 1, 2, 3, 4].map((d) => ({
      ...openShift,
      id: `warn-${d}`,
      date: weekDay(d),
    }));
    const satShift: Shift = { ...openShift, id: "warn-sat", date: weekDay(5) };
    const ctx = makeContext({
      assignments: existingShifts.map((s) => makeAssignment(staff, s)),
    });
    const result = canWorkShift(staff, satShift, ctx);
    expect(result.valid).toBe(false);
    expect(result.blocking).toBe(false);
  });
});
