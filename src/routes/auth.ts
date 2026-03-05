import { Router } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev-secret";

export const authRouter = Router();

/** Issues a signed token. Replace with credential validation when adding user accounts. */
authRouter.post("/token", (req, res) => {
  const { sub = "dev-admin", role = "ADMIN" } = (req.body ?? {}) as {
    sub?: string;
    role?: string;
  };
  const token = jwt.sign({ sub, role }, JWT_SECRET, { expiresIn: "8h" });
  res.json({ token });
});
