import jwt from "jsonwebtoken";
import type { VercelRequest } from "@vercel/node";
import { ApiError } from "../../src/api/errors.js";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev-secret";

export interface AuthPayload {
  sub: string;
  role?: string;
}

export function requireAuth(req: VercelRequest): AuthPayload {
  const header = req.headers["authorization"];
  if (typeof header !== "string" || !header.startsWith("Bearer ")) {
    throw new ApiError(401, "UNAUTHORIZED", "Missing or invalid Authorization header");
  }
  try {
    return jwt.verify(header.slice(7), JWT_SECRET) as AuthPayload;
  } catch {
    throw new ApiError(401, "UNAUTHORIZED", "Invalid or expired token");
  }
}
