/**
 * PeakWindow Repository
 *
 * All database access for the PeakWindow table.
 * PeakWindows are small config records; the full list is loaded at schedule
 * generation time to flag which shifts are peak.
 */

import { prisma } from "../lib/prisma.js";

export interface PeakWindowRecord {
  id: string;
  days: string[];
  start_time: string;
  end_time: string;
  label: string | null;
}

/** Returns all configured peak windows. */
export async function getAllPeakWindows(): Promise<PeakWindowRecord[]> {
  return prisma.peakWindow.findMany({
    orderBy: { id: "asc" },
  });
}

/** Creates a new peak window configuration. */
export async function createPeakWindow(data: {
  days: string[];
  start_time: string;
  end_time: string;
  label?: string;
}): Promise<PeakWindowRecord> {
  return prisma.peakWindow.create({
    data: {
      days: data.days,
      start_time: data.start_time,
      end_time: data.end_time,
      label: data.label ?? null,
    },
  });
}

/** Deletes a peak window by ID. */
export async function deletePeakWindow(id: string): Promise<void> {
  await prisma.peakWindow.delete({ where: { id } });
}
