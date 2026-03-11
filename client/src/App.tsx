import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { NavBar } from "./components/NavBar.js";
import { PortalNavBar } from "./components/PortalNavBar.js";
import { AlertsSidebar } from "./components/AlertsSidebar.js";
import { ToastContainer } from "./components/Toast.js";
import { ToastProvider } from "./contexts/ToastContext.js";
import { AlertsProvider } from "./contexts/AlertsContext.js";
import { AuthProvider, useAuth } from "./contexts/AuthContext.js";
import { CompanyProvider } from "./contexts/CompanyContext.js";
import { ScheduleGrid } from "./views/ScheduleGrid.js";
import { ScheduleGenerator } from "./views/ScheduleGenerator.js";
import { EmployeeList } from "./views/EmployeeList.js";
import { TimeOffDashboard } from "./views/TimeOffDashboard.js";
import { HoursReport } from "./views/HoursReport.js";
import { LoginView } from "./views/LoginView.js";
import { SignupView } from "./views/SignupView.js";
import { EventsView } from "./views/EventsView.js";
import { PayrollView } from "./views/PayrollView.js";
import { CompanySettingsView } from "./views/CompanySettingsView.js";
import { PortalSchedule } from "./views/portal/PortalSchedule.js";
import { PortalTimeOff } from "./views/portal/PortalTimeOff.js";
import { PortalHours } from "./views/portal/PortalHours.js";
import { PortalSwaps } from "./views/portal/PortalSwaps.js";

const MANAGER_ROLES = new Set(["ADMIN", "MANAGER", "ASSISTANT_MANAGER"]);

function AppShell() {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <LoginView />;
  }

  if (role && MANAGER_ROLES.has(role)) {
    return (
      <div className="flex h-full">
        <NavBar />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto bg-gray-50">
            <Routes>
              <Route path="/" element={<ScheduleGrid />} />
              <Route path="/schedule" element={<ScheduleGrid />} />
              <Route path="/generate" element={<ScheduleGenerator />} />
              <Route path="/employees" element={<EmployeeList />} />
              <Route path="/time-off" element={<TimeOffDashboard />} />
              <Route path="/hours" element={<HoursReport />} />
              <Route path="/events" element={<EventsView />} />
              <Route path="/payroll" element={<PayrollView />} />
              <Route path="/company" element={<CompanySettingsView />} />
              <Route path="/settings" element={<ScheduleGrid />} />
              <Route path="/alerts" element={<ScheduleGrid />} />
              <Route path="/portal/*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <AlertsSidebar />
        </div>
      </div>
    );
  }

  // Employee portal (STAFF role or unknown)
  return (
    <>
      <PortalNavBar />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/portal/schedule" element={<PortalSchedule />} />
          <Route path="/portal/time-off" element={<PortalTimeOff />} />
          <Route path="/portal/hours" element={<PortalHours />} />
          <Route path="/portal/swaps" element={<PortalSwaps />} />
          <Route path="*" element={<Navigate to="/portal/schedule" replace />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <CompanyProvider>
      <AuthProvider>
        <ToastProvider>
          <AlertsProvider>
            <BrowserRouter>
              <div className="flex flex-col h-screen bg-gray-100">
                <Routes>
                  <Route path="/signup" element={<SignupView />} />
                  <Route path="*" element={<AppShell />} />
                </Routes>
              </div>
              <ToastContainer />
            </BrowserRouter>
          </AlertsProvider>
        </ToastProvider>
      </AuthProvider>
    </CompanyProvider>
  );
}
