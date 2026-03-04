import api from "./client.js";
import type {
  Employee,
  EmployeeWithStatus,
  AssignmentWithDetails,
  TimeOffWithEmployee,
  TimeOffStatus,
  HoursSummaryRow,
  Violation,
  ManagementGap,
  ScheduleGenerateResult,
} from "./types.js";

// ─── Employees ────────────────────────────────────────────────────────────────

export const fetchEmployees = () =>
  api.get<{ success: true; data: Employee[] }>("/employees").then((r) => r.data.data ?? []);

export const fetchAllEmployees = () =>
  api.get<{ success: true; data: EmployeeWithStatus[] }>("/employees?all=true").then((r) => r.data.data ?? []);

export const createEmployee = (body: Record<string, unknown>) =>
  api.post<{ success: true; data: Employee }>("/employees", body).then((r) => r.data.data);

export const updateEmployee = (id: string, body: Record<string, unknown>) =>
  api.put<{ success: true; data: Employee }>(`/employees/${id}`, body).then((r) => r.data.data);

// ─── Schedule ─────────────────────────────────────────────────────────────────

export const generateSchedule = (weekStart: string) =>
  api
    .post<{ success: true; data: ScheduleGenerateResult }>("/schedule/generate", { weekStart })
    .then((r) => r.data.data);

export const fetchSchedule = (weekStart: string) =>
  api
    .get<{ success: true; data: AssignmentWithDetails[] }>(`/schedule/${weekStart}`)
    .then((r) => r.data.data ?? []);

export const reassignAssignment = (id: string, employeeId: string, reason?: string) =>
  api
    .put<{ success: true; data: AssignmentWithDetails }>(`/schedule/assignment/${id}`, {
      employeeId,
      reason,
    })
    .then((r) => r.data.data);

// ─── Time-Off ─────────────────────────────────────────────────────────────────

export const fetchAllTimeOff = () =>
  api.get<{ success: true; data: TimeOffWithEmployee[] }>("/time-off/all").then((r) => r.data.data ?? []);

export const approveTimeOff = (id: string, status: TimeOffStatus, approverId = "admin") =>
  api
    .put<{ success: true; data: TimeOffWithEmployee }>(`/time-off/${id}/approve`, {
      status,
      approverId,
    })
    .then((r) => r.data.data);

export const deleteTimeOff = (id: string) => api.delete(`/time-off/${id}`);

// ─── Reports ──────────────────────────────────────────────────────────────────

export const fetchHoursSummary = (weekStart: string) =>
  api
    .get<{ success: true; data: HoursSummaryRow[] }>(`/reports/hours?weekStart=${weekStart}`)
    .then((r) => r.data.data ?? []);

export const fetchViolations = (weekStart?: string) => {
  const qs = weekStart ? `?weekStart=${weekStart}` : "";
  return api
    .get<{ success: true; data: Violation[] }>(`/reports/violations${qs}`)
    .then((r) => r.data.data ?? []);
};

// ─── Coverage ─────────────────────────────────────────────────────────────────

export const fetchManagementGaps = (weekStart: string) =>
  api
    .get<{ success: true; data: ManagementGap[] }>(`/coverage/gaps?weekStart=${weekStart}`)
    .then((r) => r.data.data ?? []);
