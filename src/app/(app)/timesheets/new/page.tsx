import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PeriodSetupForm } from "@/components/timesheet/PeriodSetupForm";
import { BackButton } from "@/components/ui/back-button";

export default async function NewTimesheetPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const employee = await db.employee.findUnique({
    where: { id: session.user.id },
    select: { defaultPeriodStartDay: true },
  });

  return (
    <div className="space-y-6 max-w-xl">
      <BackButton />
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">New Reporting Period</h2>
        <p className="text-sm text-neutral-500 mt-0.5">
          Choose the date range for this period. You&apos;ll fill in hours week by week.
        </p>
      </div>
      <div className="bg-white rounded-lg border border-neutral-200 p-6">
        <PeriodSetupForm defaultPeriodStartDay={employee?.defaultPeriodStartDay ?? null} />
      </div>
    </div>
  );
}
