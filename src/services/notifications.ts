/**
 * Notification Service — Phase 7
 *
 * Wraps SendGrid email delivery.  ALL functions are fire-and-forget safe:
 * errors are logged but never re-thrown so a notification failure can never
 * block the underlying business action.
 *
 * Required environment variables:
 *   SENDGRID_API_KEY   — your SendGrid API key (starts with SG.)
 *   SENDGRID_FROM      — verified sender address (default: noreply@schedulemgr.com)
 */

import sgMail from "@sendgrid/mail";

const API_KEY = process.env["SENDGRID_API_KEY"];
const FROM    = process.env["SENDGRID_FROM"] ?? "noreply@schedulemgr.com";

if (API_KEY) {
  sgMail.setApiKey(API_KEY);
} else {
  console.warn("[notifications] SENDGRID_API_KEY not set — emails will be skipped");
}

// ─── Internal helper ──────────────────────────────────────────────────────────

async function send(to: string, subject: string, text: string): Promise<void> {
  if (!API_KEY) {
    console.info(`[notifications] (no key) would send to=${to} subject="${subject}"`);
    return;
  }
  try {
    await sgMail.send({ to, from: FROM, subject, text });
    console.info(`[notifications] sent to=${to} subject="${subject}"`);
  } catch (err) {
    // Log but never propagate — notification failures must not block actions
    console.error("[notifications] SendGrid error:", err);
  }
}

// ─── Public notification functions ───────────────────────────────────────────

/** Notify all affected employees when a week's schedule is published. */
export async function notifySchedulePublished(
  employees: Array<{ name: string; email: string }>,
  weekStart: string
): Promise<void> {
  await Promise.allSettled(
    employees.map((emp) =>
      send(
        emp.email,
        `Your schedule for the week of ${weekStart} is ready`,
        `Hi ${emp.name},\n\nYour work schedule for the week starting ${weekStart} has been published.\n` +
          `Please log in to the employee portal to view your shifts.\n\nThank you.`
      )
    )
  );
}

/** Notify an employee when their time-off request is approved or denied. */
export async function notifyTimeOffDecision(
  employee: { name: string; email: string },
  status: "APPROVED" | "DENIED",
  startDate: string,
  endDate: string
): Promise<void> {
  const label = status === "APPROVED" ? "approved" : "denied";
  await send(
    employee.email,
    `Your time-off request has been ${label}`,
    `Hi ${employee.name},\n\nYour time-off request from ${startDate} to ${endDate} has been ${label}.\n` +
      `Please log in for more details.\n\nThank you.`
  );
}

/** Notify the target employee when a swap request is submitted for them. */
export async function notifySwapRequested(
  target: { name: string; email: string },
  requesterName: string,
  shiftDate: string
): Promise<void> {
  await send(
    target.email,
    `Shift swap request from ${requesterName}`,
    `Hi ${target.name},\n\n${requesterName} has proposed a shift swap with you for the shift on ${shiftDate}.\n` +
      `A manager will review the request and notify you of the outcome.\n\nThank you.`
  );
}

/** Notify a new employee with their invite link. */
export async function notifyInvite(
  employee: { name: string; email: string },
  inviteToken: string
): Promise<void> {
  const appUrl = process.env["APP_URL"] ?? "http://localhost:5173";
  const link = `${appUrl}/signup?token=${inviteToken}`;
  await send(
    employee.email,
    "You've been invited to ScheduleMgr",
    `Hi ${employee.name},\n\nYou've been invited to join ScheduleMgr.\n\n` +
      `Please click the link below to set up your account:\n${link}\n\n` +
      `This link expires in 7 days.\n\nThank you.`
  );
}

/** Notify the requester when a manager approves or denies their swap. */
export async function notifySwapDecision(
  requester: { name: string; email: string },
  status: "APPROVED" | "DENIED",
  shiftDate: string,
  managerNote?: string | null
): Promise<void> {
  const label = status === "APPROVED" ? "approved" : "denied";
  const noteText = managerNote ? `\n\nManager note: ${managerNote}` : "";
  await send(
    requester.email,
    `Your shift swap request has been ${label}`,
    `Hi ${requester.name},\n\nYour shift swap request for the shift on ${shiftDate} has been ${label}.${noteText}\n\nThank you.`
  );
}
