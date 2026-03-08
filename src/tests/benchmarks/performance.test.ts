/**
 * Performance Benchmark — Schedule Generation
 *
 * Seeds 50 employees (5 Managers, 8 AMs, 37 Staff) with randomised
 * contracts and specialties, generates a full week schedule, and asserts
 * that the generation completes in under 3 seconds.
 *
 * The actual elapsed time is logged to the console for profiling.
 */

import { describe, it, expect } from "vitest";
import { generateSchedule } from "../../scheduler/index.js";
import { ManagementTier, EmploymentType } from "../../constraintEngine/types.js";
import type { Employee, Shift, ScheduleConfig } from "../../constraintEngine/types.js";
import { WEEK_START, weekDay, makeEmployee, makeShift, defaultConfig } from "../fixtures/seed.js";

// ─── Deterministic pseudo-random helper (seeded, no external deps) ────────────

function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// ─── Employee factory ─────────────────────────────────────────────────────────

function buildEmployees(): Employee[] {
  const rand = lcg(42);
  const specialtyPool = ["barista", "trainer", "opener", "closer", "sommelier"];
  const employees: Employee[] = [];

  // 5 Managers
  for (let i = 0; i < 5; i++) {
    employees.push(
      makeEmployee({
        id: `bench-mgr-${i}`,
        name: `Manager ${i}`,
        management_tier: ManagementTier.MANAGER,
        employment_type: EmploymentType.FULL_TIME,
        weekly_hours_target: 40,
        seniority_level: 10 - i,
        hierarchy_rank: i + 1,
        specialties: [specialtyPool[i % specialtyPool.length]!],
      })
    );
  }

  // 8 Assistant Managers
  for (let i = 0; i < 8; i++) {
    employees.push(
      makeEmployee({
        id: `bench-am-${i}`,
        name: `AM ${i}`,
        management_tier: ManagementTier.ASSISTANT_MANAGER,
        employment_type: EmploymentType.FULL_TIME,
        weekly_hours_target: 40,
        seniority_level: 5 + Math.floor(rand() * 3),
        hierarchy_rank: 6 + i,
        specialties: rand() > 0.5 ? [specialtyPool[Math.floor(rand() * specialtyPool.length)]!] : [],
      })
    );
  }

  // 37 Staff
  for (let i = 0; i < 37; i++) {
    const isPartTime = rand() < 0.2;
    const numSpecialties = Math.floor(rand() * 3);
    const specialties: string[] = [];
    for (let j = 0; j < numSpecialties; j++) {
      const spec = specialtyPool[Math.floor(rand() * specialtyPool.length)]!;
      if (!specialties.includes(spec)) specialties.push(spec);
    }
    employees.push(
      makeEmployee({
        id: `bench-staff-${i}`,
        name: `Staff ${i}`,
        management_tier: ManagementTier.STAFF,
        employment_type: isPartTime ? EmploymentType.PART_TIME : EmploymentType.FULL_TIME,
        weekly_hours_target: isPartTime ? 20 : 40,
        seniority_level: Math.max(1, Math.floor(rand() * 5)),
        hierarchy_rank: 15 + i,
        specialties,
      })
    );
  }

  return employees;
}

// ─── Shift factory ────────────────────────────────────────────────────────────

function buildShifts(): Shift[] {
  const shifts: Shift[] = [];
  const specialtyPool = ["barista", "trainer", "opener", "closer", "sommelier"];
  const rand = lcg(99);

  for (let day = 0; day < 7; day++) {
    // Morning shift
    shifts.push(
      makeShift({
        id: `bench-morning-${day}`,
        date: weekDay(day),
        start_time: weekDay(day, 7),
        end_time: weekDay(day, 15),
        duration_hours: 8,
        required_specialty: null,
        requires_management_presence: true,
        is_peak_shift: false,
        min_staff_count: 4,
      })
    );

    // Midday shift (specialty required on some days)
    shifts.push(
      makeShift({
        id: `bench-midday-${day}`,
        date: weekDay(day),
        start_time: weekDay(day, 11),
        end_time: weekDay(day, 19),
        duration_hours: 8,
        required_specialty: rand() > 0.7 ? specialtyPool[Math.floor(rand() * specialtyPool.length)]! : null,
        requires_management_presence: day >= 4, // peak days require management
        is_peak_shift: day >= 4 && day <= 5, // Fri/Sat peak
        min_staff_count: 3,
      })
    );

    // Evening shift (some days)
    if (day < 5) {
      shifts.push(
        makeShift({
          id: `bench-evening-${day}`,
          date: weekDay(day),
          start_time: weekDay(day, 15),
          end_time: weekDay(day, 23),
          duration_hours: 8,
          required_specialty: null,
          requires_management_presence: false,
          is_peak_shift: false,
          min_staff_count: 2,
        })
      );
    }
  }

  return shifts;
}

// ─── Benchmark test ───────────────────────────────────────────────────────────

describe("Performance Benchmark — 50 employees, full week", () => {
  it("generates a complete weekly schedule in under 3 seconds", () => {
    const employees = buildEmployees();
    const shifts = buildShifts();
    const config: ScheduleConfig = {
      ...defaultConfig,
      max_consecutive_days: 5,
      overtime_threshold: 40,
    };

    expect(employees).toHaveLength(50);
    expect(shifts.length).toBeGreaterThan(0);

    const start = performance.now();
    const result = generateSchedule(WEEK_START, employees, shifts, [], config);
    const elapsed = performance.now() - start;

    console.log(`\n⏱  Schedule generation (50 employees, ${shifts.length} shifts): ${elapsed.toFixed(1)} ms`);

    // Must complete in under 3 seconds
    expect(elapsed).toBeLessThan(3000);

    // Must produce a valid schedule with no blocking errors
    expect(result.errors).toHaveLength(0);
    expect(result.isPublishable).toBe(true);

    // Must produce assignments (non-trivial output)
    expect(result.schedule.length).toBeGreaterThan(0);

    console.log(`   Assignments produced: ${result.schedule.length}`);
    console.log(`   Warnings: ${result.warnings.length}`);
  });

  it("stays under 3 seconds even with abundant time-off requests", () => {
    const employees = buildEmployees();
    const shifts = buildShifts();

    // 20% of staff have pending time-off requests scattered across the week
    const rand = lcg(123);
    const requests = employees
      .filter((e) => e.management_tier === ManagementTier.STAFF && rand() < 0.2)
      .map((e) => {
        const startDay = Math.floor(rand() * 5);
        const endDay = startDay + Math.floor(rand() * 2);
        return {
          id: `bench-tor-${e.id}`,
          employee_id: e.id,
          start_date: weekDay(startDay),
          end_date: weekDay(Math.min(endDay, 6)),
          status: "PENDING" as const,
          created_at: new Date("2026-02-15"),
          priority: 0,
        };
      });

    const start = performance.now();
    const result = generateSchedule(WEEK_START, employees, shifts, requests, defaultConfig);
    const elapsed = performance.now() - start;

    console.log(`\n⏱  Schedule generation with ${requests.length} time-off requests: ${elapsed.toFixed(1)} ms`);

    expect(elapsed).toBeLessThan(3000);
    expect(result.errors).toHaveLength(0);
  });
});
