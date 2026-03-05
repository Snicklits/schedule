/**
 * Auth — JWT helpers.
 * Tokens are issued by the server so they are signed with the real JWT_SECRET.
 */

import { decodeJwt } from "jose";

const STORAGE_KEY = "schedule_dev_token";

async function fetchServerToken(sub: string, role: string): Promise<string> {
  const res = await fetch("/api/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sub, role }),
  });
  if (!res.ok) throw new Error("Failed to obtain auth token");
  const { token } = (await res.json()) as { token: string };
  return token;
}

/** Fetches a server-signed token for the given identity and caches it in localStorage. */
export async function mintAndStoreToken(sub: string, role: string): Promise<string> {
  const token = await fetchServerToken(sub, role);
  localStorage.setItem(STORAGE_KEY, token);
  return token;
}

/** Returns the cached token (for API interceptor). Fetches from server if none exists. */
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
