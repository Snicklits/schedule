import React, { createContext, useContext, useState, useCallback } from "react";
import type { Violation, ManagementGap } from "../api/types.js";

interface AlertsContextValue {
  violations: Violation[];
  gaps: ManagementGap[];
  setViolations: (v: Violation[]) => void;
  setGaps: (g: ManagementGap[]) => void;
  refresh: () => void;
  triggerRefresh: number;
}

const AlertsContext = createContext<AlertsContextValue | null>(null);

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [gaps, setGaps] = useState<ManagementGap[]>([]);
  const [triggerRefresh, setTriggerRefresh] = useState(0);

  const refresh = useCallback(() => setTriggerRefresh((n) => n + 1), []);

  return (
    <AlertsContext.Provider value={{ violations, gaps, setViolations, setGaps, refresh, triggerRefresh }}>
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error("useAlerts must be used within AlertsProvider");
  return ctx;
}
