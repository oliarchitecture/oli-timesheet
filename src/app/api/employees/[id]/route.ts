import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

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

  return NextResponse.json(employee);
}
