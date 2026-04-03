"use client";

import { useRouter, useSearchParams } from "next/navigation";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function TimesheetFilters({ currentYear, currentMonth, currentStatus }: {
  currentYear: string;
  currentMonth: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/admin/timesheets?${params.toString()}`);
  }

  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

  return (
    <div className="flex flex-wrap gap-3">
      <select
        value={currentYear}
        onChange={(e) => update("year", e.target.value)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-300"
      >
        <option value="">All Years</option>
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>

      <select
        value={currentMonth}
        onChange={(e) => update("month", e.target.value)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-300"
      >
        <option value="">All Months</option>
        {MONTHS.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
      </select>

      <select
        value={currentStatus}
        onChange={(e) => update("status", e.target.value)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-300"
      >
        <option value="">All Statuses</option>
        <option value="SUBMITTED">Submitted</option>
        <option value="APPROVED">Approved</option>
        <option value="REJECTED">Rejected</option>
      </select>
    </div>
  );
}
