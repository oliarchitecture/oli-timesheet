import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

const leaveTypeLabel: Record<string, string> = {
  VACATION: "Vacation",
  SICK: "Sick",
  PERSONAL: "Personal / Non-Paid Time",
  COMP_DAY: "Comp Day",
  OTHER: "Other",
};

export default async function AdminLeavePage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const requests = await db.leaveRequest.findMany({
    include: {
      employee: { select: { name: true } },
      days: true,
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const pending = requests.filter((r) => r.status === "PENDING");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">PTO Requests</h2>
        <p className="text-sm text-neutral-500 mt-0.5">{pending.length} pending · {requests.length} total</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {requests.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-10">No PTO requests yet.</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {requests.map((lr) => {
                const numDays = lr.days.reduce((sum, d) => sum + (d.halfDay ? 0.5 : 1.0), 0);
                return (
                  <Link
                    key={lr.id}
                    href={`/admin/leave/${lr.id}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-neutral-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-800">
                        {lr.employee.name} · {leaveTypeLabel[lr.type]}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {formatDate(lr.startDate)} – {formatDate(lr.endDate)}
                        {" · "}
                        {numDays} day{numDays !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Badge variant={statusVariant[lr.status] ?? "secondary"}>{lr.status}</Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
