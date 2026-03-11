import { prisma } from "../lib/prisma.js";

export interface WeeklyBudgetRecord {
  id: string;
  week_start: Date;
  total_hours_budget: number;
  created_by: string;
  created_at: Date;
  notes: string | null;
}

export async function upsertWeeklyBudget(data: {
  week_start: Date;
  total_hours_budget: number;
  created_by: string;
  notes?: string | null;
}): Promise<WeeklyBudgetRecord> {
  return prisma.weeklyBudget.upsert({
    where: { week_start: data.week_start },
    update: {
      total_hours_budget: data.total_hours_budget,
      created_by: data.created_by,
      notes: data.notes ?? null,
    },
    create: {
      week_start: data.week_start,
      total_hours_budget: data.total_hours_budget,
      created_by: data.created_by,
      notes: data.notes ?? null,
    },
  });
}

export async function getWeeklyBudget(weekStart: Date): Promise<WeeklyBudgetRecord | null> {
  return prisma.weeklyBudget.findUnique({ where: { week_start: weekStart } });
}

export async function getScheduledHoursForWeek(weekStart: Date): Promise<number> {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  const result = await prisma.assignment.aggregate({
    _sum: { assigned_hours: true },
    where: {
      shift: {
        date: { gte: weekStart, lte: weekEnd },
      },
      status: { not: "CANCELLED" },
    },
  });
  return result._sum.assigned_hours ?? 0;
}
