/**
 * Zod validation helpers for route handlers.
 *
 * All helpers throw ApiError(400) on failure so Express 5's async error
 * propagation surfaces them through the global errorHandler.
 */

import type { Request } from "express";
import type { ZodSchema } from "zod";
import { ApiError } from "./errors.js";

/** Validates req.body against schema; returns typed data or throws 400. */
export function parseBody<T>(schema: ZodSchema<T>, req: Request): T {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid request body", {
      issues: result.error.issues,
    });
  }
  return result.data;
}

/** Validates req.query against schema; returns typed data or throws 400. */
export function parseQuery<T>(schema: ZodSchema<T>, req: Request): T {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid query parameters", {
      issues: result.error.issues,
    });
  }
  return result.data;
}

/**
 * Parses a weekStart URL parameter string (e.g. "2026-03-02") into a Date.
 * Throws 400 if missing or not a valid date.
 */
export function parseWeekStart(raw: string | undefined, name = "weekStart"): Date {
  if (!raw) {
    throw new ApiError(400, "VALIDATION_ERROR", `Missing required parameter: ${name}`);
  }
  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    throw new ApiError(
      400,
      "INVALID_DATE",
      `${name} must be a valid ISO date string (e.g. 2026-03-02)`
    );
  }
  return d;
}
