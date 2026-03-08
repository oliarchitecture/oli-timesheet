import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, email, password, title, phone, role } = await req.json() as {
    name: string; email: string; password: string;
    title?: string; phone?: string; role?: string;
  };

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
  }

  const existing = await db.employee.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const employee = await db.employee.create({
    data: {
      name,
      email,
      passwordHash,
      title: title || null,
      phone: phone || null,
      role: role === "ADMIN" ? "ADMIN" : "EMPLOYEE",
    },
  });

  const { passwordHash: _, ...safeEmployee } = employee;
  return NextResponse.json(safeEmployee, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const employees = await db.employee.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, email: true, role: true,
      title: true, phone: true, isActive: true, startDate: true, photoUrl: true,
    },
  });

  return NextResponse.json(employees);
}
