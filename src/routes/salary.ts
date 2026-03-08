/**
 * Salary Routes — Phase 9
 *
 * GET /api/salary/:employeeId/:weekStart  — individual pay summary
 * GET /api/salary/team/:weekStart         — all employees sorted by gross pay
 */

import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../api/errors.js";

export const salaryRouter = Router();

// ─── Calculation helper ───────────────────────────────────────────────────────

async function computePaySummary(employeeId: string, weekStart: Date) {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const [employee, assignments, timeOffRequests] = await Promise.all([
    (prisma as any).employee.findUnique({ where: { id: employeeId } }),
    (prisma as any).assignment.findMany({
      where: {
        employee_id: employeeId,
        shift: { date: { gte: weekStart, lt: weekEnd } },
        status: { not: "CANCELLED" },
      },
      include: { shift: true },
    }),
    (prisma as any).timeOffRequest.findMany({
      where: {
        employee_id: employeeId,
        status: "APPROVED",
        start_date: { lte: weekEnd },
        end_date: { gte: weekStart },
      },
    }),
  ]);

  if (!employee) return null;

  // Build set of absent dates
  const absentDates = new Set<string>();
  for (const tor of timeOffRequests as any[]) {
    const d = new Date(tor.start_date);
    while (d <= tor.end_date) {
      absentDates.add(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }

  let scheduled_hours = 0;
  let absent_hours = 0;

  for (const asgn of assignments as any[]) {
    const shiftDate = new Date(asgn.shift.date).toISOString().slice(0, 10);
    scheduled_hours += asgn.assigned_hours ?? 0;
    if (absentDates.has(shiftDate)) {
      absent_hours += asgn.assigned_hours ?? 0;
    }
  }

  const worked_hours = scheduled_hours - absent_hours;
  const hourly_rate = employee.hourly_rate ?? 0;
  const gross_pay = worked_hours * hourly_rate;

  return {
    employee_id: employeeId,
    employee_name: employee.name,
    week_start: weekStart,
    scheduled_hours,
    absent_hours,
    worked_hours,
    hourly_rate,
    gross_pay,
    currency: employee.currency ?? "GBP",
    weekly_hours_target: employee.weekly_hours_target,
  };
}

// ─── GET /api/salary/:employeeId/:weekStart ───────────────────────────────────

salaryRouter.get("/:employeeId/:weekStart", async (req, res) => {
  const weekStart = new Date(req.params["weekStart"]);
  if (isNaN(weekStart.getTime())) {
    throw new ApiError(400, "INVALID_DATE", "weekStart must be a valid date");
  }

  const summary = await computePaySummary(req.params["employeeId"], weekStart);
  if (!summary) throw new ApiError(404, "NOT_FOUND", "Employee not found");

  res.json({ success: true, data: summary });
});

// ─── GET /api/salary/team/:weekStart ─────────────────────────────────────────

salaryRouter.get("/team/:weekStart", async (req, res) => {
  const weekStart = new Date(req.params["weekStart"]);
  if (isNaN(weekStart.getTime())) {
    throw new ApiError(400, "INVALID_DATE", "weekStart must be a valid date");
  }

  const employees = await (prisma as any).employee.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });

  const summaries = await Promise.all(
    (employees as any[]).map((e: any) => computePaySummary(e.id, weekStart))
  );

  const valid = summaries.filter(Boolean) as NonNullable<typeof summaries[0]>[];
  valid.sort((a, b) => b!.gross_pay - a!.gross_pay);
  const team_total_gross = valid.reduce((s, e) => s + e!.gross_pay, 0);

  res.json({ success: true, data: { employees: valid, team_total_gross } });
});
