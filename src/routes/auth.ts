/**
 * Auth Routes — Phase 9
 *
 * POST /api/auth/token          — dev-only stub (issues JWT for any sub/role)
 * POST /api/auth/login          — real login: email + password → JWT
 * POST /api/auth/signup         — activate account via invite token + password
 * POST /api/auth/resend-invite/:employeeId — resend invite email
 * POST /api/auth/logout         — client-side only (just returns 200)
 */

import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../api/errors.js";
import { z } from "zod";
import { parseBody } from "../api/validate.js";
import { notifyInvite } from "../services/notifications.js";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev-secret";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const signupSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

function issueToken(sub: string, role: string): string {
  return jwt.sign({ sub, role }, JWT_SECRET, { expiresIn: "8h" });
}

async function hashPassword(password: string): Promise<string> {
  const { default: bcrypt } = await import("bcrypt");
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const { default: bcrypt } = await import("bcrypt");
  return bcrypt.compare(password, hash);
}

function generateToken(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

// ─── POST /api/auth/token (dev stub) ─────────────────────────────────────────

authRouter.post("/token", (req, res) => {
  const { sub = "dev-admin", role = "ADMIN" } = (req.body ?? {}) as {
    sub?: string;
    role?: string;
  };
  const token = issueToken(sub, role);
  res.json({ token });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

authRouter.post("/login", async (req, res) => {
  const body = parseBody(loginSchema, req);

  const account = await (prisma as any).userAccount.findUnique({
    where: { email: body.email },
    include: { employee: true },
  });

  if (!account || !account.password_hash) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  if (account.status === "SUSPENDED") {
    throw new ApiError(403, "ACCOUNT_SUSPENDED", "Account is suspended");
  }

  const valid = await verifyPassword(body.password, account.password_hash);
  if (!valid) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  await (prisma as any).userAccount.update({
    where: { id: account.id },
    data: { last_login: new Date(), status: "ACTIVE" },
  });

  const token = issueToken(account.employee_id, account.role);
  res.json({
    token,
    role: account.role,
    employeeId: account.employee_id,
    name: account.employee.name,
  });
});

// ─── POST /api/auth/signup ────────────────────────────────────────────────────

authRouter.post("/signup", async (req, res) => {
  const body = parseBody(signupSchema, req);

  const account = await (prisma as any).userAccount.findUnique({
    where: { invite_token: body.token },
    include: { employee: true },
  });

  if (!account) {
    throw new ApiError(400, "INVALID_TOKEN", "Invalid or expired invite token");
  }

  if (account.invite_expires_at && new Date(account.invite_expires_at) < new Date()) {
    throw new ApiError(400, "TOKEN_EXPIRED", "Invite token has expired");
  }

  const password_hash = await hashPassword(body.password);

  await (prisma as any).userAccount.update({
    where: { id: account.id },
    data: {
      password_hash,
      status: "ACTIVE",
      invite_token: null,
      invite_expires_at: null,
      last_login: new Date(),
    },
  });

  const token = issueToken(account.employee_id, account.role);
  res.json({
    token,
    role: account.role,
    employeeId: account.employee_id,
    name: account.employee.name,
  });
});

// ─── POST /api/auth/resend-invite/:employeeId ─────────────────────────────────

authRouter.post("/resend-invite/:employeeId", async (req, res) => {
  const account = await (prisma as any).userAccount.findUnique({
    where: { employee_id: req.params["employeeId"] },
    include: { employee: true },
  });

  if (!account) {
    throw new ApiError(404, "NOT_FOUND", "User account not found");
  }

  const invite_token = generateToken();
  const invite_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await (prisma as any).userAccount.update({
    where: { id: account.id },
    data: { invite_token, invite_expires_at, status: "INVITED" },
  });

  await notifyInvite(
    { name: account.employee.name, email: account.email },
    invite_token
  );

  res.json({ success: true, message: "Invite resent" });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

authRouter.post("/logout", (_req, res) => {
  // JWT is stateless — client removes token from localStorage
  res.json({ success: true });
});
