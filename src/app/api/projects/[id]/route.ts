import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { name, clientName, code, status } = await req.json() as {
    name?: string; clientName?: string; code?: string; status?: string;
  };

  const project = await db.project.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(clientName !== undefined && { clientName: clientName || null }),
      ...(code !== undefined && { code: code || null }),
      ...(status !== undefined && { status: status as "ACTIVE" | "COMPLETED" | "ON_HOLD" }),
    },
  });

  return NextResponse.json(project);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  await db.project.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
