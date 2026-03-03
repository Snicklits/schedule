/**
 * Repositories — Mappers
 *
 * Converts Prisma model objects to the pure engine types used by the
 * constraint engine and scheduling algorithm.  All DB-specific fields
 * (email, hire_date, role, status, location, …) are stripped here so
 * that nothing above this layer is ever aware of them.
 */

import type {
  Employee,
  Shift,
  Assignment,
  TimeOffRequest,
} from "../constraintEngine/types.js";

// ─── Structural shims for Prisma query results ───────────────────────────────
//
// These interfaces mirror the exact shape of what Prisma returns for each
// model (default selection).  Declared here so mappers.ts never imports the
// generated client (which avoids circular concerns in tests).

export interface PrismaEmployee {
  id: string;
  name: string;
  employment_type: string;
  weekly_hours_target: number;
  management_tier: string;
  specialties: string[];
  seniority_level: number;
  hierarchy_rank: number;
}

export interface PrismaShift {
  id: string;
  date: Date;
  start_time: Date;
  end_time: Date;
  duration_hours: number;
  required_specialty: string | null;
  min_staff_count: number;
  is_peak_shift: boolean;
  requires_management_presence: boolean;
}

/** Assignment row joined with its parent Shift (via `include: { shift: true }`). */
export interface PrismaAssignmentWithShift {
  employee_id: string;
  shift_id: string;
  assigned_hours: number;
  status: string;
  shift: {
    date: Date;
    start_time: Date;
    end_time: Date;
  };
}

export interface PrismaTimeOffRequest {
  id: string;
  employee_id: string;
  start_date: Date;
  end_date: Date;
  status: string;
  priority: number | null;
  created_at: Date | null;
}

// ─── Mapper functions ────────────────────────────────────────────────────────

export function toEmployee(p: PrismaEmployee): Employee {
  return {
    id: p.id,
    name: p.name,
    employment_type: p.employment_type as Employee["employment_type"],
    weekly_hours_target: p.weekly_hours_target,
    management_tier: p.management_tier as Employee["management_tier"],
    specialties: p.specialties,
    seniority_level: p.seniority_level,
    hierarchy_rank: p.hierarchy_rank,
  };
}

export function toShift(p: PrismaShift): Shift {
  return {
    id: p.id,
    date: p.date,
    start_time: p.start_time,
    end_time: p.end_time,
    duration_hours: p.duration_hours,
    required_specialty: p.required_specialty,
    min_staff_count: p.min_staff_count,
    is_peak_shift: p.is_peak_shift,
    requires_management_presence: p.requires_management_presence,
  };
}

export function toAssignment(p: PrismaAssignmentWithShift): Assignment {
  return {
    employee_id: p.employee_id,
    shift_id: p.shift_id,
    shift_date: p.shift.date,
    shift_start_time: p.shift.start_time,
    shift_end_time: p.shift.end_time,
    assigned_hours: p.assigned_hours,
    status: p.status as Assignment["status"],
  };
}

export function toTimeOffRequest(p: PrismaTimeOffRequest): TimeOffRequest {
  return {
    id: p.id,
    employee_id: p.employee_id,
    start_date: p.start_date,
    end_date: p.end_date,
    status: p.status as TimeOffRequest["status"],
    ...(p.priority != null && { priority: p.priority }),
    ...(p.created_at != null && { created_at: p.created_at }),
  };
}
