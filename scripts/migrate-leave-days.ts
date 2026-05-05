/**
 * Data migration script: populate LeaveRequestDay from legacy LeaveRequest records.
 *
 * Run this if you have existing LeaveRequest rows from before the per-day schema
 * change. Requires the LeaveRequestDay table to already exist.
 *
 * Usage: npx tsx scripts/migrate-leave-days.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

type LegacyRow = {
  id: string;
  startDate: Date;
  endDate: Date;
  halfDay: boolean;
  reason: string | null;
};

function getWeekdays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(start);
  cur.setUTCHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setUTCHours(0, 0, 0, 0);
  while (cur <= last) {
    const dow = cur.getUTCDay();
    if (dow >= 1 && dow <= 5) days.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

async function main() {
  // Use raw SQL to read legacy columns that may no longer be in Prisma client types
  const rows = await db.$queryRaw<LegacyRow[]>`
    SELECT id, "startDate", "endDate", "halfDay", reason FROM "LeaveRequest"
  `;

  console.log(`Migrating ${rows.length} LeaveRequest record(s)...`);

  for (const row of rows) {
    const existing = await db.leaveRequestDay.count({ where: { leaveRequestId: row.id } });
    if (existing > 0) {
      console.log(`  Skipping ${row.id} — already has ${existing} day(s).`);
      continue;
    }
    const weekdays = getWeekdays(new Date(row.startDate), new Date(row.endDate));
    if (weekdays.length === 0) {
      console.log(`  Skipping ${row.id} — no weekdays in range.`);
      continue;
    }
    await db.leaveRequestDay.createMany({
      data: weekdays.map((day) => ({
        leaveRequestId: row.id,
        date: day,
        halfDay: row.halfDay ?? false,
        reason: row.reason ?? null,
      })),
    });
    console.log(`  Created ${weekdays.length} day(s) for request ${row.id}.`);
  }

  console.log("Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
