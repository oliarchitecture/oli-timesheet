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

export interface EmailAttachment {
  filename: string;
  content: string; // base64-encoded
  contentType?: string;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: EmailAttachment[],
  cc?: string
): Promise<boolean> {
  const client = getResend();
  if (!client) return false; // silently skip if RESEND_API_KEY not set
  try {
    const { error } = await client.emails.send({ from: FROM, to, cc, subject, html, attachments });
    if (error) {
      console.error("[email] Resend rejected the send:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] Failed to send:", err);
    return false;
  }
}

// ── Notification helpers ────────────────────────────────────────────────────

export async function notifyAdminNewSubmission(
  adminEmail: string,
  adminName: string,
  type: "timesheet" | "expense" | "pto" | "request",
  employeeName: string,
  linkUrl: string
) {
  const labels = { timesheet: "Timesheet", expense: "Expense Report", pto: "PTO Request", request: "Request" };
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
  type: "timesheet" | "expense" | "pto" | "request",
  decision: "approved" | "rejected" | "revision",
  comment?: string | null,
  linkUrl?: string
) {
  const labels = { timesheet: "Timesheet", expense: "Expense Report", pto: "PTO Request", request: "Request" };
  const label = labels[type];
  const decisionText = { approved: "approved", rejected: "rejected", revision: "returned for revision" }[decision];
  const subject = `Your ${label} has been ${decisionText}`;

  let body = `<p>Hi ${employeeName},</p><p>Your ${label.toLowerCase()} has been <strong>${decisionText}</strong>.`;
  if (comment) body += `</p><p><em>Comment from reviewer:</em> ${comment}`;
  if (linkUrl) body += `</p><p><a href="${APP_URL}${linkUrl}">View it here →</a>`;
  body += `</p><p style="color:#999;font-size:12px;">OLI Architecture Employee Portal</p>`;

  await sendEmail(employeeEmail, subject, body);
}

export async function notifyNewRequestNote(
  toEmail: string,
  toName: string,
  fromName: string,
  subject: string,
  noteBody: string,
  linkUrl: string
) {
  await sendEmail(
    toEmail,
    `New note on "${subject}"`,
    `<p>Hi ${toName},</p>
<p><strong>${fromName}</strong> added a note to the request "${subject}":</p>
<p style="background:#f5f5f5;padding:12px;border-radius:6px;">${noteBody}</p>
<p><a href="${APP_URL}${linkUrl}">View and reply →</a></p>
<p style="color:#999;font-size:12px;">OLI Architecture Employee Portal</p>`
  );
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
