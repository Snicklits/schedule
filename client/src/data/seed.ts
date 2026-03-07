/**
 * Seed data — realistic dummy content used when the API returns empty results.
 * Gives every card on the dashboard something to render on first load.
 */

import type { EmployeeWithStatus, AssignmentWithDetails, HoursSummaryRow, TimeOffWithEmployee } from "../api/types.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function monday(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function dayISO(offsetDays: number): string {
  const base = new Date(monday() + "T00:00:00Z");
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toISOString();
}

// ─── Employees ───────────────────────────────────────────────────────────────

export const SEED_EMPLOYEES: EmployeeWithStatus[] = [
  {
    id: "seed-emp-1",
    name: "Jordan Rivera",
    email: "jordan.rivera@cafe.com",
    role: "Store Manager",
    employment_type: "FULL_TIME",
    management_tier: "MANAGER",
    weekly_hours_target: 40,
    seniority_level: 5,
    hierarchy_rank: 1,
    specialties: ["Opening", "Closing"],
    status: "ACTIVE",
    hire_date: "2019-03-15T00:00:00.000Z",
  },
  {
    id: "seed-emp-2",
    name: "Alex Chen",
    email: "alex.chen@cafe.com",
    role: "Store Manager",
    employment_type: "FULL_TIME",
    management_tier: "MANAGER",
    weekly_hours_target: 40,
    seniority_level: 4,
    hierarchy_rank: 2,
    specialties: ["Bar", "Espresso"],
    status: "ACTIVE",
    hire_date: "2020-07-01T00:00:00.000Z",
  },
  {
    id: "seed-emp-3",
    name: "Sam Williams",
    email: "sam.williams@cafe.com",
    role: "Assistant Manager",
    employment_type: "FULL_TIME",
    management_tier: "ASSISTANT_MANAGER",
    weekly_hours_target: 40,
    seniority_level: 3,
    hierarchy_rank: 3,
    specialties: ["Floor", "Kitchen"],
    status: "ACTIVE",
    hire_date: "2021-01-20T00:00:00.000Z",
  },
  {
    id: "seed-emp-4",
    name: "Morgan Taylor",
    email: "morgan.taylor@cafe.com",
    role: "Assistant Manager",
    employment_type: "FULL_TIME",
    management_tier: "ASSISTANT_MANAGER",
    weekly_hours_target: 40,
    seniority_level: 3,
    hierarchy_rank: 4,
    specialties: ["Drive", "Catering"],
    status: "ACTIVE",
    hire_date: "2021-06-14T00:00:00.000Z",
  },
  {
    id: "seed-emp-5",
    name: "Casey Johnson",
    email: "casey.johnson@cafe.com",
    role: "Assistant Manager",
    employment_type: "FULL_TIME",
    management_tier: "ASSISTANT_MANAGER",
    weekly_hours_target: 38,
    seniority_level: 2,
    hierarchy_rank: 5,
    specialties: ["Bar", "Drive"],
    status: "ACTIVE",
    hire_date: "2022-03-01T00:00:00.000Z",
  },
  {
    id: "seed-emp-6",
    name: "Riley Park",
    email: "riley.park@cafe.com",
    role: "Barista",
    employment_type: "FULL_TIME",
    management_tier: "STAFF",
    weekly_hours_target: 40,
    seniority_level: 2,
    hierarchy_rank: 6,
    specialties: ["Espresso", "Bar"],
    status: "ACTIVE",
    hire_date: "2022-08-15T00:00:00.000Z",
  },
  {
    id: "seed-emp-7",
    name: "Jamie Okafor",
    email: "jamie.okafor@cafe.com",
    role: "Barista",
    employment_type: "FULL_TIME",
    management_tier: "STAFF",
    weekly_hours_target: 40,
    seniority_level: 2,
    hierarchy_rank: 7,
    specialties: ["Kitchen", "Floor"],
    status: "ACTIVE",
    hire_date: "2022-11-01T00:00:00.000Z",
  },
  {
    id: "seed-emp-8",
    name: "Taylor Kim",
    email: "taylor.kim@cafe.com",
    role: "Barista",
    employment_type: "PART_TIME",
    management_tier: "STAFF",
    weekly_hours_target: 25,
    seniority_level: 1,
    hierarchy_rank: 8,
    specialties: ["Bar"],
    status: "ACTIVE",
    hire_date: "2023-04-10T00:00:00.000Z",
  },
  {
    id: "seed-emp-9",
    name: "Avery Lee",
    email: "avery.lee@cafe.com",
    role: "Barista",
    employment_type: "PART_TIME",
    management_tier: "STAFF",
    weekly_hours_target: 20,
    seniority_level: 1,
    hierarchy_rank: 9,
    specialties: ["Drive"],
    status: "ACTIVE",
    hire_date: "2023-07-03T00:00:00.000Z",
  },
  {
    id: "seed-emp-10",
    name: "Quinn Patel",
    email: "quinn.patel@cafe.com",
    role: "Barista",
    employment_type: "FULL_TIME",
    management_tier: "STAFF",
    weekly_hours_target: 35,
    seniority_level: 1,
    hierarchy_rank: 10,
    specialties: ["Espresso", "Catering"],
    status: "ACTIVE",
    hire_date: "2023-09-12T00:00:00.000Z",
  },
  {
    id: "seed-emp-11",
    name: "Drew Santos",
    email: "drew.santos@cafe.com",
    role: "Barista",
    employment_type: "FULL_TIME",
    management_tier: "STAFF",
    weekly_hours_target: 40,
    seniority_level: 1,
    hierarchy_rank: 11,
    specialties: ["Kitchen"],
    status: "ACTIVE",
    hire_date: "2023-12-01T00:00:00.000Z",
  },
  {
    id: "seed-emp-12",
    name: "Sage Bennett",
    email: "sage.bennett@cafe.com",
    role: "Barista",
    employment_type: "PART_TIME",
    management_tier: "STAFF",
    weekly_hours_target: 20,
    seniority_level: 1,
    hierarchy_rank: 12,
    specialties: ["Floor"],
    status: "ACTIVE",
    hire_date: "2024-02-14T00:00:00.000Z",
  },
  {
    id: "seed-emp-13",
    name: "Blake Nguyen",
    email: "blake.nguyen@cafe.com",
    role: "Barista",
    employment_type: "PART_TIME",
    management_tier: "STAFF",
    weekly_hours_target: 24,
    seniority_level: 1,
    hierarchy_rank: 13,
    specialties: ["Catering", "Bar"],
    status: "ACTIVE",
    hire_date: "2024-05-01T00:00:00.000Z",
  },
];

// ─── Shifts (current week) ────────────────────────────────────────────────────

const makeShift = (id: string, dayOffset: number, startH: number, endH: number, specialty: string | null, isPeak = false, requiresMgmt = true) => ({
  id,
  date: dayISO(dayOffset),
  start_time: dayISO(dayOffset).replace("T00", `T0${startH}`.slice(-3)),
  end_time: dayISO(dayOffset).replace("T00", `T0${endH}`.slice(-3)),
  duration_hours: endH - startH,
  required_specialty: specialty,
  min_staff_count: 3,
  is_peak_shift: isPeak,
  requires_management_presence: requiresMgmt,
  location: "Main Store",
});

export const SEED_SHIFTS = [
  makeShift("seed-shift-1", 0, 6, 14, "Opening", false, true),
  makeShift("seed-shift-2", 0, 14, 22, "Closing", false, true),
  makeShift("seed-shift-3", 1, 7, 15, "Espresso", true, true),
  makeShift("seed-shift-4", 1, 12, 20, "Bar", true, true),
  makeShift("seed-shift-5", 2, 6, 14, "Drive", false, true),
  makeShift("seed-shift-6", 2, 14, 22, "Kitchen", false, true),
  makeShift("seed-shift-7", 3, 7, 15, "Floor", true, true),
  makeShift("seed-shift-8", 4, 8, 16, "Espresso", false, false),
];

// ─── Assignments ─────────────────────────────────────────────────────────────

function makeAssignment(id: string, empIdx: number, shiftIdx: number, status = "SCHEDULED"): AssignmentWithDetails {
  const emp = SEED_EMPLOYEES[empIdx];
  const shift = SEED_SHIFTS[shiftIdx];
  return {
    id,
    employee_id: emp.id,
    shift_id: shift.id,
    assigned_hours: shift.duration_hours,
    status: status as AssignmentWithDetails["status"],
    employee: emp,
    shift,
  };
}

export const SEED_ASSIGNMENTS: AssignmentWithDetails[] = [
  makeAssignment("seed-asgn-1",  0, 0, "CONFIRMED"),   // Jordan → Mon Opening
  makeAssignment("seed-asgn-2",  2, 0, "SCHEDULED"),   // Sam → Mon Opening
  makeAssignment("seed-asgn-3",  5, 0, "SCHEDULED"),   // Riley → Mon Opening
  makeAssignment("seed-asgn-4",  1, 1, "CONFIRMED"),   // Alex → Mon Closing
  makeAssignment("seed-asgn-5",  3, 1, "SCHEDULED"),   // Morgan → Mon Closing
  makeAssignment("seed-asgn-6",  6, 1, "SCHEDULED"),   // Jamie → Mon Closing
  makeAssignment("seed-asgn-7",  0, 2, "SCHEDULED"),   // Jordan → Tue Espresso peak
  makeAssignment("seed-asgn-8",  4, 2, "SCHEDULED"),   // Casey → Tue Espresso peak
  makeAssignment("seed-asgn-9",  7, 2, "SCHEDULED"),   // Taylor → Tue Espresso peak
  makeAssignment("seed-asgn-10", 1, 3, "CONFIRMED"),   // Alex → Tue Bar peak
  makeAssignment("seed-asgn-11", 3, 3, "SCHEDULED"),   // Morgan → Tue Bar peak
  makeAssignment("seed-asgn-12", 8, 3, "SCHEDULED"),   // Avery → Tue Bar peak
  makeAssignment("seed-asgn-13", 2, 4, "SCHEDULED"),   // Sam → Wed Drive
  makeAssignment("seed-asgn-14", 9, 4, "SCHEDULED"),   // Quinn → Wed Drive
  makeAssignment("seed-asgn-15", 1, 5, "SCHEDULED"),   // Alex → Wed Kitchen
  makeAssignment("seed-asgn-16", 10, 5, "SCHEDULED"),  // Drew → Wed Kitchen
  makeAssignment("seed-asgn-17", 0, 6, "CONFIRMED"),   // Jordan → Thu Floor peak
  makeAssignment("seed-asgn-18", 4, 6, "SCHEDULED"),   // Casey → Thu Floor peak
  makeAssignment("seed-asgn-19", 11, 6, "SCHEDULED"),  // Sage → Thu Floor peak
  makeAssignment("seed-asgn-20", 3, 7, "SCHEDULED"),   // Morgan → Fri Espresso
];

// ─── Hours Summary ───────────────────────────────────────────────────────────

export const SEED_HOURS: HoursSummaryRow[] = [
  { employeeId: "seed-emp-1",  name: "Jordan Rivera", weeklyHours: 38, isAtCap: false },
  { employeeId: "seed-emp-2",  name: "Alex Chen",     weeklyHours: 40, isAtCap: true  },
  { employeeId: "seed-emp-3",  name: "Sam Williams",  weeklyHours: 32, isAtCap: false },
  { employeeId: "seed-emp-4",  name: "Morgan Taylor", weeklyHours: 36, isAtCap: false },
  { employeeId: "seed-emp-5",  name: "Casey Johnson", weeklyHours: 30, isAtCap: false },
  { employeeId: "seed-emp-6",  name: "Riley Park",    weeklyHours: 40, isAtCap: true  },
  { employeeId: "seed-emp-7",  name: "Jamie Okafor",  weeklyHours: 34, isAtCap: false },
  { employeeId: "seed-emp-8",  name: "Taylor Kim",    weeklyHours: 24, isAtCap: false },
  { employeeId: "seed-emp-9",  name: "Avery Lee",     weeklyHours: 16, isAtCap: false },
  { employeeId: "seed-emp-10", name: "Quinn Patel",   weeklyHours: 35, isAtCap: false },
  { employeeId: "seed-emp-11", name: "Drew Santos",   weeklyHours: 40, isAtCap: true  },
  { employeeId: "seed-emp-12", name: "Sage Bennett",  weeklyHours: 18, isAtCap: false },
  { employeeId: "seed-emp-13", name: "Blake Nguyen",  weeklyHours: 22, isAtCap: false },
];

// ─── Pending Time-Off Requests ────────────────────────────────────────────────

export const SEED_TIME_OFF: TimeOffWithEmployee[] = [
  {
    id: "seed-to-1",
    employee_id: "seed-emp-8",
    type: "VACATION",
    start_date: dayISO(7),
    end_date: dayISO(11),
    status: "PENDING",
    priority: 1,
    created_at: new Date().toISOString(),
    employee: SEED_EMPLOYEES[7],
  },
  {
    id: "seed-to-2",
    employee_id: "seed-emp-12",
    type: "SICK",
    start_date: dayISO(2),
    end_date: dayISO(2),
    status: "PENDING",
    priority: 2,
    created_at: new Date().toISOString(),
    employee: SEED_EMPLOYEES[11],
  },
  {
    id: "seed-to-3",
    employee_id: "seed-emp-6",
    type: "PERSONAL",
    start_date: dayISO(5),
    end_date: dayISO(5),
    status: "PENDING",
    priority: 0,
    created_at: new Date().toISOString(),
    employee: SEED_EMPLOYEES[5],
  },
];

// ─── Avatar initials helper ───────────────────────────────────────────────────

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ─── Avatar gradient by tier ─────────────────────────────────────────────────

export function tierGradient(tier: string): string {
  if (tier === "MANAGER")           return "from-violet-500 to-purple-600";
  if (tier === "ASSISTANT_MANAGER") return "from-sky-500 to-blue-600";
  return "from-slate-400 to-slate-500";
}

export function tierLabel(tier: string): string {
  if (tier === "MANAGER")           return "Manager";
  if (tier === "ASSISTANT_MANAGER") return "Asst. Manager";
  return "Staff";
}
