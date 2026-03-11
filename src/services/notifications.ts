/**
 * Notification Service — Phase 7/9
 *
 * Wraps SendGrid email delivery.  ALL functions are fire-and-forget safe:
 * errors are logged but never re-thrown so a notification failure can never
 * block the underlying business action.
 *
 * Required environment variables:
 *   SENDGRID_API_KEY   — your SendGrid API key (starts with SG.)
 *   FROM_EMAIL         — verified sender address
 */

import sgMail from "@sendgrid/mail";

const API_KEY = process.env["SENDGRID_API_KEY"];
const FROM    = process.env["FROM_EMAIL"] ?? process.env["SENDGRID_FROM"] ?? "noreply@schedulemgr.com";

if (!API_KEY) {
  console.warn("[notifications] SENDGRID_API_KEY not set — emails will be skipped");
}
if (!process.env["FROM_EMAIL"]) {
  console.warn("[notifications] FROM_EMAIL not set — using default sender");
}

if (API_KEY) {
  sgMail.setApiKey(API_KEY);
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
    console.error("[notifications] SendGrid error:", err);
  }
}

// ─── Public notification functions ───────────────────────────────────────────

export async function notifySchedulePublished(
  employees: Array<{ name: string; email: string }>,
  weekStart: string,
  companyName = "Your company"
): Promise<void> {
  await Promise.allSettled(
    employees.map((emp) =>
      send(
        emp.email,
        `[${companyName}] Your schedule for the week of ${weekStart} is ready`,
        `Hi ${emp.name},\n\nYour work schedule for the week starting ${weekStart} has been published.\nPlease log in to view your shifts.\n\nThank you.`
      )
    )
  );
}

export async function notifyTimeOffDecision(
  employee: { name: string; email: string },
  status: "APPROVED" | "DENIED",
  startDate: string,
  endDate: string,
  reason?: string,
  companyName = "Your company"
): Promise<void> {
  const label = status === "APPROVED" ? "approved" : "denied";
  const reasonText = reason ? `\n\nReason: ${reason}` : "";
  await send(
    employee.email,
    `[${companyName}] Your time-off request has been ${label}`,
    `Hi ${employee.name},\n\nYour time-off request from ${startDate} to ${endDate} has been ${label}.${reasonText}\n\nThank you.`
  );
}

export async function notifySwapRequested(
  target: { name: string; email: string },
  requesterName: string,
  shiftDate: string,
  companyName = "Your company"
): Promise<void> {
  await send(
    target.email,
    `[${companyName}] Shift swap request from ${requesterName}`,
    `Hi ${target.name},\n\n${requesterName} has proposed a shift swap with you for ${shiftDate}.\nA manager will review and notify you.\n\nThank you.`
  );
}

export async function notifySwapDecision(
  requester: { name: string; email: string },
  status: "APPROVED" | "DENIED",
  shiftDate: string,
  managerNote?: string | null,
  companyName = "Your company"
): Promise<void> {
  const label = status === "APPROVED" ? "approved" : "denied";
  const noteText = managerNote ? `\n\nManager note: ${managerNote}` : "";
  await send(
    requester.email,
    `[${companyName}] Your shift swap request has been ${label}`,
    `Hi ${requester.name},\n\nYour swap request for ${shiftDate} has been ${label}.${noteText}\n\nThank you.`
  );
}

export async function notifyInvite(
  employee: { name: string; email: string },
  inviteToken: string,
  appUrl: string,
  companyName = "Your company"
): Promise<void> {
  const signUpLink = `${appUrl}/signup?token=${inviteToken}`;
  await send(
    employee.email,
    `You've been invited to ${companyName} scheduling`,
    `Hi ${employee.name},\n\nYou've been invited to the ${companyName} scheduling system.\n\nSign up here (valid 7 days):\n${signUpLink}\n\nThank you.`
  );
}
