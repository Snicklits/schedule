/**
 * Request logging middleware.
 * Logs METHOD path status duration to stdout on each response.
 */

import type { Request, Response, NextFunction } from "express";

export function requestLog(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} (${ms}ms)`
    );
  });
  next();
}
