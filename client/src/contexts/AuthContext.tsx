import React, { createContext, useContext, useState } from "react";
import { mintAndStoreToken, clearToken, getStoredPayload } from "../auth.js";

interface AuthContextValue {
  isAuthenticated: boolean;
  role: string;        // "ADMIN" | "MANAGER" | "ASSISTANT_MANAGER" | "STAFF"
  employeeId: string;  // JWT sub — used to scope portal requests
  login: (sub: string, role: string) => Promise<void>;
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

  async function login(sub: string, r: string) {
    clearToken();
    await mintAndStoreToken(sub, r);
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
    <AuthContext.Provider value={{ isAuthenticated, role, employeeId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
