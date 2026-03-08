/**
 * Budget Routes — Phase 9
 *
 * POST /api/budget           — create/update weekly budget
 * GET  /api/budget/:weekStart — get budget with scheduled hours and status
 */

import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../api/errors.js";
import { z } from "zod";
import { parseBody } from "../api/validate.js";

export const budgetRouter = Router();

const createBudgetSchema = z.object({
  week_start: z.string().datetime({ offset: true }).or(z.string().date()),
  budget_hours: z.number().positive(),
});

// ─── POST /api/budget ─────────────────────────────────────────────────────────

budgetRouter.post("/", async (req, res) => {
  const body = parseBody(createBudgetSchema, req);
  const weekStart = new Date(body.week_start);

  const budget = await (prisma as any).weeklyBudget.upsert({
    where: { week_start: weekStart },
    update: { budget_hours: body.budget_hours },
    create: { week_start: weekStart, budget_hours: body.budget_hours },
  });

  res.status(201).json({ success: true, data: budget });
});

// ─── GET /api/budget/:weekStart ───────────────────────────────────────────────

budgetRouter.get("/:weekStart", async (req, res) => {
  const weekStart = new Date(req.params["weekStart"]);
  if (isNaN(weekStart.getTime())) {
    throw new ApiError(400, "INVALID_DATE", "weekStart must be a valid date");
  }

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const [budget, shifts, assignments] = await Promise.all([
    (prisma as any).weeklyBudget.findUnique({ where: { week_start: weekStart } }),
    (prisma as any).shift.findMany({
      where: { date: { gte: weekStart, lt: weekEnd } },
    }),
    (prisma as any).assignment.findMany({
      where: {
        shift: { date: { gte: weekStart, lt: weekEnd } },
        status: { not: "CANCELLED" },
      },
    }),
  ]);

  const scheduled_hours = (assignments as any[]).reduce(
    (sum: number, a: any) => sum + (a.assigned_hours ?? 0),
    0
  );

  const budget_hours = budget?.budget_hours ?? null;
  let status: "UNDER" | "ON_TRACK" | "OVER" | null = null;
  if (budget_hours !== null) {
    const ratio = scheduled_hours / budget_hours;
    status = ratio > 1.05 ? "OVER" : ratio >= 0.95 ? "ON_TRACK" : "UNDER";
  }

  res.json({
    success: true,
    data: {
      week_start: weekStart,
      budget_hours,
      scheduled_hours,
      variance: budget_hours !== null ? scheduled_hours - budget_hours : null,
      status,
    },
  });
});
