-- Phase 4: Add HALTED to ScheduleRunStatus, extend ScheduleRun, create PeakWindow

-- Add HALTED value to ScheduleRunStatus enum
-- (PostgreSQL requires a separate ALTER TYPE statement; cannot be inside a transaction)
ALTER TYPE "ScheduleRunStatus" ADD VALUE IF NOT EXISTS 'HALTED';

-- AlterTable ScheduleRun: add errors and warnings JSON columns
ALTER TABLE "ScheduleRun" ADD COLUMN IF NOT EXISTS "errors" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "ScheduleRun" ADD COLUMN IF NOT EXISTS "warnings" JSONB NOT NULL DEFAULT '[]';

-- CreateTable PeakWindow
CREATE TABLE IF NOT EXISTS "PeakWindow" (
    "id"         TEXT NOT NULL,
    "days"       TEXT[],
    "start_time" TEXT NOT NULL,
    "end_time"   TEXT NOT NULL,
    "label"      TEXT,
    CONSTRAINT "PeakWindow_pkey" PRIMARY KEY ("id")
);
