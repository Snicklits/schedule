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

export const fetchCoverageCheck = (weekStart: string) =>
  api
    .get<{ success: true; data: import("./types.js").CoverageCheckResult }>(`/coverage/check/${weekStart}`)
    .then((r) => r.data.data);

export const markShiftPeak = (id: string, isPeak: boolean) =>
  api
    .put<{ success: true; data: import("./types.js").Shift }>(`/shifts/${id}/mark-peak`, { isPeak })
    .then((r) => r.data.data);

// ─── Portal (employee self-service) ───────────────────────────────────────────

export const fetchPortalSchedule = (weekStart?: string) => {
  const qs = weekStart ? `?weekStart=${weekStart}` : "";
  return api
    .get<{ success: true; data: import("./types.js").AssignmentWithDetails[] }>(`/portal/schedule${qs}`)
    .then((r) => r.data.data ?? []);
};

export const fetchPortalTimeOff = () =>
  api
    .get<{ success: true; data: import("./types.js").TimeOffRequest[] }>("/portal/time-off")
    .then((r) => r.data.data ?? []);

export const submitPortalTimeOff = (body: {
  type: string;
  startDate: string;
  endDate: string;
  priority?: number;
}) =>
  api
    .post<{ success: true; data: import("./types.js").TimeOffRequest }>("/portal/time-off", body)
    .then((r) => r.data.data);

export const fetchPortalHours = (weekStart?: string) => {
  const qs = weekStart ? `?weekStart=${weekStart}` : "";
  return api
    .get<{ success: true; data: import("./types.js").PortalHoursSummary }>(`/portal/hours${qs}`)
    .then((r) => r.data.data);
};

// ─── Shift Swaps ──────────────────────────────────────────────────────────────

export const submitSwapRequest = (assignmentId: string, targetEmployeeId: string) =>
  api
    .post<{ success: true; data: import("./types.js").ShiftSwapRequest }>("/shifts/swap", {
      assignmentId,
      targetEmployeeId,
    })
    .then((r) => r.data.data);

export const fetchSwapRequests = (employeeId: string) =>
  api
    .get<{ success: true; data: import("./types.js").ShiftSwapRequest[] }>(`/shifts/swap/${employeeId}`)
    .then((r) => r.data.data ?? []);

export const approveSwapRequest = (id: string, status: "APPROVED" | "DENIED", managerNote?: string) =>
  api
    .put<{ success: true; data: import("./types.js").ShiftSwapRequest }>(`/shifts/swap/${id}/approve`, {
      status,
      ...(managerNote && { managerNote }),
    })
    .then((r) => r.data.data);

// ─── Phase 9: Auth ─────────────────────────────────────────────────────────────

export const loginUser = (email: string, password: string) =>
  api.post<{ success: true; data: { token: string; role: string; employeeId: string } }>("/auth/login", { email, password })
    .then((r) => r.data.data);

export const signupUser = (token: string, password: string, confirmPassword: string) =>
  api.post<{ success: true; data: { token: string; role: string; employeeId: string; name: string } }>("/auth/signup", { token, password, confirmPassword })
    .then((r) => r.data.data);

export const fetchInviteInfo = (token: string) =>
  api.get<{ success: true; data: { email: string; name: string } }>(`/auth/invite-info?token=${token}`)
    .then((r) => r.data.data);

export const resendInvite = (employeeId: string) =>
  api.post(`/auth/resend-invite/${employeeId}`).then((r) => r.data);

// ─── Phase 9: Budget ──────────────────────────────────────────────────────────

export const fetchBudget = (weekStart: string) =>
  api.get<{ success: true; data: import("./types.js").BudgetStatus }>(`/budget/${weekStart}`)
    .then((r) => r.data.data);

export const saveBudget = (weekStart: string, totalHoursBudget: number, notes?: string | null) =>
  api.post<{ success: true; data: unknown }>("/budget", { weekStart, totalHoursBudget, notes })
    .then((r) => r.data.data);

// ─── Phase 9: Events ──────────────────────────────────────────────────────────

export const fetchHistoricalEvents = (type?: string) => {
  const qs = type ? `?type=${type}` : "";
  return api.get<{ success: true; data: import("./types.js").HistoricalEvent[] }>(`/events/historical${qs}`)
    .then((r) => r.data.data ?? []);
};

export const createHistoricalEvent = (body: {
  name: string; event_type: string; date: string;
  staff_used: number; hours_used: number; notes?: string | null;
}) =>
  api.post<{ success: true; data: import("./types.js").HistoricalEvent }>("/events/historical", body)
    .then((r) => r.data.data);

export const fetchUpcomingEvents = () =>
  api.get<{ success: true; data: import("./types.js").UpcomingEvent[] }>("/events/upcoming")
    .then((r) => r.data.data ?? []);

export const fetchUpcomingEventsNext30Days = () =>
  api.get<{ success: true; data: import("./types.js").UpcomingEvent[] }>("/events/upcoming/next30days")
    .then((r) => r.data.data ?? []);

export const createUpcomingEvent = (body: {
  name: string; event_type: string; date: string;
  confirmed_staff?: number | null; notes?: string | null;
}) =>
  api.post<{ success: true; data: import("./types.js").UpcomingEvent }>("/events/upcoming", body)
    .then((r) => r.data.data);

export const updateUpcomingEvent = (id: string, confirmed_staff: number | null, notes?: string | null) =>
  api.put<{ success: true; data: import("./types.js").UpcomingEvent }>(`/events/upcoming/${id}`, { confirmed_staff, notes })
    .then((r) => r.data.data);

// ─── Phase 9: Salary ──────────────────────────────────────────────────────────

export const fetchTeamPaySummary = (weekStart: string) =>
  api.get<{ success: true; data: import("./types.js").TeamPaySummary }>(`/salary/team/${weekStart}`)
    .then((r) => r.data.data);

export const fetchEmployeePaySummary = (employeeId: string, weekStart: string) =>
  api.get<{ success: true; data: import("./types.js").PaySummaryRow }>(`/salary/${employeeId}/${weekStart}`)
    .then((r) => r.data.data);

// ─── Phase 9: Company Config ──────────────────────────────────────────────────

export const fetchCompanyConfig = () =>
  api.get<{ success: true; data: import("./types.js").CompanyConfig }>("/config/company")
    .then((r) => r.data.data);

export const updateCompanyConfig = (body: { company_name?: string; currency?: string; timezone?: string }) =>
  api.put<{ success: true; data: import("./types.js").CompanyConfig }>("/config/company", body)
    .then((r) => r.data.data);

export const uploadCompanyLogo = (imageBase64: string, mimeType?: string) =>
  api.post<{ success: true; data: import("./types.js").CompanyConfig }>("/config/company/logo", { imageBase64, mimeType })
    .then((r) => r.data.data);

// ─── Phase 9: Avatar ──────────────────────────────────────────────────────────

export const uploadAvatar = (imageBase64: string, mimeType?: string) =>
  api.post<{ success: true; data: { avatar_url: string } }>("/portal/avatar", { imageBase64, mimeType })
    .then((r) => r.data.data);
