import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { EmployeeEditForm } from "./EmployeeEditForm";
import { formatDate } from "@/lib/utils";
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

  const leaveBalances = await db.leaveBalance.findMany({
    where: { employeeId: id, year: new Date().getFullYear() },
  });

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

      {/* Leave balances */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Balances ({new Date().getFullYear()})</CardTitle>
        </CardHeader>
        <CardContent>
          {leaveBalances.length === 0 ? (
            <p className="text-sm text-neutral-500">No leave balances configured. They will be created automatically when leave is requested.</p>
          ) : (
            <div className="space-y-2">
              {leaveBalances.map((lb) => (
                <div key={lb.id} className="flex items-center justify-between py-1.5 border-b border-neutral-100 last:border-0">
                  <span className="text-sm text-neutral-700 capitalize">{lb.type.toLowerCase()}</span>
                  <span className="text-sm font-medium text-neutral-900">
                    {lb.totalDays - lb.usedDays} remaining / {lb.totalDays} total
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
