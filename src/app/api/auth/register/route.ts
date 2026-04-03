import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const { name, email, password } = await req.json() as {
    name: string;
    email: string;
    password: string;
  };

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
  }

  if (!email.endsWith("@oliarch.com")) {
    return NextResponse.json({ error: "Only @oliarch.com email addresses are allowed" }, { status: 400 });
  }

  const existing = await db.employee.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.employee.create({
    data: {
      name,
      email,
      passwordHash,
      role: "EMPLOYEE",
    },
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
