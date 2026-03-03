/**
 * Scheduler test fixtures — Phase 3
 *
 * Canonical seed data used across all scheduler unit tests:
 *   2  MANAGERs
 *   3  ASSISTANT_MANAGERs
 *  10  STAFF (mix of full-time / part-time, varied specialties & seniority)
 *
 * Week reference: Mon 2 Mar 2026 UTC
 */

import type {
  Employee,
  Shift,
  ScheduleConfig,
} from "../constraintEngine/types.js";
import {
  EmploymentType,
  ManagementTier,
} from "../constraintEngine/types.js";

// ─── Week reference ──────────────────────────────────────────────────────────

export const WEEK_START = new Date("2026-03-02T00:00:00.000Z"); // Monday

/** Build a UTC date offset `days` from WEEK_START with optional H:MM. */
export function wd(days: number, hour = 0, minute = 0): Date {
  const d = new Date(WEEK_START);
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour, minute, 0, 0);
  return d;
}

// ─── Employees ───────────────────────────────────────────────────────────────

/** Two MANAGER-tier employees. */
export const mgr1: Employee = {
  id: "mgr-1",
  name: "Alice Manager",
  employment_type: EmploymentType.FULL_TIME,
  weekly_hours_target: 40,
  management_tier: ManagementTier.MANAGER,
  specialties: ["opener"],
  seniority_level: 10,
  hierarchy_rank: 1,
};

export const mgr2: Employee = {
  id: "mgr-2",
  name: "Bob Manager",
  employment_type: EmploymentType.FULL_TIME,
  weekly_hours_target: 40,
  management_tier: ManagementTier.MANAGER,
  specialties: ["barista", "closer"],
  seniority_level: 8,
  hierarchy_rank: 2,
};

/** Three ASSISTANT_MANAGER-tier employees. */
export const am1: Employee = {
  id: "am-1",
  name: "Carol AM",
  employment_type: EmploymentType.FULL_TIME,
  weekly_hours_target: 40,
  management_tier: ManagementTier.ASSISTANT_MANAGER,
  specialties: ["barista"],
  seniority_level: 7,
  hierarchy_rank: 3,
};

export const am2: Employee = {
  id: "am-2",
  name: "Dave AM",
  employment_type: EmploymentType.FULL_TIME,
  weekly_hours_target: 40,
  management_tier: ManagementTier.ASSISTANT_MANAGER,
  specialties: [],
  seniority_level: 6,
  hierarchy_rank: 4,
};

export const am3: Employee = {
  id: "am-3",
  name: "Eve AM",
  employment_type: EmploymentType.FULL_TIME,
  weekly_hours_target: 40,
  management_tier: ManagementTier.ASSISTANT_MANAGER,
  specialties: ["opener"],
  seniority_level: 5,
  hierarchy_rank: 5,
};

/** Ten STAFF-tier employees with varied contracts and specialties. */
export const s1: Employee = {
  id: "s-1",
  name: "Frank Staff",
  employment_type: EmploymentType.FULL_TIME,
  weekly_hours_target: 40,
  management_tier: ManagementTier.STAFF,
  specialties: ["barista", "opener"],
  seniority_level: 4,
  hierarchy_rank: 6,
};

export const s2: Employee = {
  id: "s-2",
  name: "Grace Staff",
  employment_type: EmploymentType.FULL_TIME,
  weekly_hours_target: 40,
  management_tier: ManagementTier.STAFF,
  specialties: ["closer"],
  seniority_level: 4,
  hierarchy_rank: 7,
};

export const s3: Employee = {
  id: "s-3",
  name: "Hank Staff",
  employment_type: EmploymentType.FULL_TIME,
  weekly_hours_target: 40,
  management_tier: ManagementTier.STAFF,
  specialties: [],
  seniority_level: 3,
  hierarchy_rank: 8,
};

export const s4: Employee = {
  id: "s-4",
  name: "Ivy Staff",
  employment_type: EmploymentType.PART_TIME,
  weekly_hours_target: 20,
  management_tier: ManagementTier.STAFF,
  specialties: ["barista"],
  seniority_level: 3,
  hierarchy_rank: 9,
};

export const s5: Employee = {
  id: "s-5",
  name: "Jake Staff",
  employment_type: EmploymentType.FULL_TIME,
  weekly_hours_target: 40,
  management_tier: ManagementTier.STAFF,
  specialties: [],
  seniority_level: 3,
  hierarchy_rank: 10,
};

export const s6: Employee = {
  id: "s-6",
  name: "Kim Staff",
  employment_type: EmploymentType.PART_TIME,
  weekly_hours_target: 24,
  management_tier: ManagementTier.STAFF,
  specialties: ["opener"],
  seniority_level: 2,
  hierarchy_rank: 11,
};

export const s7: Employee = {
  id: "s-7",
  name: "Leo Staff",
  employment_type: EmploymentType.FULL_TIME,
  weekly_hours_target: 40,
  management_tier: ManagementTier.STAFF,
  specialties: [],
  seniority_level: 2,
  hierarchy_rank: 12,
};

export const s8: Employee = {
  id: "s-8",
  name: "Mia Staff",
  employment_type: EmploymentType.FULL_TIME,
  weekly_hours_target: 40,
  management_tier: ManagementTier.STAFF,
  specialties: ["barista"],
  seniority_level: 2,
  hierarchy_rank: 13,
};

export const s9: Employee = {
  id: "s-9",
  name: "Ned Staff",
  employment_type: EmploymentType.PART_TIME,
  weekly_hours_target: 16,
  management_tier: ManagementTier.STAFF,
  specialties: [],
  seniority_level: 1,
  hierarchy_rank: 14,
};

export const s10: Employee = {
  id: "s-10",
  name: "Ora Staff",
  employment_type: EmploymentType.FULL_TIME,
  weekly_hours_target: 40,
  management_tier: ManagementTier.STAFF,
  specialties: ["closer", "opener"],
  seniority_level: 1,
  hierarchy_rank: 15,
};

/** All 15 employees in a single array. */
export const allEmployees: Employee[] = [
  mgr1, mgr2,
  am1, am2, am3,
  s1, s2, s3, s4, s5, s6, s7, s8, s9, s10,
];

// ─── Standard week of shifts ─────────────────────────────────────────────────
//
// 7 shifts across Mon–Sun with varied peak / management / specialty flags.
//   shift-mon-day   Mon  09–17  mgmt, non-peak, no specialty, min 3
//   shift-mon-eve   Mon  17–22  mgmt, PEAK,     no specialty, min 3
//   shift-tue-day   Tue  09–17  mgmt, non-peak, barista,      min 2
//   shift-wed-day   Wed  09–17  mgmt, non-peak, no specialty, min 3
//   shift-thu-peak  Thu  11–19  mgmt, PEAK,     no specialty, min 3
//   shift-fri-day   Fri  09–17  mgmt, non-peak, no specialty, min 2
//   shift-sat-open  Sat  10–18  NO mgmt, non-peak, no specialty, min 1

export const shiftMonDay: Shift = {
  id: "shift-mon-day",
  date: wd(0),
  start_time: wd(0, 9),
  end_time: wd(0, 17),
  duration_hours: 8,
  required_specialty: null,
  min_staff_count: 3,
  is_peak_shift: false,
  requires_management_presence: true,
};

export const shiftMonEve: Shift = {
  id: "shift-mon-eve",
  date: wd(0),
  start_time: wd(0, 17),
  end_time: wd(0, 22),
  duration_hours: 5,
  required_specialty: null,
  min_staff_count: 3,
  is_peak_shift: true,
  requires_management_presence: true,
};

export const shiftTueDay: Shift = {
  id: "shift-tue-day",
  date: wd(1),
  start_time: wd(1, 9),
  end_time: wd(1, 17),
  duration_hours: 8,
  required_specialty: "barista",
  min_staff_count: 2,
  is_peak_shift: false,
  requires_management_presence: true,
};

export const shiftWedDay: Shift = {
  id: "shift-wed-day",
  date: wd(2),
  start_time: wd(2, 9),
  end_time: wd(2, 17),
  duration_hours: 8,
  required_specialty: null,
  min_staff_count: 3,
  is_peak_shift: false,
  requires_management_presence: true,
};

export const shiftThuPeak: Shift = {
  id: "shift-thu-peak",
  date: wd(3),
  start_time: wd(3, 11),
  end_time: wd(3, 19),
  duration_hours: 8,
  required_specialty: null,
  min_staff_count: 3,
  is_peak_shift: true,
  requires_management_presence: true,
};

export const shiftFriDay: Shift = {
  id: "shift-fri-day",
  date: wd(4),
  start_time: wd(4, 9),
  end_time: wd(4, 17),
  duration_hours: 8,
  required_specialty: null,
  min_staff_count: 2,
  is_peak_shift: false,
  requires_management_presence: true,
};

export const shiftSatOpen: Shift = {
  id: "shift-sat-open",
  date: wd(5),
  start_time: wd(5, 10),
  end_time: wd(5, 18),
  duration_hours: 8,
  required_specialty: null,
  min_staff_count: 1,
  is_peak_shift: false,
  requires_management_presence: false,
};

export const standardWeekShifts: Shift[] = [
  shiftMonDay,
  shiftMonEve,
  shiftTueDay,
  shiftWedDay,
  shiftThuPeak,
  shiftFriDay,
  shiftSatOpen,
];

// ─── Default ScheduleConfig ───────────────────────────────────────────────────

export const defaultConfig: ScheduleConfig = {
  max_consecutive_days: 5,
  max_weekly_hours: 40,
  overtime_threshold: 40,
  min_rest_hours_between_shifts: 10,
  schedule_period_days: 7,
  max_team_off_percentage: 0.33,
};
