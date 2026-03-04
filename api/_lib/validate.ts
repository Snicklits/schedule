import type { VercelRequest } from "@vercel/node";
import type { ZodSchema } from "zod";
import { ApiError } from "../../src/api/errors.js";

export function parseBody<T>(schema: ZodSchema<T>, req: VercelRequest): T {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid request body", {
      issues: result.error.issues,
    });
  }
  return result.data;
}

export function parseQuery<T>(schema: ZodSchema<T>, req: VercelRequest): T {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid query parameters", {
      issues: result.error.issues,
    });
  }
  return result.data;
}

export function parseWeekStart(
  raw: string | string[] | undefined,
  name = "weekStart"
): Date {
  const str = Array.isArray(raw) ? raw[0] : raw;
  if (!str) {
    throw new ApiError(400, "VALIDATION_ERROR", `Missing required parameter: ${name}`);
  }
  const d = new Date(str);
  if (isNaN(d.getTime())) {
    throw new ApiError(
      400,
      "INVALID_DATE",
      `${name} must be a valid ISO date string (e.g. 2026-03-02)`
    );
  }
  return d;
}
