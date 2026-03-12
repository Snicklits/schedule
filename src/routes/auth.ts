import { Router } from "express";
import jwt from "jsonwebtoken";
import {
  getUserAccountByEmail,
  getUserAccountByInviteToken,
  verifyPassword,
  activateAccount,
  updateLastLogin,
} from "../repositories/userAccount.js";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev-secret";

export const authRouter = Router();

/** POST /api/auth/login — validate credentials and issue JWT */
authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Email and password are required" } });
      return;
    }
    const account = await getUserAccountByEmail(email);
    if (!account || account.status === "INVITED") {
      res.status(401).json({ success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });
      return;
    }
    if (account.status === "SUSPENDED") {
      res.status(403).json({ success: false, error: { code: "ACCOUNT_SUSPENDED", message: "Account suspended" } });
      return;
    }
    const ok = await verifyPassword(account, password);
    if (!ok) {
      res.status(401).json({ success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });
      return;
    }
    await updateLastLogin(account.id);
    const token = jwt.sign({ sub: account.employee_id, role: account.role, email: account.email }, JWT_SECRET, { expiresIn: "8h" });
    res.json({ success: true, data: { token, role: account.role, employeeId: account.employee_id } });
  } catch (err) {
    next(err);
  }
});

/** POST /api/auth/signup — complete account setup from invite token */
authRouter.post("/signup", async (req, res, next) => {
  try {
    const { token, password } = req.body as { token?: string; password?: string };
    if (!token || !password) {
      res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "Token and password are required" } });
      return;
    }
    const account = await getUserAccountByInviteToken(token);
    if (!account) {
      res.status(400).json({ success: false, error: { code: "INVALID_TOKEN", message: "Invalid or expired invite token" } });
      return;
    }
    if (account.invite_expires_at && account.invite_expires_at < new Date()) {
      res.status(400).json({ success: false, error: { code: "TOKEN_EXPIRED", message: "Invite token has expired. Please ask your manager to resend the invite." } });
      return;
    }
    const updated = await activateAccount(account.id, password);
    const jwt_token = jwt.sign({ sub: updated.employee_id, role: updated.role, email: updated.email }, JWT_SECRET, { expiresIn: "8h" });
    res.json({ success: true, data: { token: jwt_token, role: updated.role, employeeId: updated.employee_id } });
  } catch (err) {
    next(err);
  }
});

/** GET /api/auth/invite-info?token=... — look up invite details */
authRouter.get("/invite-info", async (req, res, next) => {
  try {
    const token = req.query["token"] as string | undefined;
    if (!token) {
      res.status(400).json({ success: false, error: { code: "MISSING_TOKEN", message: "Missing invite token" } });
      return;
    }
    const account = await getUserAccountByInviteToken(token);
    if (!account) {
      res.status(400).json({ success: false, error: { code: "INVALID_TOKEN", message: "Invalid or expired invite token" } });
      return;
    }
    if (account.invite_expires_at && account.invite_expires_at < new Date()) {
      res.status(400).json({ success: false, error: { code: "TOKEN_EXPIRED", message: "Invite token has expired." } });
      return;
    }
    res.json({ success: true, data: { email: account.email, role: account.role } });
  } catch (err) {
    next(err);
  }
});

/** POST /api/auth/token — legacy dev token (kept for compatibility) */
authRouter.post("/token", (req, res) => {
  const { sub = "dev-admin", role = "ADMIN" } = (req.body ?? {}) as {
    sub?: string;
    role?: string;
  };
  const token = jwt.sign({ sub, role }, JWT_SECRET, { expiresIn: "8h" });
  res.json({ token });
});
