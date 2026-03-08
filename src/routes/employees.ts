/**
 * Employee Routes — Phase 5
 *
 * GET  /api/employees           — list employees (optional ?tier= filter)
 * GET  /api/employees/:id       — get single employee
 * POST /api/employees           — create employee
 * PUT  /api/employees/:id       — update employee
 */

import { Router } from "express";
import {
  getAllActiveEmployees,
  getAllEmployeesWithStatus,
  getEmployeesByTier,
  getEmployeeById,
  createEmployee,
  updateEmployee,
} from "../repositories/index.js";
import type { ManagementTier } from "../constraintEngine/types.js";
import { ApiError } from "../api/errors.js";
import { parseBody, parseQuery } from "../api/validate.js";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeQuerySchema,
} from "../api/schemas.js";
import { prisma } from "../lib/prisma.js";
import { notifyInvite } from "../services/notifications.js";

export const employeeRouter = Router();

// ─── GET /api/employees ───────────────────────────────────────────────────────

employeeRouter.get("/", async (req, res) => {
  const { tier, all } = parseQuery(employeeQuerySchema, req);
  const employees =
    all === "true"
      ? await getAllEmployeesWithStatus()
      : tier
        ? await getEmployeesByTier(tier as ManagementTier)
        : await getAllActiveEmployees();
  res.json({ success: true, data: employees });
});

// ─── GET /api/employees/:id ───────────────────────────────────────────────────

employeeRouter.get("/:id", async (req, res) => {
  const employee = await getEmployeeById(req.params["id"]);
  if (!employee) throw new ApiError(404, "NOT_FOUND", "Employee not found");
  res.json({ success: true, data: employee });
});

// ─── POST /api/employees ──────────────────────────────────────────────────────

employeeRouter.post("/", async (req, res) => {
  const body = parseBody(createEmployeeSchema, req);
  const employee = await createEmployee({
    name: body.name,
    email: body.email,
    employment_type: body.employment_type,
    weekly_hours_target: body.weekly_hours_target,
    hire_date: new Date(body.hire_date),
    seniority_level: body.seniority_level,
    role: body.role,
    hierarchy_rank: body.hierarchy_rank,
    management_tier: body.management_tier,
    specialties: body.specialties,
  });

  // Create UserAccount with INVITED status and send invite email
  const inviteToken =
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Derive role from management_tier
  const roleMap: Record<string, string> = {
    MANAGER: "MANAGER",
    ASSISTANT_MANAGER: "ASSISTANT_MANAGER",
    STAFF: "STAFF",
  };
  const accountRole = roleMap[body.management_tier] ?? "STAFF";

  // Create UserAccount (fire-and-forget — don't block employee creation if DB unavailable)
  Promise.resolve()
    .then(async () => {
      await (prisma as any).userAccount.create({
        data: {
          employee_id: employee.id,
          email: body.email,
          role: accountRole,
          status: "INVITED",
          invite_token: inviteToken,
          invite_expires_at: inviteExpiresAt,
        },
      });
      await notifyInvite({ name: body.name, email: body.email }, inviteToken);
    })
    .catch((err: unknown) => {
      console.warn("[employees] Failed to create UserAccount/send invite:", err);
    });

  res.status(201).json({ success: true, data: employee });
});

// ─── PUT /api/employees/:id ───────────────────────────────────────────────────

employeeRouter.put("/:id", async (req, res) => {
  const body = parseBody(updateEmployeeSchema, req);
  const employee = await updateEmployee(req.params["id"], body);
  res.json({ success: true, data: employee });
});
