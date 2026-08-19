import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendTimesheetReminderEmail } from "@/lib/email";

/**
 * GET /api/cron/timesheet-reminders
 * Triggered by Vercel Cron on the 13th of each month (see vercel.json).
 * Emails every active employee a reminder to submit their timesheet/expenses.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employees = await db.employee.findMany({
    where: { isActive: true },
    select: { name: true, email: true },
  });

  let sent = 0;
  for (const emp of employees) {
    const ok = await sendTimesheetReminderEmail(emp.email, emp.name);
    if (ok) sent++;
  }

  return NextResponse.json({ total: employees.length, sent });
}
