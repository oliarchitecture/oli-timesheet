import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { EmployeeEditForm } from "./EmployeeEditForm";
import { PTOBalancesForm } from "./PTOBalancesForm";
import { formatDate } from "@/lib/utils";
import { getPtoSummary } from "@/lib/pto-balance.server";
import { AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const employee = await db.employee.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, role: true,
      title: true, phone: true, isActive: true, startDate: true, photoUrl: true, createdAt: true,
    },
  });

  if (!employee) notFound();

  const initials = employee.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const [leaveBalances, pto] = await Promise.all([
    db.leaveBalance.findMany({
      where: { employeeId: id, year: new Date().getFullYear() },
    }),
    getPtoSummary(id, employee.startDate),
  ]);
  const workYear = pto && {
    cycleStart: pto.cycleStart.toISOString(),
    label: `${formatDate(pto.cycleStart)} – ${formatDate(new Date(pto.cycleEnd.getTime() - 86400000))}`,
    vacation: pto.vacation,
    sick: pto.sick,
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Profile header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          {employee.photoUrl && <AvatarImage src={employee.photoUrl} alt={employee.name} />}
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">{employee.name}</h2>
          <p className="text-sm text-neutral-500">{employee.title ?? "—"} · {employee.email}</p>
          <div className="flex gap-2 mt-1">
            <Badge variant={employee.role === "ADMIN" ? "default" : "secondary"}>{employee.role}</Badge>
            <Badge variant={employee.isActive ? "success" : "secondary"}>{employee.isActive ? "Active" : "Inactive"}</Badge>
          </div>
        </div>
      </div>

      <EmployeeEditForm employee={employee} />

      {/* PTO Balances */}
      <Card>
        <CardHeader>
          <CardTitle>PTO Balances</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pto && pto.mismatches.length > 0 && (
            <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Timesheet doesn&apos;t match approved PTO</p>
                <ul>
                  {pto.mismatches.map((m) => (
                    <li key={m.date.toISOString()}>
                      {m.message.replace(/your timesheet/g, "the timesheet").replace(/shows you worked/g, "shows a work day")}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <PTOBalancesForm key={workYear?.cycleStart ?? "none"} employeeId={id} balances={leaveBalances} workYear={workYear} />
        </CardContent>
      </Card>
    </div>
  );
}
