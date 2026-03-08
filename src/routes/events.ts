/**
 * Events Routes — Phase 9
 *
 * Historical Events:
 *   POST /api/events/historical         — log a past event
 *   GET  /api/events/historical         — list historical events
 *
 * Upcoming Events:
 *   POST /api/events/upcoming           — create upcoming event
 *   GET  /api/events/upcoming           — list all upcoming events
 *   GET  /api/events/upcoming/next30    — events in next 30 days
 *   PUT  /api/events/upcoming/:id       — update upcoming event
 */

import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../api/errors.js";
import { z } from "zod";
import { parseBody } from "../api/validate.js";

export const eventsRouter = Router();

const historicalEventSchema = z.object({
  name: z.string().min(1),
  event_type: z.string().min(1),
  date: z.string(),
  staff_used: z.number().int().nonnegative(),
  hours_used: z.number().nonnegative(),
  notes: z.string().optional(),
});

const upcomingEventSchema = z.object({
  name: z.string().min(1),
  event_type: z.string().min(1),
  date: z.string(),
  confirmed_staff: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

const updateUpcomingSchema = upcomingEventSchema.partial();

// ─── Recommendation helper ────────────────────────────────────────────────────

async function getRecommendation(name: string, event_type: string) {
  // First try exact name match
  let history = await (prisma as any).historicalEvent.findMany({
    where: { name },
  });
  // Fall back to event_type match
  if ((history as any[]).length === 0) {
    history = await (prisma as any).historicalEvent.findMany({
      where: { event_type },
    });
  }
  if ((history as any[]).length === 0) return { recommended_staff: null, recommended_hours: null };

  const avgStaff = Math.ceil(
    (history as any[]).reduce((s: number, e: any) => s + e.staff_used, 0) / history.length
  );
  const avgHours =
    Math.ceil(
      ((history as any[]).reduce((s: number, e: any) => s + e.hours_used, 0) / history.length) * 10
    ) / 10;
  return { recommended_staff: avgStaff, recommended_hours: avgHours };
}

// ─── Historical Events ────────────────────────────────────────────────────────

eventsRouter.post("/historical", async (req, res) => {
  const body = parseBody(historicalEventSchema, req);
  const event = await (prisma as any).historicalEvent.create({
    data: {
      ...body,
      date: new Date(body.date),
    },
  });
  res.status(201).json({ success: true, data: event });
});

eventsRouter.get("/historical", async (_req, res) => {
  const events = await (prisma as any).historicalEvent.findMany({
    orderBy: { date: "desc" },
  });
  res.json({ success: true, data: events });
});

// ─── Upcoming Events ──────────────────────────────────────────────────────────

eventsRouter.post("/upcoming", async (req, res) => {
  const body = parseBody(upcomingEventSchema, req);
  const rec = await getRecommendation(body.name, body.event_type);
  const event = await (prisma as any).upcomingEvent.create({
    data: {
      ...body,
      date: new Date(body.date),
      recommended_staff: rec.recommended_staff,
      recommended_hours: rec.recommended_hours,
    },
  });
  res.status(201).json({ success: true, data: event });
});

eventsRouter.get("/upcoming", async (_req, res) => {
  const events = await (prisma as any).upcomingEvent.findMany({
    orderBy: { date: "asc" },
  });
  res.json({ success: true, data: events });
});

eventsRouter.get("/upcoming/next30", async (_req, res) => {
  const now = new Date();
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);
  const events = await (prisma as any).upcomingEvent.findMany({
    where: { date: { gte: now, lte: in30 } },
    orderBy: { date: "asc" },
  });
  res.json({ success: true, data: events });
});

eventsRouter.put("/upcoming/:id", async (req, res) => {
  const body = parseBody(updateUpcomingSchema, req);
  const existing = await (prisma as any).upcomingEvent.findUnique({
    where: { id: req.params["id"] },
  });
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Upcoming event not found");

  const updateData: Record<string, any> = { ...body };
  if (body.date) updateData["date"] = new Date(body.date);

  // Refresh recommendation if name/type changed
  if (body.name || body.event_type) {
    const rec = await getRecommendation(
      body.name ?? existing.name,
      body.event_type ?? existing.event_type
    );
    updateData["recommended_staff"] = rec.recommended_staff;
    updateData["recommended_hours"] = rec.recommended_hours;
  }

  const event = await (prisma as any).upcomingEvent.update({
    where: { id: req.params["id"] },
    data: updateData,
  });
  res.json({ success: true, data: event });
});
