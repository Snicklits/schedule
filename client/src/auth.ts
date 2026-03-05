/**
 * Auth — dev JWT helpers.
 * In production, swap mintAndStoreToken() with a real auth server call.
 */

import { SignJWT, decodeJwt } from "jose";

const STORAGE_KEY = "schedule_dev_token";
const SECRET = new TextEncoder().encode("dev-secret");

async function mintToken(sub: string, role: string): Promise<string> {
  return new SignJWT({ sub, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(SECRET);
}

/** Mints a new token for the given identity and caches it in localStorage. */
export async function mintAndStoreToken(sub: string, role: string): Promise<string> {
  const token = await mintToken(sub, role);
  localStorage.setItem(STORAGE_KEY, token);
  return token;
}

/** Returns the cached token (for API interceptor). Mints an ADMIN token if none exists. */
export async function getToken(): Promise<string> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  return mintAndStoreToken("dev-admin", "ADMIN");
}

export function clearToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Decodes (does NOT verify) the stored token to extract payload. Returns null if absent/invalid. */
export function getStoredPayload(): { sub: string; role: string } | null {
  const token = localStorage.getItem(STORAGE_KEY);
  if (!token) return null;
  try {
    const payload = decodeJwt(token);
    return {
      sub: (payload["sub"] as string) ?? "dev-admin",
      role: (payload["role"] as string) ?? "ADMIN",
    };
  } catch {
    return null;
  }
}
