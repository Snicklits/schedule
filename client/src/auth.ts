/**
 * Auth — auto-generates a dev JWT using `jose` and caches it in localStorage.
 * In production, swap getToken() to read a real token from your auth flow.
 */

import { SignJWT } from "jose";

const STORAGE_KEY = "schedule_dev_token";
const SECRET = new TextEncoder().encode("dev-secret");

async function mintToken(): Promise<string> {
  return new SignJWT({ sub: "dev-admin", role: "ADMIN" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(SECRET);
}

export async function getToken(): Promise<string> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  const token = await mintToken();
  localStorage.setItem(STORAGE_KEY, token);
  return token;
}

export function clearToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}
