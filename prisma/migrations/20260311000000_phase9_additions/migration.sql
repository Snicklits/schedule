-- Phase 9 additions: Labor Budget, Event Intelligence, Salary, Auth, Avatar, Company Branding

-- Add new columns to Employee
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "hourly_rate" DOUBLE PRECISION;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'GBP';
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;

-- AccountStatus enum
DO $$ BEGIN
  CREATE TYPE "AccountStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- WeeklyBudget
CREATE TABLE IF NOT EXISTS "WeeklyBudget" (
  "id"                 TEXT NOT NULL,
  "week_start"         TIMESTAMP(3) NOT NULL,
  "total_hours_budget" DOUBLE PRECISION NOT NULL,
  "created_by"         TEXT NOT NULL,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes"              TEXT,
  CONSTRAINT "WeeklyBudget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyBudget_week_start_key" ON "WeeklyBudget"("week_start");

-- HistoricalEvent
CREATE TABLE IF NOT EXISTS "HistoricalEvent" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "event_type"  TEXT NOT NULL,
  "date"        TIMESTAMP(3) NOT NULL,
  "day_of_week" TEXT NOT NULL,
  "staff_used"  INTEGER NOT NULL,
  "hours_used"  DOUBLE PRECISION NOT NULL,
  "notes"       TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HistoricalEvent_pkey" PRIMARY KEY ("id")
);

-- UpcomingEvent
CREATE TABLE IF NOT EXISTS "UpcomingEvent" (
  "id"                TEXT NOT NULL,
  "name"              TEXT NOT NULL,
  "event_type"        TEXT NOT NULL,
  "date"              TIMESTAMP(3) NOT NULL,
  "recommended_staff" INTEGER,
  "recommended_hours" DOUBLE PRECISION,
  "confirmed_staff"   INTEGER,
  "notes"             TEXT,
  CONSTRAINT "UpcomingEvent_pkey" PRIMARY KEY ("id")
);

-- PaySummary
CREATE TABLE IF NOT EXISTS "PaySummary" (
  "id"              TEXT NOT NULL,
  "employee_id"     TEXT NOT NULL,
  "week_start"      TIMESTAMP(3) NOT NULL,
  "scheduled_hours" DOUBLE PRECISION NOT NULL,
  "absent_hours"    DOUBLE PRECISION NOT NULL,
  "worked_hours"    DOUBLE PRECISION NOT NULL,
  "hourly_rate"     DOUBLE PRECISION NOT NULL,
  "gross_pay"       DOUBLE PRECISION NOT NULL,
  "calculated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaySummary_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PaySummary" ADD CONSTRAINT "PaySummary_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- UserAccount
CREATE TABLE IF NOT EXISTS "UserAccount" (
  "id"               TEXT NOT NULL,
  "employee_id"      TEXT NOT NULL,
  "email"            TEXT NOT NULL,
  "password_hash"    TEXT NOT NULL DEFAULT '',
  "role"             TEXT NOT NULL,
  "status"           "AccountStatus" NOT NULL DEFAULT 'INVITED',
  "invite_token"     TEXT,
  "invite_expires_at" TIMESTAMP(3),
  "last_login"       TIMESTAMP(3),
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserAccount_employee_id_key" ON "UserAccount"("employee_id");
CREATE UNIQUE INDEX IF NOT EXISTS "UserAccount_email_key" ON "UserAccount"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "UserAccount_invite_token_key" ON "UserAccount"("invite_token");

ALTER TABLE "UserAccount" ADD CONSTRAINT "UserAccount_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CompanyConfig
CREATE TABLE IF NOT EXISTS "CompanyConfig" (
  "id"           TEXT NOT NULL,
  "company_name" TEXT NOT NULL DEFAULT 'My Company',
  "logo_url"     TEXT,
  "currency"     TEXT NOT NULL DEFAULT 'GBP',
  "timezone"     TEXT NOT NULL DEFAULT 'Europe/London',
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by"   TEXT NOT NULL DEFAULT 'system',
  CONSTRAINT "CompanyConfig_pkey" PRIMARY KEY ("id")
);

-- Seed default CompanyConfig if not exists
INSERT INTO "CompanyConfig" ("id", "company_name", "currency", "timezone", "updated_by")
SELECT 'default-config', 'My Company', 'GBP', 'Europe/London', 'system'
WHERE NOT EXISTS (SELECT 1 FROM "CompanyConfig" LIMIT 1);
