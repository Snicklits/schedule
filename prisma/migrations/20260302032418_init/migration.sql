-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME');

-- CreateEnum
CREATE TYPE "ManagementTier" AS ENUM ('MANAGER', 'ASSISTANT_MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "TimeOffType" AS ENUM ('VACATION', 'SICK', 'PERSONAL', 'UNPAID');

-- CreateEnum
CREATE TYPE "TimeOffStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'SWAPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConflictResolutionStrategy" AS ENUM ('SENIORITY_FIRST', 'ROUND_ROBIN', 'MANUAL');

-- CreateEnum
CREATE TYPE "ScheduleRunStatus" AS ENUM ('SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "ViolationSeverity" AS ENUM ('BLOCKING', 'WARNING');

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "employment_type" "EmploymentType" NOT NULL,
    "weekly_hours_target" INTEGER NOT NULL,
    "hire_date" TIMESTAMP(3) NOT NULL,
    "seniority_level" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "hierarchy_rank" INTEGER NOT NULL,
    "management_tier" "ManagementTier" NOT NULL,
    "specialties" TEXT[],
    "status" "EmployeeStatus" NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "duration_hours" DOUBLE PRECISION NOT NULL,
    "required_specialty" TEXT,
    "min_staff_count" INTEGER NOT NULL,
    "location" TEXT,
    "is_peak_shift" BOOLEAN NOT NULL DEFAULT false,
    "requires_management_presence" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeOffRequest" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "type" "TimeOffType" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" "TimeOffStatus" NOT NULL,
    "priority" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeOffRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL,
    "assigned_hours" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleConfig" (
    "id" TEXT NOT NULL,
    "max_consecutive_days" INTEGER NOT NULL DEFAULT 5,
    "max_weekly_hours" INTEGER NOT NULL DEFAULT 40,
    "overtime_threshold" INTEGER NOT NULL DEFAULT 40,
    "min_rest_hours_between_shifts" INTEGER NOT NULL,
    "schedule_period_days" INTEGER NOT NULL DEFAULT 7,
    "conflict_resolution_strategy" "ConflictResolutionStrategy" NOT NULL,
    "peak_windows" JSONB NOT NULL,
    "max_team_off_percentage" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ScheduleConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleRun" (
    "id" TEXT NOT NULL,
    "week_start" TIMESTAMP(3) NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL,
    "config_snapshot" JSONB NOT NULL,
    "status" "ScheduleRunStatus" NOT NULL,
    "error_log" TEXT,

    CONSTRAINT "ScheduleRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstraintViolation" (
    "id" TEXT NOT NULL,
    "schedule_run_id" TEXT NOT NULL,
    "shift_id" TEXT,
    "employee_id" TEXT,
    "rule" TEXT NOT NULL,
    "severity" "ViolationSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "overridden_by" TEXT,
    "override_reason" TEXT,
    "override_at" TIMESTAMP(3),

    CONSTRAINT "ConstraintViolation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- AddForeignKey
ALTER TABLE "TimeOffRequest" ADD CONSTRAINT "TimeOffRequest_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstraintViolation" ADD CONSTRAINT "ConstraintViolation_schedule_run_id_fkey" FOREIGN KEY ("schedule_run_id") REFERENCES "ScheduleRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstraintViolation" ADD CONSTRAINT "ConstraintViolation_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstraintViolation" ADD CONSTRAINT "ConstraintViolation_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
