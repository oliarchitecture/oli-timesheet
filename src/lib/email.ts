import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? "OLI Architecture <no-reply@oliarch.com>";
const APP_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export { APP_URL };

export async function sendEmail(to: string, subject: string, html: string) {
  const client = getResend();
  if (!client) return; // silently skip if RESEND_API_KEY not set
  try {
    await client.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error("[email] Failed to send:", err);
  }
}

// ── Notification helpers ────────────────────────────────────────────────────

export async function notifyAdminNewSubmission(
  adminEmail: string,
  adminName: string,
  type: "timesheet" | "expense" | "pto",
  employeeName: string,
  linkUrl: string
) {
  const labels = { timesheet: "Timesheet", expense: "Expense Report", pto: "PTO Request" };
  const label = labels[type];
  await sendEmail(
    adminEmail,
    `New ${label} Submitted — ${employeeName}`,
    `<p>Hi ${adminName},</p>
<p><strong>${employeeName}</strong> has submitted a ${label.toLowerCase()} for your review.</p>
<p><a href="${APP_URL}${linkUrl}">Review it here →</a></p>
<p style="color:#999;font-size:12px;">OLI Architecture Employee Portal</p>`
  );
}

export async function notifyEmployeeDecision(
  employeeEmail: string,
  employeeName: string,
  type: "timesheet" | "expense" | "pto",
  decision: "approved" | "rejected" | "revision",
  comment?: string | null,
  linkUrl?: string
) {
  const labels = { timesheet: "Timesheet", expense: "Expense Report", pto: "PTO Request" };
  const label = labels[type];
  const decisionText = { approved: "approved", rejected: "rejected", revision: "returned for revision" }[decision];
  const subject = `Your ${label} has been ${decisionText}`;

  let body = `<p>Hi ${employeeName},</p><p>Your ${label.toLowerCase()} has been <strong>${decisionText}</strong>.`;
  if (comment) body += `</p><p><em>Comment from reviewer:</em> ${comment}`;
  if (linkUrl) body += `</p><p><a href="${APP_URL}${linkUrl}">View it here →</a>`;
  body += `</p><p style="color:#999;font-size:12px;">OLI Architecture Employee Portal</p>`;

  await sendEmail(employeeEmail, subject, body);
}

export async function sendPasswordResetEmail(email: string, name: string, token: string) {
  const url = `${APP_URL}/reset-password/${token}`;
  await sendEmail(
    email,
    "Reset your OLI Portal password",
    `<p>Hi ${name},</p>
<p>We received a request to reset your password. Click the link below — it expires in 1 hour.</p>
<p><a href="${url}">Reset Password →</a></p>
<p>If you did not request this, you can ignore this email.</p>
<p style="color:#999;font-size:12px;">OLI Architecture Employee Portal</p>`
  );
}
