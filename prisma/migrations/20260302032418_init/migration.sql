-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "employment_type" TEXT NOT NULL,
    "weekly_hours_target" INTEGER NOT NULL,
    "hire_date" DATETIME NOT NULL,
    "seniority_level" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "hierarchy_rank" INTEGER NOT NULL,
    "management_tier" TEXT NOT NULL,
    "specialties" JSONB NOT NULL,
    "status" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "start_time" DATETIME NOT NULL,
    "end_time" DATETIME NOT NULL,
    "duration_hours" REAL NOT NULL,
    "required_specialty" TEXT,
    "min_staff_count" INTEGER NOT NULL,
    "location" TEXT,
    "is_peak_shift" BOOLEAN NOT NULL DEFAULT false,
    "requires_management_presence" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "TimeOffRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL,
    CONSTRAINT "TimeOffRequest_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "assigned_hours" REAL NOT NULL,
    CONSTRAINT "Assignment_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "max_consecutive_days" INTEGER NOT NULL DEFAULT 5,
    "max_weekly_hours" INTEGER NOT NULL DEFAULT 40,
    "overtime_threshold" INTEGER NOT NULL DEFAULT 40,
    "min_rest_hours_between_shifts" INTEGER NOT NULL,
    "schedule_period_days" INTEGER NOT NULL DEFAULT 7,
    "conflict_resolution_strategy" TEXT NOT NULL,
    "peak_windows" JSONB NOT NULL,
    "max_team_off_percentage" REAL NOT NULL
);

-- CreateTable
CREATE TABLE "ScheduleRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "week_start" DATETIME NOT NULL,
    "generated_at" DATETIME NOT NULL,
    "config_snapshot" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "error_log" TEXT
);

-- CreateTable
CREATE TABLE "ConstraintViolation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schedule_run_id" TEXT NOT NULL,
    "shift_id" TEXT,
    "employee_id" TEXT,
    "rule" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "overridden_by" TEXT,
    "override_reason" TEXT,
    "override_at" DATETIME,
    CONSTRAINT "ConstraintViolation_schedule_run_id_fkey" FOREIGN KEY ("schedule_run_id") REFERENCES "ScheduleRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConstraintViolation_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "Shift" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ConstraintViolation_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");
