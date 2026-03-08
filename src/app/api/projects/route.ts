import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, clientName, code, status } = await req.json() as {
    name: string; clientName?: string; code?: string; status?: string;
  };

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const project = await db.project.create({
    data: {
      name,
      clientName: clientName || null,
      code: code || null,
      status: (status as "ACTIVE" | "COMPLETED" | "ON_HOLD") ?? "ACTIVE",
    },
  });

  return NextResponse.json(project, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await db.project.findMany({
    where: session.user.role === "ADMIN" ? {} : { status: "ACTIVE" },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(projects);
}
