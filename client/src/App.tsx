import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "./components/Sidebar.js";
import { PortalSidebar } from "./components/PortalSidebar.js";
import { TopBar } from "./components/TopBar.js";
import { ToastContainer } from "./components/Toast.js";
import { ToastProvider } from "./contexts/ToastContext.js";
import { AlertsProvider } from "./contexts/AlertsContext.js";
import { AuthProvider, useAuth } from "./contexts/AuthContext.js";
import { Dashboard } from "./views/Dashboard.js";
import { ScheduleGrid } from "./views/ScheduleGrid.js";
import { ScheduleGenerator } from "./views/ScheduleGenerator.js";
import { EmployeeList } from "./views/EmployeeList.js";
import { TimeOffDashboard } from "./views/TimeOffDashboard.js";
import { HoursReport } from "./views/HoursReport.js";
import { LoginView } from "./views/LoginView.js";
import { PortalSchedule } from "./views/portal/PortalSchedule.js";
import { PortalTimeOff } from "./views/portal/PortalTimeOff.js";
import { PortalHours } from "./views/portal/PortalHours.js";
import { PortalSwaps } from "./views/portal/PortalSwaps.js";

const MANAGER_ROLES = new Set(["ADMIN", "MANAGER", "ASSISTANT_MANAGER"]);

function ManagerLayout() {
  const [weekStart, setWeekStart] = useState<Date | undefined>(undefined);

  return (
    <div className="flex h-screen bg-[#eef0f8] overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar weekStart={weekStart} onWeekChange={setWeekStart} />
        <main className="flex-1 overflow-y-auto p-5">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/schedule" element={<ScheduleGrid />} />
            <Route path="/generate" element={<ScheduleGenerator />} />
            <Route path="/employees" element={<EmployeeList />} />
            <Route path="/time-off" element={<TimeOffDashboard />} />
            <Route path="/hours" element={<HoursReport />} />
            <Route path="/alerts" element={<HoursReport />} />
            <Route path="/settings" element={<HoursReport />} />
            {/* Redirect portal paths to manager home */}
            <Route path="/portal/*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function PortalLayout() {
  return (
    <div className="flex h-screen bg-[#eef0f8] overflow-hidden">
      <PortalSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-5">
          <Routes>
            <Route path="/portal/schedule" element={<PortalSchedule />} />
            <Route path="/portal/time-off" element={<PortalTimeOff />} />
            <Route path="/portal/hours" element={<PortalHours />} />
            <Route path="/portal/swaps" element={<PortalSwaps />} />
            <Route path="*" element={<Navigate to="/portal/schedule" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function AppShell() {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <LoginView />;
  }

  if (role && MANAGER_ROLES.has(role)) {
    return <ManagerLayout />;
  }

  return <PortalLayout />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AlertsProvider>
          <BrowserRouter>
            <AppShell />
            <ToastContainer />
          </BrowserRouter>
        </AlertsProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
