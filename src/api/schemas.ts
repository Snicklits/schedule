/**
 * Zod schemas for all Phase 5 request bodies and query parameters.
 */

import { z } from "zod";

// ─── Schedule ─────────────────────────────────────────────────────────────────

export const generateScheduleSchema = z.object({
  weekStart: z.string().min(1),
});

export const assignmentOverrideSchema = z.object({
  employeeId: z.string().min(1),
  reason: z.string().min(1).optional(),
});

// ─── Employee ─────────────────────────────────────────────────────────────────

export const createEmployeeSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  employment_type: z.enum(["FULL_TIME", "PART_TIME"]),
  weekly_hours_target: z.number().int().positive(),
  hire_date: z.string().min(1),
  seniority_level: z.number().int().min(0),
  role: z.string().min(1),
  hierarchy_rank: z.number().int().min(0),
  management_tier: z.enum(["MANAGER", "ASSISTANT_MANAGER", "STAFF"]),
  specialties: z.array(z.string()).default([]),
});

export const updateEmployeeSchema = z.object({
  name: z.string().min(1).optional(),
  weekly_hours_target: z.number().int().positive().optional(),
  seniority_level: z.number().int().min(0).optional(),
  role: z.string().min(1).optional(),
  specialties: z.array(z.string()).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const employeeQuerySchema = z.object({
  tier: z.enum(["MANAGER", "ASSISTANT_MANAGER", "STAFF"]).optional(),
});

// ─── Time-Off ─────────────────────────────────────────────────────────────────

export const createTimeOffSchema = z.object({
  employeeId: z.string().min(1),
  type: z.enum(["VACATION", "SICK", "PERSONAL", "UNPAID"]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  priority: z.number().int().min(0).optional().default(0),
});

export const approveTimeOffSchema = z.object({
  status: z.enum(["APPROVED", "DENIED"]),
  approverId: z.string().min(1),
});

export const timeOffQuerySchema = z.object({
  employeeId: z.string().min(1),
});

// ─── Shift ────────────────────────────────────────────────────────────────────

export const createShiftSchema = z.object({
  date: z.string().min(1),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  duration_hours: z.number().positive(),
  required_specialty: z.string().nullable().optional(),
  min_staff_count: z.number().int().min(1),
  is_peak_shift: z.boolean().default(false),
  requires_management_presence: z.boolean().default(true),
  location: z.string().optional(),
});

export const updateShiftSchema = z.object({
  date: z.string().min(1).optional(),
  start_time: z.string().min(1).optional(),
  end_time: z.string().min(1).optional(),
  duration_hours: z.number().positive().optional(),
  required_specialty: z.string().nullable().optional(),
  min_staff_count: z.number().int().min(1).optional(),
  is_peak_shift: z.boolean().optional(),
  requires_management_presence: z.boolean().optional(),
  location: z.string().nullable().optional(),
});

export const shiftsQuerySchema = z.object({
  weekStart: z.string().optional(),
});

// ─── Coverage / Reports ───────────────────────────────────────────────────────

export const weekStartQuerySchema = z.object({
  weekStart: z.string().min(1),
});

export const violationsQuerySchema = z.object({
  type: z.enum(["BLOCKING", "WARNING"]).optional(),
  weekStart: z.string().optional(),
});

// ─── Peak Windows ─────────────────────────────────────────────────────────────

export const createPeakWindowSchema = z.object({
  days: z.array(z.string()).min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  label: z.string().optional(),
});
