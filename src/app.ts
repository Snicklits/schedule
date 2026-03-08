/**
 * Express application — Phase 5
 *
 * Middleware stack (in order):
 *   1. JSON body parser
 *   2. Request logger
 *   3. JWT auth (all /api/* routes)
 *   4. Route handlers
 *   5. Global error handler (must be last)
 */

import express from "express";
import cors from "cors";
import { errorHandler } from "./api/errors.js";
import { requestLog } from "./middleware/requestLog.js";
import { requireAuth } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { healthRouter } from "./routes/health.js";
import { scheduleRouter } from "./routes/schedule.js";
import { employeeRouter } from "./routes/employees.js";
import { timeOffRouter } from "./routes/time-off.js";
import { shiftRouter } from "./routes/shifts.js";
import { coverageRouter } from "./routes/coverage.js";
import { reportsRouter } from "./routes/reports.js";
import { peakWindowRouter } from "./routes/peakWindows.js";
import { swapRouter } from "./routes/swap.js";
import { portalRouter } from "./routes/portal.js";
import { budgetRouter } from "./routes/budget.js";
import { eventsRouter } from "./routes/events.js";
import { salaryRouter } from "./routes/salary.js";
import { companyRouter } from "./routes/company.js";

const app = express();

// ─── Global middleware ────────────────────────────────────────────────────────
const allowedOrigin = process.env["CLIENT_ORIGIN"] ?? "*";
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json());
app.use(requestLog);

// ─── Public routes ────────────────────────────────────────────────────────────
app.use("/health", healthRouter);
app.use("/api/auth", authRouter);

// ─── Protected API routes ─────────────────────────────────────────────────────
app.use("/api", requireAuth);
app.use("/api/schedule", scheduleRouter);
app.use("/api/employees", employeeRouter);
app.use("/api/time-off", timeOffRouter);
app.use("/api/shifts", shiftRouter);
app.use("/api/coverage", coverageRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/peak-windows", peakWindowRouter);
app.use("/api/shifts/swap", swapRouter);
app.use("/api/portal", portalRouter);
app.use("/api/budget", budgetRouter);
app.use("/api/events", eventsRouter);
app.use("/api/salary", salaryRouter);
app.use("/api/config/company", companyRouter);

// ─── Global error handler — must be last ──────────────────────────────────────
app.use(errorHandler);

export default app;
