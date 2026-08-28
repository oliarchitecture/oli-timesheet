import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/cron/keepalive
 * Triggered by Vercel Cron once daily (see vercel.json).
 *
 * Supabase pauses Free-plan projects after ~7 days of low database activity.
 * Normal use by the team is usually enough to prevent that, so this exists to
 * cover the quiet stretches - holidays, gaps between timesheet cycles.
 *
 * Deliberately read-only: it issues a trivial SELECT and writes nothing.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  } catch (err) {
    console.error("keepalive failed", err);
    return NextResponse.json({ ok: false, error: "Database unreachable" }, { status: 500 });
  }
}
