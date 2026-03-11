import React, { createContext, useContext, useState } from "react";
import { storeToken, clearToken } from "../auth.js";
import api from "../api/client.js";

interface AuthContextValue {
  isAuthenticated: boolean;
  role: string;
  employeeId: string;
  employeeName: string;
  avatarUrl: string | null;
  setAvatarUrl: (url: string) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState("STAFF");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  async function login(email: string, password: string) {
    const res = await api.post<{ success: true; data: { token: string; role: string; employeeId: string } }>(
      "/auth/login",
      { email, password }
    );
    const { token, role: r, employeeId: eid } = res.data.data;
    storeToken(token);
    setIsAuthenticated(true);
    setRole(r);
    setEmployeeId(eid);
    // Fetch employee name and avatar
    try {
      const empRes = await api.get<{ success: true; data: { name: string; avatar_url?: string | null } }>(`/employees/${eid}`);
      setEmployeeName(empRes.data.data.name);
      setAvatarUrl(empRes.data.data.avatar_url ?? null);
    } catch {
      setEmployeeName(email.split("@")[0] ?? "");
    }
  }

  function logout() {
    clearToken();
    setIsAuthenticated(false);
    setRole("STAFF");
    setEmployeeId("");
    setEmployeeName("");
    setAvatarUrl(null);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, role, employeeId, employeeName, avatarUrl, setAvatarUrl, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
