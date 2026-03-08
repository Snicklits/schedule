import React, { createContext, useContext, useState } from "react";
import { clearToken, getStoredPayload, storeToken } from "../auth.js";
import { loginWithCredentials } from "../api/endpoints.js";

interface AuthContextValue {
  isAuthenticated: boolean;
  role: string;        // "ADMIN" | "MANAGER" | "ASSISTANT_MANAGER" | "STAFF"
  employeeId: string;  // JWT sub — used to scope portal requests
  login: (email: string, password: string) => Promise<void>;
  loginDev: (sub: string, role: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  function initState() {
    const payload = getStoredPayload();
    if (!payload) return { isAuthenticated: false, role: "STAFF", employeeId: "" };
    return { isAuthenticated: true, role: payload.role, employeeId: payload.sub };
  }

  const init = initState();
  const [isAuthenticated, setIsAuthenticated] = useState(init.isAuthenticated);
  const [role, setRole] = useState(init.role);
  const [employeeId, setEmployeeId] = useState(init.employeeId);

  /** Real email+password login via /api/auth/login */
  async function login(email: string, password: string) {
    clearToken();
    const result = await loginWithCredentials(email, password);
    storeToken(result.token);
    setIsAuthenticated(true);
    setRole(result.role);
    setEmployeeId(result.employeeId);
  }

  /** Dev-only: bypass real auth (stub endpoint) */
  async function loginDev(sub: string, r: string) {
    clearToken();
    const res = await fetch("/api/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sub, role: r }),
    });
    if (!res.ok) throw new Error("Dev login failed");
    const { token } = (await res.json()) as { token: string };
    storeToken(token);
    setIsAuthenticated(true);
    setRole(r);
    setEmployeeId(sub);
  }

  function logout() {
    clearToken();
    setIsAuthenticated(false);
    setRole("STAFF");
    setEmployeeId("");
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, role, employeeId, login, loginDev, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
