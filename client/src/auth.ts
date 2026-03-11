/**
 * Auth — in-memory JWT storage.
 * JWT is stored in module-level memory only (not localStorage).
 * On page refresh the user must log in again.
 */

import { decodeJwt } from "jose";

// In-memory token store — never persisted
let _token: string | null = null;

export function storeToken(token: string): void {
  _token = token;
}

export function getToken(): string | null {
  return _token;
}

export function clearToken(): void {
  _token = null;
}

export function getStoredPayload(): { sub: string; role: string; email?: string } | null {
  if (!_token) return null;
  try {
    const payload = decodeJwt(_token);
    return {
      sub: (payload["sub"] as string) ?? "",
      role: (payload["role"] as string) ?? "STAFF",
      email: payload["email"] as string | undefined,
    };
  } catch {
    return null;
  }
}
