/**
 * API Error Handling
 *
 * ApiError is the single error type all routes throw.  The errorHandler
 * middleware converts it to the canonical error envelope.
 */

import type { Request, Response, NextFunction } from "express";

/** Canonical API error envelope shape. */
export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Throw this from any route or middleware to produce a formatted HTTP error. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Express 5 global error handler — must be registered last in app.ts. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    const body: ErrorEnvelope = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined && { details: err.details }),
      },
    };
    res.status(err.status).json(body);
    return;
  }

  // Unknown errors — log and return a generic 500
  console.error("[unhandled error]", err);
  const body: ErrorEnvelope = {
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    },
  };
  res.status(500).json(body);
}
