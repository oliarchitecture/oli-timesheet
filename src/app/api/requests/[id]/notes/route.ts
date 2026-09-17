import { NextResponse, after } from "next/server";
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

  // Notify the other side of the conversation after the response is sent. `after` keeps
  // the serverless function alive for it; an un-awaited promise would be discarded.
  const { name: authorName } = note.author;
  const { subject, body: noteBody } = { subject: request.subject, body: note.body };
  after(async () => {
    try {
      if (isOwner) {
        const admins = await db.employee.findMany({
          where: { role: "ADMIN", isActive: true },
          select: { name: true, email: true },
        });
        await Promise.all(
          admins.map((admin) =>
            notifyNewRequestNote(admin.email, admin.name, authorName, subject, noteBody, `/admin/requests/${id}`)
          )
        );
      } else {
        await notifyNewRequestNote(
          request.employee.email, request.employee.name, authorName, subject, noteBody, `/requests/${id}`
        );
      }
    } catch (err) {
      console.error("[email] Failed to notify about request note:", err);
    }
  });

  return NextResponse.json(note, { status: 201 });
}
