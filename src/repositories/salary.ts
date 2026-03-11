import { prisma } from "../lib/prisma.js";

export interface PaySummaryRecord {
  id: string;
  employee_id: string;
  week_start: Date;
  scheduled_hours: number;
  absent_hours: number;
  worked_hours: number;
  hourly_rate: number;
  gross_pay: number;
  calculated_at: Date;
}

export interface PaySummaryWithEmployee extends PaySummaryRecord {
  employee: {
    id: string;
    name: string;
    role: string;
    management_tier: string;
    hourly_rate: number | null;
    currency: string;
  };
}

async function computePaySummary(
  employeeId: string,
  weekStart: Date
): Promise<Omit<PaySummaryRecord, "id" | "calculated_at"> | null> {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee || employee.hourly_rate == null) return null;

  // Scheduled hours
  const assignments = await prisma.assignment.findMany({
    where: {
      employee_id: employeeId,
      status: { not: "CANCELLED" },
      shift: { date: { gte: weekStart, lte: weekEnd } },
    },
    include: { shift: true },
  });
  const scheduledHours = assignments.reduce((s, a) => s + a.assigned_hours, 0);

  // Absent hours: shifts on days with approved time-off
  const approvedTimeOff = await prisma.timeOffRequest.findMany({
    where: {
      employee_id: employeeId,
      status: "APPROVED",
      start_date: { lte: weekEnd },
      end_date: { gte: weekStart },
    },
  });

  let absentHours = 0;
  for (const req of approvedTimeOff) {
    for (const a of assignments) {
      const shiftDate = new Date(a.shift.date);
      shiftDate.setUTCHours(0, 0, 0, 0);
      const startDate = new Date(req.start_date);
      startDate.setUTCHours(0, 0, 0, 0);
      const endDate = new Date(req.end_date);
      endDate.setUTCHours(0, 0, 0, 0);
      if (shiftDate >= startDate && shiftDate <= endDate) {
        absentHours += a.assigned_hours;
      }
    }
  }

  const workedHours = Math.max(0, scheduledHours - absentHours);
  const grossPay = workedHours * employee.hourly_rate;

  return {
    employee_id: employeeId,
    week_start: weekStart,
    scheduled_hours: scheduledHours,
    absent_hours: absentHours,
    worked_hours: workedHours,
    hourly_rate: employee.hourly_rate,
    gross_pay: grossPay,
  };
}

export async function getPaySummary(
  employeeId: string,
  weekStart: Date
): Promise<(PaySummaryRecord & { employee: { name: string; role: string; weekly_hours_target: number } }) | null> {
  const computed = await computePaySummary(employeeId, weekStart);
  if (!computed) return null;

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return null;

  const saved = await prisma.paySummary.upsert({
    where: {
      employee_id_week_start: { employee_id: employeeId, week_start: weekStart },
    },
    update: { ...computed, calculated_at: new Date() },
    create: computed,
    include: { employee: true },
  });

  return {
    ...saved,
    employee: {
      name: saved.employee.name,
      role: saved.employee.role,
      weekly_hours_target: saved.employee.weekly_hours_target,
    },
  };
}

export async function getTeamPaySummary(weekStart: Date): Promise<{
  summaries: PaySummaryWithEmployee[];
  team_total_gross: number;
}> {
  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE", hourly_rate: { not: null } },
  });

  const summaries: PaySummaryWithEmployee[] = [];

  for (const emp of employees) {
    const computed = await computePaySummary(emp.id, weekStart);
    if (!computed) continue;

    const saved = await prisma.paySummary.upsert({
      where: {
        employee_id_week_start: { employee_id: emp.id, week_start: weekStart },
      },
      update: { ...computed, calculated_at: new Date() },
      create: computed,
    });

    summaries.push({
      ...saved,
      employee: {
        id: emp.id,
        name: emp.name,
        role: emp.role,
        management_tier: emp.management_tier,
        hourly_rate: emp.hourly_rate,
        currency: emp.currency,
      },
    });
  }

  // Sort by gross pay descending
  summaries.sort((a, b) => b.gross_pay - a.gross_pay);

  const team_total_gross = summaries.reduce((s, r) => s + r.gross_pay, 0);

  return { summaries, team_total_gross };
}
