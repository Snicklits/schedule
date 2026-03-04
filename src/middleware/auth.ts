/**
 * JWT Authentication Middleware
 *
 * requireAuth validates the Bearer token on every /api/* route.
 * mintTestToken is exported for use in integration tests only.
 */

import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../api/errors.js";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev-secret";

export interface AuthPayload {
  sub: string;
  role?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

/** Validates Authorization: Bearer <token> header; throws 401 on failure. */
export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) {
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "Missing or invalid Authorization header"
    );
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    throw new ApiError(401, "UNAUTHORIZED", "Invalid or expired token");
  }
}

/** Mints a short-lived signed JWT for integration tests. */
export function mintTestToken(
  sub = "test-user",
  role = "ADMIN"
): string {
  return jwt.sign({ sub, role }, JWT_SECRET, { expiresIn: "1h" });
}
