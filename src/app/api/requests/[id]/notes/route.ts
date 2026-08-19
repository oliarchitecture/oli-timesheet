import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifyNewRequestNote } from "@/lib/email";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const request = await db.generalRequest.findUnique({
    where: { id },
    include: { employee: { select: { name: true, email: true } } },
  });
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = request.employeeId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (request.notesClosed) {
    return NextResponse.json({ error: "This conversation is closed" }, { status: 400 });
  }

  const { body } = await req.json() as { body: string };
  if (!body?.trim()) {
    return NextResponse.json({ error: "Note text is required" }, { status: 400 });
  }

  const note = await db.requestNote.create({
    data: { generalRequestId: id, authorId: session.user.id, body: body.trim() },
    include: { author: { select: { name: true } } },
  });

  // Fire-and-forget: notify the other side of the conversation
  if (isOwner) {
    db.employee.findUnique({ where: { email: "okamoto@oliarch.com" }, select: { name: true, email: true } })
      .then((hiroshi) => {
        if (!hiroshi) return;
        void notifyNewRequestNote(hiroshi.email, hiroshi.name, note.author.name, request.subject, note.body, `/admin/requests/${id}`);
      })
      .catch(() => {});
  } else {
    void notifyNewRequestNote(request.employee.email, request.employee.name, note.author.name, request.subject, note.body, `/requests/${id}`);
  }

  return NextResponse.json(note, { status: 201 });
}
