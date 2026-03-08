import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { ProfileEditForm } from "./ProfileEditForm";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default async function ProfilePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const employee = await db.employee.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true, role: true,
      title: true, phone: true, isActive: true, startDate: true, photoUrl: true,
    },
  });

  if (!employee) redirect("/login");

  const initials = employee.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          {employee.photoUrl && <AvatarImage src={employee.photoUrl} alt={employee.name} />}
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">{employee.name}</h2>
          <p className="text-sm text-neutral-500">{employee.title ?? "—"} · {employee.email}</p>
          <Badge variant={employee.role === "ADMIN" ? "default" : "secondary"} className="mt-1">
            {employee.role}
          </Badge>
        </div>
      </div>
      <ProfileEditForm employee={employee} />
    </div>
  );
}
