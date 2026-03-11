import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"]! });
const prisma = new PrismaClient({ adapter });

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function dt(iso: string): Date {
  return new Date(iso);
}

/**
 * Build a full DateTime for a specific date + HH:MM time string.
 * Prisma stores DateTime as ISO strings; using noon-ish offsets avoids
 * DST edge cases for date-only fields.
 */
function dateAt(date: string, time: string): Date {
  return new Date(`${date}T${time}:00.000Z`);
}

// ─────────────────────────────────────────────
// Seed weeks:
//   Week 1: Mon 2026-03-02 → Sun 2026-03-08
//   Week 2: Mon 2026-03-09 → Sun 2026-03-15
// ─────────────────────────────────────────────
const WEEK1 = {
  MON: "2026-03-02",
  TUE: "2026-03-03",
  WED: "2026-03-04",
  THU: "2026-03-05",
  FRI: "2026-03-06",
  SAT: "2026-03-07",
  SUN: "2026-03-08",
};

const WEEK2 = {
  MON: "2026-03-09",
  TUE: "2026-03-10",
  WED: "2026-03-11",
  THU: "2026-03-12",
  FRI: "2026-03-13",
  SAT: "2026-03-14",
  SUN: "2026-03-15",
};

type DayKey = keyof typeof WEEK1;

async function main() {
  console.log("🌱  Seeding database...\n");

  // Idempotency guard — skip if already seeded
  const existing = await prisma.employee.count();
  if (existing > 0) {
    console.log(`ℹ️   Database already seeded (${existing} employees found). Skipping.\n`);
    await printSummary();
    return;
  }

  // ── Employees ────────────────────────────────
  // 2 Managers
  const mgr1 = await prisma.employee.create({
    data: {
      name: "Alice Hartman",
      email: "alice.hartman@store.com",
      employment_type: "FULL_TIME",
      weekly_hours_target: 40,
      hire_date: dt("2018-04-15"),
      seniority_level: 8,
      role: "Manager",
      hierarchy_rank: 1,
      management_tier: "MANAGER",
      specialties: ["cashier", "inventory", "forklift"],
      status: "ACTIVE",
    },
  });

  const mgr2 = await prisma.employee.create({
    data: {
      name: "Brian Okafor",
      email: "brian.okafor@store.com",
      employment_type: "FULL_TIME",
      weekly_hours_target: 40,
      hire_date: dt("2019-07-01"),
      seniority_level: 7,
      role: "Manager",
      hierarchy_rank: 2,
      management_tier: "MANAGER",
      specialties: ["cashier", "customer_service", "training"],
      status: "ACTIVE",
    },
  });

  // 3 Assistant Managers
  const am1 = await prisma.employee.create({
    data: {
      name: "Carmen Delgado",
      email: "carmen.delgado@store.com",
      employment_type: "FULL_TIME",
      weekly_hours_target: 40,
      hire_date: dt("2020-02-10"),
      seniority_level: 6,
      role: "Assistant Manager",
      hierarchy_rank: 3,
      management_tier: "ASSISTANT_MANAGER",
      specialties: ["cashier", "customer_service"],
      status: "ACTIVE",
    },
  });

  const am2 = await prisma.employee.create({
    data: {
      name: "Derek Phung",
      email: "derek.phung@store.com",
      employment_type: "FULL_TIME",
      weekly_hours_target: 40,
      hire_date: dt("2020-09-22"),
      seniority_level: 5,
      role: "Assistant Manager",
      hierarchy_rank: 4,
      management_tier: "ASSISTANT_MANAGER",
      specialties: ["cashier", "forklift", "inventory"],
      status: "ACTIVE",
    },
  });

  const am3 = await prisma.employee.create({
    data: {
      name: "Eva Kowalski",
      email: "eva.kowalski@store.com",
      employment_type: "FULL_TIME",
      weekly_hours_target: 40,
      hire_date: dt("2021-03-05"),
      seniority_level: 4,
      role: "Assistant Manager",
      hierarchy_rank: 5,
      management_tier: "ASSISTANT_MANAGER",
      specialties: ["cashier", "training"],
      status: "ACTIVE",
    },
  });

  // 10 Staff (mix of full-time and part-time, varied specialties)
  const staff = await Promise.all([
    prisma.employee.create({
      data: {
        name: "Frank Rosario",
        email: "frank.rosario@store.com",
        employment_type: "FULL_TIME",
        weekly_hours_target: 40,
        hire_date: dt("2021-06-14"),
        seniority_level: 3,
        role: "Lead",
        hierarchy_rank: 6,
        management_tier: "STAFF",
        specialties: ["cashier", "forklift"],
        status: "ACTIVE",
      },
    }),
    prisma.employee.create({
      data: {
        name: "Grace Nwosu",
        email: "grace.nwosu@store.com",
        employment_type: "FULL_TIME",
        weekly_hours_target: 40,
        hire_date: dt("2021-11-01"),
        seniority_level: 3,
        role: "Lead",
        hierarchy_rank: 7,
        management_tier: "STAFF",
        specialties: ["cashier", "customer_service"],
        status: "ACTIVE",
      },
    }),
    prisma.employee.create({
      data: {
        name: "Hank Bouchard",
        email: "hank.bouchard@store.com",
        employment_type: "FULL_TIME",
        weekly_hours_target: 40,
        hire_date: dt("2022-01-19"),
        seniority_level: 3,
        role: "Associate",
        hierarchy_rank: 8,
        management_tier: "STAFF",
        specialties: ["cashier", "inventory"],
        status: "ACTIVE",
      },
    }),
    prisma.employee.create({
      data: {
        name: "Ingrid Sato",
        email: "ingrid.sato@store.com",
        employment_type: "PART_TIME",
        weekly_hours_target: 32,
        hire_date: dt("2022-04-11"),
        seniority_level: 2,
        role: "Associate",
        hierarchy_rank: 9,
        management_tier: "STAFF",
        specialties: ["cashier"],
        status: "ACTIVE",
      },
    }),
    prisma.employee.create({
      data: {
        name: "James Tran",
        email: "james.tran@store.com",
        employment_type: "PART_TIME",
        weekly_hours_target: 20,
        hire_date: dt("2022-08-30"),
        seniority_level: 2,
        role: "Associate",
        hierarchy_rank: 10,
        management_tier: "STAFF",
        specialties: ["cashier", "stocking"],
        status: "ACTIVE",
      },
    }),
    prisma.employee.create({
      data: {
        name: "Kira Mendez",
        email: "kira.mendez@store.com",
        employment_type: "FULL_TIME",
        weekly_hours_target: 40,
        hire_date: dt("2022-10-03"),
        seniority_level: 2,
        role: "Associate",
        hierarchy_rank: 11,
        management_tier: "STAFF",
        specialties: ["stocking", "inventory"],
        status: "ACTIVE",
      },
    }),
    prisma.employee.create({
      data: {
        name: "Leo Park",
        email: "leo.park@store.com",
        employment_type: "PART_TIME",
        weekly_hours_target: 20,
        hire_date: dt("2023-02-20"),
        seniority_level: 1,
        role: "Associate",
        hierarchy_rank: 12,
        management_tier: "STAFF",
        specialties: ["cashier"],
        status: "ACTIVE",
      },
    }),
    prisma.employee.create({
      data: {
        name: "Mia Johansson",
        email: "mia.johansson@store.com",
        employment_type: "PART_TIME",
        weekly_hours_target: 24,
        hire_date: dt("2023-05-15"),
        seniority_level: 1,
        role: "Associate",
        hierarchy_rank: 13,
        management_tier: "STAFF",
        specialties: ["customer_service", "cashier"],
        status: "ACTIVE",
      },
    }),
    prisma.employee.create({
      data: {
        name: "Noah Adesanya",
        email: "noah.adesanya@store.com",
        employment_type: "FULL_TIME",
        weekly_hours_target: 40,
        hire_date: dt("2023-09-01"),
        seniority_level: 1,
        role: "Associate",
        hierarchy_rank: 14,
        management_tier: "STAFF",
        specialties: ["forklift", "stocking"],
        status: "ACTIVE",
      },
    }),
    prisma.employee.create({
      data: {
        name: "Olivia Reyes",
        email: "olivia.reyes@store.com",
        employment_type: "PART_TIME",
        weekly_hours_target: 20,
        hire_date: dt("2024-01-08"),
        seniority_level: 1,
        role: "Associate",
        hierarchy_rank: 15,
        management_tier: "STAFF",
        specialties: ["cashier", "customer_service"],
        status: "ACTIVE",
      },
    }),
  ]);

  const [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10] = staff;

  console.log(`✅  Created 15 employees (2 managers, 3 AMs, 10 staff)`);

  // ── Shifts ────────────────────────────────────
  // Both weeks: Mon–Sun, 3 shifts per day: morning (06-14), afternoon (14-22), evening (18-02)
  // Peak: Friday evening, Saturday all day, Sunday all day

  type ShiftTemplate = {
    date: string;
    label: "morning" | "afternoon" | "evening";
    start: string;
    end: string;
    hours: number;
    isPeak: boolean;
    specialty?: string;
  };

  function buildWeekShifts(week: Record<DayKey, string>): ShiftTemplate[] {
    const days: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    const result: ShiftTemplate[] = [];
    for (const day of days) {
      const isPeakDay = day === "SAT" || day === "SUN";
      result.push(
        {
          date: week[day],
          label: "morning",
          start: "06:00",
          end: "14:00",
          hours: 8,
          isPeak: isPeakDay,
        },
        {
          date: week[day],
          label: "afternoon",
          start: "14:00",
          end: "22:00",
          hours: 8,
          isPeak: isPeakDay,
        },
        {
          date: week[day],
          label: "evening",
          start: "18:00",
          end: "02:00",
          hours: 8,
          // Friday evening + all Sat/Sun shifts are peak
          isPeak: isPeakDay || day === "FRI",
        }
      );
    }
    return result;
  }

  const shiftData = [...buildWeekShifts(WEEK1), ...buildWeekShifts(WEEK2)];

  const createdShifts = await Promise.all(
    shiftData.map((s) =>
      prisma.shift.create({
        data: {
          date: dt(`${s.date}T12:00:00.000Z`),
          start_time: dateAt(s.date, s.start),
          end_time: dateAt(s.date, s.end),
          duration_hours: s.hours,
          required_specialty: s.specialty ?? null,
          min_staff_count: s.isPeak ? 5 : 3,
          location: "Main Floor",
          is_peak_shift: s.isPeak,
          requires_management_presence: true,
        },
      })
    )
  );

  console.log(`✅  Created ${createdShifts.length} shifts (2 weeks × Mon–Sun × 3/day)`);

  // ── PeakWindow ────────────────────────────────
  // Three peak windows that align with the is_peak_shift flags above.
  await prisma.peakWindow.createMany({
    data: [
      {
        days: ["Friday"],
        start_time: "18:00",
        end_time: "02:00",
        label: "Friday Evening",
      },
      {
        days: ["Saturday"],
        start_time: "06:00",
        end_time: "02:00",
        label: "Saturday (all day)",
      },
      {
        days: ["Sunday"],
        start_time: "06:00",
        end_time: "22:00",
        label: "Sunday (all day)",
      },
    ],
  });

  console.log(`✅  Created 3 PeakWindow records`);

  // ── Time-Off Requests ─────────────────────────
  await prisma.timeOffRequest.createMany({
    data: [
      // Manager requesting vacation (high priority — seniority 8)
      {
        employee_id: mgr1.id,
        type: "VACATION",
        start_date: dt("2026-03-06T00:00:00.000Z"),
        end_date: dt("2026-03-08T00:00:00.000Z"),
        status: "PENDING",
        priority: mgr1.seniority_level,
        created_at: dt("2026-02-20T09:00:00.000Z"),
      },
      // Assistant Manager requesting sick leave (priority 5)
      {
        employee_id: am2.id,
        type: "SICK",
        start_date: dt("2026-03-04T00:00:00.000Z"),
        end_date: dt("2026-03-04T00:00:00.000Z"),
        status: "PENDING",
        priority: am2.seniority_level,
        created_at: dt("2026-03-03T07:30:00.000Z"),
      },
      // Staff requesting personal day (priority 3)
      {
        employee_id: s1.id,
        type: "PERSONAL",
        start_date: dt("2026-03-05T00:00:00.000Z"),
        end_date: dt("2026-03-05T00:00:00.000Z"),
        status: "PENDING",
        priority: s1.seniority_level,
        created_at: dt("2026-02-28T14:00:00.000Z"),
      },
      // Part-time staff requesting unpaid leave (priority 2)
      {
        employee_id: s4.id,
        type: "UNPAID",
        start_date: dt("2026-03-07T00:00:00.000Z"),
        end_date: dt("2026-03-08T00:00:00.000Z"),
        status: "PENDING",
        priority: s4.seniority_level,
        created_at: dt("2026-02-25T11:00:00.000Z"),
      },
      // Already-approved vacation for another staff member
      {
        employee_id: s6.id,
        type: "VACATION",
        start_date: dt("2026-03-02T00:00:00.000Z"),
        end_date: dt("2026-03-03T00:00:00.000Z"),
        status: "APPROVED",
        priority: s6.seniority_level,
        created_at: dt("2026-02-10T10:00:00.000Z"),
      },
      // Week 2: AM requests a day off mid-week
      {
        employee_id: am1.id,
        type: "PERSONAL",
        start_date: dt("2026-03-11T00:00:00.000Z"),
        end_date: dt("2026-03-11T00:00:00.000Z"),
        status: "APPROVED",
        priority: am1.seniority_level,
        created_at: dt("2026-03-01T08:00:00.000Z"),
      },
      // Week 2: staff requesting vacation
      {
        employee_id: s2.id,
        type: "VACATION",
        start_date: dt("2026-03-09T00:00:00.000Z"),
        end_date: dt("2026-03-13T00:00:00.000Z"),
        status: "APPROVED",
        priority: s2.seniority_level,
        created_at: dt("2026-02-15T09:00:00.000Z"),
      },
    ],
  });

  console.log(`✅  Created 7 time-off requests (5 week-1 + 2 week-2)`);

  // ── ScheduleConfig ────────────────────────────
  await prisma.scheduleConfig.create({
    data: {
      max_consecutive_days: 5,
      max_weekly_hours: 40,
      overtime_threshold: 40,
      min_rest_hours_between_shifts: 8,
      schedule_period_days: 7,
      conflict_resolution_strategy: "SENIORITY_FIRST",
      peak_windows: [
        { days: ["Friday"], start_time: "18:00", end_time: "02:00" },
        { days: ["Saturday"], start_time: "06:00", end_time: "02:00" },
        { days: ["Sunday"], start_time: "06:00", end_time: "22:00" },
      ],
      max_team_off_percentage: 0.3,
    },
  });

  console.log(`✅  Created ScheduleConfig`);

  // ── CompanyConfig ──────────────────────────────
  await prisma.companyConfig.upsert({
    where: { id: "default-config" },
    update: {},
    create: {
      id: "default-config",
      company_name: "My Company",
      currency: "GBP",
      timezone: "Europe/London",
      updated_by: "system",
    },
  });
  console.log(`✅  Created CompanyConfig`);

  // ── UserAccounts ───────────────────────────────
  // Create ACTIVE accounts with hashed passwords for each management tier
  // Default password: "password123" for all seed accounts
  const defaultPasswordHash = await bcrypt.hash("password123", 12);

  await prisma.userAccount.upsert({
    where: { employee_id: mgr1.id },
    update: {},
    create: {
      employee_id: mgr1.id,
      email: mgr1.email,
      password_hash: defaultPasswordHash,
      role: "MANAGER",
      status: "ACTIVE",
    },
  });

  await prisma.userAccount.upsert({
    where: { employee_id: mgr2.id },
    update: {},
    create: {
      employee_id: mgr2.id,
      email: mgr2.email,
      password_hash: defaultPasswordHash,
      role: "MANAGER",
      status: "ACTIVE",
    },
  });

  await prisma.userAccount.upsert({
    where: { employee_id: am1.id },
    update: {},
    create: {
      employee_id: am1.id,
      email: am1.email,
      password_hash: defaultPasswordHash,
      role: "ASSISTANT_MANAGER",
      status: "ACTIVE",
    },
  });

  await prisma.userAccount.upsert({
    where: { employee_id: s1.id },
    update: {},
    create: {
      employee_id: s1.id,
      email: s1.email,
      password_hash: defaultPasswordHash,
      role: "STAFF",
      status: "ACTIVE",
    },
  });

  console.log(`✅  Created 4 UserAccounts (default password: password123)`);

  // ── Summary ───────────────────────────────────
  console.log();
  await printSummary();
  console.log("\n🎉  Seed complete!\n");
  console.log("📝  Seed login credentials:");
  console.log(`   Manager:   alice.hartman@store.com / password123`);
  console.log(`   Manager:   brian.okafor@store.com / password123`);
  console.log(`   Asst Mgr:  carmen.delgado@store.com / password123`);
  console.log(`   Staff:     frank.rosario@store.com / password123`);
}

async function printSummary() {
  const counts = await Promise.all([
    prisma.employee.count(),
    prisma.shift.count(),
    prisma.timeOffRequest.count(),
    prisma.scheduleConfig.count(),
    prisma.peakWindow.count(),
  ]);
  console.log("📊  Database summary:");
  console.log(`   employees        : ${counts[0]}`);
  console.log(`   shifts           : ${counts[1]}`);
  console.log(`   time_off_requests: ${counts[2]}`);
  console.log(`   schedule_configs : ${counts[3]}`);
  console.log(`   peak_windows     : ${counts[4]}`);
}

main()
  .catch((e) => {
    console.error("❌  Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
