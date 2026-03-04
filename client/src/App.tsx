import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NavBar } from "./components/NavBar.js";
import { AlertsSidebar } from "./components/AlertsSidebar.js";
import { ToastContainer } from "./components/Toast.js";
import { ToastProvider } from "./contexts/ToastContext.js";
import { AlertsProvider } from "./contexts/AlertsContext.js";
import { ScheduleGrid } from "./views/ScheduleGrid.js";
import { ScheduleGenerator } from "./views/ScheduleGenerator.js";
import { EmployeeList } from "./views/EmployeeList.js";
import { TimeOffDashboard } from "./views/TimeOffDashboard.js";
import { HoursReport } from "./views/HoursReport.js";

export default function App() {
  return (
    <ToastProvider>
      <AlertsProvider>
        <BrowserRouter>
          <div className="flex flex-col h-screen bg-gray-100">
            <NavBar />
            <div className="flex flex-1 overflow-hidden">
              <main className="flex-1 overflow-y-auto">
                <Routes>
                  <Route path="/" element={<ScheduleGrid />} />
                  <Route path="/generate" element={<ScheduleGenerator />} />
                  <Route path="/employees" element={<EmployeeList />} />
                  <Route path="/time-off" element={<TimeOffDashboard />} />
                  <Route path="/hours" element={<HoursReport />} />
                </Routes>
              </main>
              <AlertsSidebar />
            </div>
          </div>
          <ToastContainer />
        </BrowserRouter>
      </AlertsProvider>
    </ToastProvider>
  );
}
