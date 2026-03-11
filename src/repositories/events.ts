import { prisma } from "../lib/prisma.js";

export interface HistoricalEventRecord {
  id: string;
  name: string;
  event_type: string;
  date: Date;
  day_of_week: string;
  staff_used: number;
  hours_used: number;
  notes: string | null;
  created_at: Date;
}

export interface UpcomingEventRecord {
  id: string;
  name: string;
  event_type: string;
  date: Date;
  recommended_staff: number | null;
  recommended_hours: number | null;
  confirmed_staff: number | null;
  notes: string | null;
}

export async function createHistoricalEvent(data: {
  name: string;
  event_type: string;
  date: Date;
  day_of_week: string;
  staff_used: number;
  hours_used: number;
  notes?: string | null;
}): Promise<HistoricalEventRecord> {
  return prisma.historicalEvent.create({ data });
}

export async function getAllHistoricalEvents(type?: string): Promise<HistoricalEventRecord[]> {
  return prisma.historicalEvent.findMany({
    where: type ? { event_type: type } : undefined,
    orderBy: { date: "desc" },
  });
}

export async function calculateRecommendation(
  name: string,
  type: string
): Promise<{ staff: number | null; hours: number | null }> {
  // Try exact name match first
  let events = await prisma.historicalEvent.findMany({ where: { name } });

  // Fall back to type match
  if (events.length === 0) {
    events = await prisma.historicalEvent.findMany({ where: { event_type: type } });
  }

  if (events.length === 0) return { staff: null, hours: null };

  const avgStaff = events.reduce((s, e) => s + e.staff_used, 0) / events.length;
  const avgHours = events.reduce((s, e) => s + e.hours_used, 0) / events.length;

  return {
    staff: Math.ceil(avgStaff),
    hours: Math.ceil(avgHours),
  };
}

export async function createUpcomingEvent(data: {
  name: string;
  event_type: string;
  date: Date;
  recommended_staff?: number | null;
  recommended_hours?: number | null;
  confirmed_staff?: number | null;
  notes?: string | null;
}): Promise<UpcomingEventRecord> {
  return prisma.upcomingEvent.create({ data });
}

export async function getAllUpcomingEvents(): Promise<UpcomingEventRecord[]> {
  return prisma.upcomingEvent.findMany({ orderBy: { date: "asc" } });
}

export async function getUpcomingEventsNext30Days(): Promise<UpcomingEventRecord[]> {
  const now = new Date();
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  return prisma.upcomingEvent.findMany({
    where: { date: { gte: now, lte: in30 } },
    orderBy: { date: "asc" },
  });
}

export async function updateUpcomingEvent(
  id: string,
  data: { confirmed_staff?: number | null; notes?: string | null }
): Promise<UpcomingEventRecord> {
  return prisma.upcomingEvent.update({ where: { id }, data });
}
