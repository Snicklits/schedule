/**
 * Shift Repository
 *
 * All database access for the Shift model.
 */

import type { Shift } from "../constraintEngine/types.js";
import { prisma } from "../lib/prisma.js";
import { toShift } from "./mappers.js";

/** Returns all shifts whose `date` falls within the 7-day window starting at weekStart. */
export async function getShiftsByWeek(weekStart: Date): Promise<Shift[]> {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  const rows = await prisma.shift.findMany({
    where: {
      date: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
    orderBy: [{ date: "asc" }, { start_time: "asc" }],
  });
  return rows.map(toShift);
}

/** Returns a single shift by ID, or null if not found. */
export async function getShiftById(id: string): Promise<Shift | null> {
  const row = await prisma.shift.findUnique({ where: { id } });
  return row ? toShift(row) : null;
}

/** Returns all peak shifts for the given week. */
export async function getPeakShiftsForWeek(weekStart: Date): Promise<Shift[]> {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  const rows = await prisma.shift.findMany({
    where: {
      date: { gte: weekStart, lte: weekEnd },
      is_peak_shift: true,
    },
    orderBy: [{ date: "asc" }, { start_time: "asc" }],
  });
  return rows.map(toShift);
}

/** Marks a shift as peak (or non-peak). */
export async function markShiftAsPeak(
  id: string,
  isPeak: boolean
): Promise<Shift> {
  const row = await prisma.shift.update({
    where: { id },
    data: { is_peak_shift: isPeak },
  });
  return toShift(row);
}

/** Creates a new shift. */
export async function createShift(
  data: Omit<Shift, "id"> & { location?: string }
): Promise<Shift> {
  const row = await prisma.shift.create({
    data: {
      date: data.date,
      start_time: data.start_time,
      end_time: data.end_time,
      duration_hours: data.duration_hours,
      required_specialty: data.required_specialty,
      min_staff_count: data.min_staff_count,
      location: data.location,
      is_peak_shift: data.is_peak_shift,
      requires_management_presence: data.requires_management_presence,
    },
  });
  return toShift(row);
}
