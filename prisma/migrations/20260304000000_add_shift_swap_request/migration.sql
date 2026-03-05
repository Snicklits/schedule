-- Phase 7: Shift swap request workflow
-- Apply this migration via: prisma migrate deploy  OR paste into Supabase SQL editor

CREATE TYPE "SwapStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

CREATE TABLE "ShiftSwapRequest" (
    "id"                 TEXT         NOT NULL,
    "requester_id"       TEXT         NOT NULL,
    "target_employee_id" TEXT         NOT NULL,
    "assignment_id"      TEXT         NOT NULL,
    "status"             "SwapStatus" NOT NULL DEFAULT 'PENDING',
    "manager_note"       TEXT,
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at"        TIMESTAMP(3),
    "reviewed_by"        TEXT,
    CONSTRAINT "ShiftSwapRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ShiftSwapRequest"
    ADD CONSTRAINT "ShiftSwapRequest_requester_id_fkey"
    FOREIGN KEY ("requester_id") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShiftSwapRequest"
    ADD CONSTRAINT "ShiftSwapRequest_target_employee_id_fkey"
    FOREIGN KEY ("target_employee_id") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShiftSwapRequest"
    ADD CONSTRAINT "ShiftSwapRequest_assignment_id_fkey"
    FOREIGN KEY ("assignment_id") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ShiftSwapRequest_requester_id_idx"      ON "ShiftSwapRequest"("requester_id");
CREATE INDEX "ShiftSwapRequest_target_employee_id_idx" ON "ShiftSwapRequest"("target_employee_id");
CREATE INDEX "ShiftSwapRequest_assignment_id_idx"      ON "ShiftSwapRequest"("assignment_id");
