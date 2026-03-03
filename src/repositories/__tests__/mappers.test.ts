/**
 * Mapper unit tests — no DB, no mocking needed.
 */

import { describe, it, expect } from "vitest";
import {
  toEmployee,
  toShift,
  toAssignment,
  toTimeOffRequest,
  type PrismaEmployee,
  type PrismaShift,
  type PrismaAssignmentWithShift,
  type PrismaTimeOffRequest,
} from "../mappers.js";

const baseEmployee: PrismaEmployee = {
  id: "emp-1",
  name: "Alice",
  employment_type: "FULL_TIME",
  weekly_hours_target: 40,
  management_tier: "MANAGER",
  specialties: ["cashier"],
  seniority_level: 8,
  hierarchy_rank: 1,
};

const baseShift: PrismaShift = {
  id: "shift-1",
  date: new Date("2026-03-02T12:00:00.000Z"),
  start_time: new Date("2026-03-02T09:00:00.000Z"),
  end_time: new Date("2026-03-02T17:00:00.000Z"),
  duration_hours: 8,
  required_specialty: null,
  min_staff_count: 3,
  is_peak_shift: false,
  requires_management_presence: true,
};

describe("toEmployee", () => {
  it("maps all engine fields correctly", () => {
    const emp = toEmployee(baseEmployee);
    expect(emp.id).toBe("emp-1");
    expect(emp.name).toBe("Alice");
    expect(emp.employment_type).toBe("FULL_TIME");
    expect(emp.weekly_hours_target).toBe(40);
    expect(emp.management_tier).toBe("MANAGER");
    expect(emp.specialties).toEqual(["cashier"]);
    expect(emp.seniority_level).toBe(8);
    expect(emp.hierarchy_rank).toBe(1);
  });

  it("does not include DB-only fields (email, hire_date, role, status)", () => {
    const emp = toEmployee(baseEmployee) as Record<string, unknown>;
    expect("email" in emp).toBe(false);
    expect("hire_date" in emp).toBe(false);
    expect("role" in emp).toBe(false);
    expect("status" in emp).toBe(false);
  });
});

describe("toShift", () => {
  it("maps all engine fields correctly", () => {
    const shift = toShift(baseShift);
    expect(shift.id).toBe("shift-1");
    expect(shift.date).toEqual(new Date("2026-03-02T12:00:00.000Z"));
    expect(shift.duration_hours).toBe(8);
    expect(shift.required_specialty).toBeNull();
    expect(shift.min_staff_count).toBe(3);
    expect(shift.is_peak_shift).toBe(false);
    expect(shift.requires_management_presence).toBe(true);
  });

  it("does not include DB-only fields (location)", () => {
    const shift = toShift(baseShift) as Record<string, unknown>;
    expect("location" in shift).toBe(false);
  });
});

describe("toAssignment", () => {
  const baseAssignment: PrismaAssignmentWithShift = {
    employee_id: "emp-1",
    shift_id: "shift-1",
    assigned_hours: 8,
    status: "SCHEDULED",
    shift: {
      date: new Date("2026-03-02T12:00:00.000Z"),
      start_time: new Date("2026-03-02T09:00:00.000Z"),
      end_time: new Date("2026-03-02T17:00:00.000Z"),
    },
  };

  it("denormalises shift timing fields into the assignment", () => {
    const a = toAssignment(baseAssignment);
    expect(a.employee_id).toBe("emp-1");
    expect(a.shift_id).toBe("shift-1");
    expect(a.assigned_hours).toBe(8);
    expect(a.status).toBe("SCHEDULED");
    expect(a.shift_date).toEqual(new Date("2026-03-02T12:00:00.000Z"));
    expect(a.shift_start_time).toEqual(new Date("2026-03-02T09:00:00.000Z"));
    expect(a.shift_end_time).toEqual(new Date("2026-03-02T17:00:00.000Z"));
  });
});

describe("toTimeOffRequest", () => {
  const base: PrismaTimeOffRequest = {
    id: "tor-1",
    employee_id: "emp-1",
    start_date: new Date("2026-03-06T00:00:00.000Z"),
    end_date: new Date("2026-03-08T00:00:00.000Z"),
    status: "PENDING",
    priority: 8,
    created_at: new Date("2026-02-20T09:00:00.000Z"),
  };

  it("maps all engine fields correctly", () => {
    const tor = toTimeOffRequest(base);
    expect(tor.id).toBe("tor-1");
    expect(tor.employee_id).toBe("emp-1");
    expect(tor.status).toBe("PENDING");
    expect(tor.priority).toBe(8);
    expect(tor.created_at).toEqual(new Date("2026-02-20T09:00:00.000Z"));
  });

  it("omits priority and created_at when null", () => {
    const tor = toTimeOffRequest({ ...base, priority: null, created_at: null });
    expect("priority" in tor).toBe(false);
    expect("created_at" in tor).toBe(false);
  });
});
