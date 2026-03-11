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
  management_tier: z.enum(["MANAGER", "ASSISTANT_MANAGER", "STAFF"]).optional(),
  employment_type: z.enum(["FULL_TIME", "PART_TIME"]).optional(),
});

export const employeeQuerySchema = z.object({
  tier: z.enum(["MANAGER", "ASSISTANT_MANAGER", "STAFF"]).optional(),
  all: z.enum(["true"]).optional(),
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
  approverId: z.string().min(1).optional(),
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

// ─── Shifts ───────────────────────────────────────────────────────────────────

export const markPeakSchema = z.object({
  isPeak: z.boolean(),
});

// ─── Management gaps ──────────────────────────────────────────────────────────

export const managementGapsQuerySchema = z.object({
  weekStart: z.string().optional(),
});

// ─── Peak Windows ─────────────────────────────────────────────────────────────

export const createPeakWindowSchema = z.object({
  days: z.array(z.string()).min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  label: z.string().optional(),
});

// ─── Auth ──────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const signupSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// ─── Budget ───────────────────────────────────────────────────────────────────

export const upsertBudgetSchema = z.object({
  weekStart: z.string().min(1),
  totalHoursBudget: z.number().positive(),
  notes: z.string().optional().nullable(),
});

// ─── Employee (extended) ──────────────────────────────────────────────────────

export const updateEmployeeExtendedSchema = z.object({
  name: z.string().min(1).optional(),
  weekly_hours_target: z.number().int().positive().optional(),
  seniority_level: z.number().int().min(0).optional(),
  role: z.string().min(1).optional(),
  specialties: z.array(z.string()).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  management_tier: z.enum(["MANAGER", "ASSISTANT_MANAGER", "STAFF"]).optional(),
  employment_type: z.enum(["FULL_TIME", "PART_TIME"]).optional(),
  hourly_rate: z.number().positive().optional().nullable(),
  currency: z.string().optional(),
});

// ─── Events ───────────────────────────────────────────────────────────────────

export const createHistoricalEventSchema = z.object({
  name: z.string().min(1),
  event_type: z.string().min(1),
  date: z.string().min(1),
  staff_used: z.number().int().positive(),
  hours_used: z.number().positive(),
  notes: z.string().optional().nullable(),
});

export const createUpcomingEventSchema = z.object({
  name: z.string().min(1),
  event_type: z.string().min(1),
  date: z.string().min(1),
  confirmed_staff: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateUpcomingEventSchema = z.object({
  confirmed_staff: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const eventsTypeQuerySchema = z.object({
  type: z.string().optional(),
});

// ─── Company Config ───────────────────────────────────────────────────────────

export const updateCompanyConfigSchema = z.object({
  company_name: z.string().min(1).optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
});

export const uploadLogoSchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.string().optional(),
});

// ─── Avatar ────────────────────────────────────────────────────────────────────

export const uploadAvatarSchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.string().optional(),
});
