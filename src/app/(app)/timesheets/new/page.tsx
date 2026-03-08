import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { getWeekStart } from "@/lib/utils";

// Auto-create a timesheet for the current week and redirect to it
export default async function NewTimesheetPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const today = new Date();
  const weekStart = getWeekStart(today);

  const existing = await db.timesheetWeek.findUnique({
    where: {
      employeeId_weekStartDate: {
        employeeId: session.user.id,
        weekStartDate: weekStart,
      },
    },
  });

  if (existing) {
    redirect(`/timesheets/${existing.id}`);
  }

  const newTimesheet = await db.timesheetWeek.create({
    data: {
      employeeId: session.user.id,
      weekStartDate: weekStart,
    },
  });

  redirect(`/timesheets/${newTimesheet.id}`);
}
