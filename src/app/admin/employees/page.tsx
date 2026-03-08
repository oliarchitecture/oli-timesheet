import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Employee } from "@prisma/client";
import { AddEmployeeDialog } from "./AddEmployeeDialog";

export default async function EmployeesPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const employees = await db.employee.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Employee Directory</h2>
          <p className="text-sm text-neutral-500 mt-0.5">{employees.filter((e) => e.isActive).length} active employees</p>
        </div>
        <AddEmployeeDialog />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-neutral-100">
            {employees.map((emp: Employee) => {
              const initials = emp.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
              return (
                <Link
                  key={emp.id}
                  href={`/admin/employees/${emp.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-neutral-50 transition-colors"
                >
                  <Avatar className="h-9 w-9">
                    {emp.photoUrl && <AvatarImage src={emp.photoUrl} alt={emp.name} />}
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-800 truncate">{emp.name}</p>
                    <p className="text-xs text-neutral-500 truncate">
                      {emp.title ?? "—"} · {emp.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={emp.role === "ADMIN" ? "default" : "secondary"}>
                      {emp.role}
                    </Badge>
                    <Badge variant={emp.isActive ? "success" : "secondary"}>
                      {emp.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {emp.startDate && (
                      <span className="text-xs text-neutral-400 hidden md:block">
                        Since {formatDate(emp.startDate)}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
