import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const employee = await db.employee.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, name: true, email: true },
  });

  // Always respond success — don't reveal whether email exists
  if (employee) {
    await db.passwordResetToken.deleteMany({ where: { employeeId: employee.id } });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.passwordResetToken.create({
      data: { token, employeeId: employee.id, expiresAt },
    });

    await sendPasswordResetEmail(employee.email, employee.name, token);
  }

  return NextResponse.json({ ok: true });
}
