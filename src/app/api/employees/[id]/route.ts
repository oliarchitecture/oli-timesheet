import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { computePtoEntitlement } from "@/lib/leave-utils";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Employees can only update their own profile; admins can update anyone
  if (session.user.role !== "ADMIN" && session.user.id !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as Record<string, unknown>;
  const allowed = ["name", "title", "phone", "photoUrl", "startDate"];
  const adminOnly = ["role", "isActive", "email"];

  const updateData: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updateData[key] = body[key];
  }
  if (session.user.role === "ADMIN") {
    for (const key of adminOnly) {
      if (key in body) updateData[key] = body[key];
    }
    if (updateData.email && typeof updateData.email === "string") {
      updateData.email = updateData.email.toLowerCase().trim();
    }
    if (body.password && typeof body.password === "string") {
      updateData.passwordHash = await bcrypt.hash(body.password, 12);
    }
  }

  const employee = await db.employee.update({
    where: { id },
    data: updateData,
    select: {
      id: true, name: true, email: true, role: true,
      title: true, phone: true, isActive: true, startDate: true, photoUrl: true,
    },
  });

  // If a start date was just set, auto-fill this year's Vacation/Sick allotment
  // per the OLI guidelines — but only where it hasn't already been set to a
  // nonzero value by an admin (that's treated as an intentional override).
  if ("startDate" in updateData && employee.startDate) {
    const entitlement = computePtoEntitlement(employee.startDate);
    const year = new Date().getFullYear();
    const targets: { type: "VACATION" | "SICK"; total: number }[] = [
      { type: "VACATION", total: entitlement.vacationTotal },
      { type: "SICK", total: entitlement.sickTotal },
    ];
    for (const { type, total } of targets) {
      const existing = await db.leaveBalance.findUnique({
        where: { employeeId_year_type: { employeeId: employee.id, year, type } },
      });
      if (!existing || existing.totalDays === 0) {
        await db.leaveBalance.upsert({
          where: { employeeId_year_type: { employeeId: employee.id, year, type } },
          update: { totalDays: total },
          create: { employeeId: employee.id, year, type, totalDays: total, usedDays: 0 },
        });
      }
    }
  }

  return NextResponse.json(employee);
}
