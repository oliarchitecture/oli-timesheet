import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { LeaveRequest, Employee } from "@prisma/client";

export default async function LeaveCalendarPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Show approved leave for the next 3 months
  const today = new Date();
  const threeMonthsOut = new Date(today);
  threeMonthsOut.setMonth(threeMonthsOut.getMonth() + 3);

  const approvedLeave = await db.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      endDate: { gte: today },
      startDate: { lte: threeMonthsOut },
    },
    include: { employee: { select: { name: true } } },
    orderBy: { startDate: "asc" },
  });

  const leaveTypeLabel: Record<string, string> = {
    VACATION: "Vacation",
    SICK: "Sick",
    PERSONAL: "Personal",
    OTHER: "Other",
  };

  const typeColor: Record<string, string> = {
    VACATION: "bg-blue-100 text-blue-700",
    SICK: "bg-red-100 text-red-700",
    PERSONAL: "bg-purple-100 text-purple-700",
    OTHER: "bg-neutral-100 text-neutral-700",
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Leave Calendar</h2>
        <p className="text-sm text-neutral-500 mt-0.5">Team leave for the next 3 months</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          {approvedLeave.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-6">No approved leave in this period.</p>
          ) : (
            <div className="space-y-3">
              {approvedLeave.map((lr: LeaveRequest & { employee: { name: string } }) => (
                <div key={lr.id} className="flex items-center gap-4 py-2 border-b border-neutral-100 last:border-0">
                  <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${typeColor[lr.type]}`}>
                    {leaveTypeLabel[lr.type]}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-800">{lr.employee.name}</p>
                    <p className="text-xs text-neutral-500">
                      {formatDate(lr.startDate)} – {formatDate(lr.endDate)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
