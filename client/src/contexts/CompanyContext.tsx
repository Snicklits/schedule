import React, { createContext, useContext, useState, useEffect } from "react";
import { fetchCompanyConfig } from "../api/endpoints.js";
import type { CompanyConfig } from "../api/types.js";

interface CompanyContextValue {
  config: CompanyConfig | null;
  refresh: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

const DEFAULT_CONFIG: CompanyConfig = {
  id: "",
  company_name: "ScheduleMgr",
  logo_url: null,
  currency: "GBP",
  timezone: "Europe/London",
  updated_at: "",
};

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<CompanyConfig | null>(null);

  async function refresh() {
    try {
      const c = await fetchCompanyConfig();
      setConfig(c);
    } catch {
      setConfig(DEFAULT_CONFIG);
    }
  }

  useEffect(() => { void refresh(); }, []);

  return (
    <CompanyContext.Provider value={{ config: config ?? DEFAULT_CONFIG, refresh }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}
