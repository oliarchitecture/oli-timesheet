import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const timesheet = await db.timesheetWeek.findUnique({ where: { id } });
  if (!timesheet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (timesheet.employeeId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (timesheet.status !== "DRAFT") {
    return NextResponse.json({ error: "Only draft timesheets can be deleted" }, { status: 400 });
  }

  await db.timesheetEntry.deleteMany({ where: { timesheetWeekId: id } });
  await db.timesheetWeek.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
