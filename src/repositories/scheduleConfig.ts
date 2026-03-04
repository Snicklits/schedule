/**
 * ScheduleConfig Repository
 *
 * Fetches the single active ScheduleConfig row and maps it to the engine's
 * ScheduleConfig interface.  Phase 5 uses this to pass config into
 * generateSchedule and saveScheduleGeneration.
 */

import type { ScheduleConfig } from "../constraintEngine/types.js";
import { prisma } from "../lib/prisma.js";

export async function getActiveScheduleConfig(): Promise<ScheduleConfig | null> {
  const row = await prisma.scheduleConfig.findFirst();
  if (!row) return null;

  // peak_windows stored as Json; map to engine PeakWindow[] shape if present.
  const rawWindows = Array.isArray(row.peak_windows) ? row.peak_windows : [];
  const peak_windows = (rawWindows as Array<Record<string, string>>)
    .filter((w) => typeof w.start_time === "string" && typeof w.end_time === "string")
    .map((w) => ({ start: w.start_time, end: w.end_time }));

  return {
    max_consecutive_days: row.max_consecutive_days,
    max_weekly_hours: row.max_weekly_hours,
    overtime_threshold: row.overtime_threshold,
    min_rest_hours_between_shifts: row.min_rest_hours_between_shifts,
    schedule_period_days: row.schedule_period_days,
    max_team_off_percentage: row.max_team_off_percentage,
    peak_windows: peak_windows.length > 0 ? peak_windows : undefined,
  };
}
