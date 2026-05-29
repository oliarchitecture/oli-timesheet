import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet, FileText } from "lucide-react";

type Tab = "by-project" | "by-phase";

function monthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  return { start, end };
}

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default async function EmployeeSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; year?: string; month?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const tab = (sp.tab ?? "by-project") as Tab;

  const now = new Date();
  const year = sp.year ? parseInt(sp.year) : now.getFullYear();
  const month = sp.month ? parseInt(sp.month) : now.getMonth() + 1;

  const { start, end } = monthBounds(year, month);

  let rows: { label: string; sublabel?: string; hours: number }[] = [];

  if (tab === "by-project") {
    const entries = await db.timesheetEntry.findMany({
      where: {
        timesheetWeek: {
          employeeId: session.user.id,
          weekStartDate: { gte: start, lte: end },
        },
      },
      include: { project: { select: { name: true } } },
    });
    const map = new Map<string, { name: string; hours: number }>();
    for (const e of entries) {
      if (!map.has(e.projectId)) map.set(e.projectId, { name: e.project.name, hours: 0 });
      map.get(e.projectId)!.hours += e.hours;
    }
    rows = Array.from(map.values())
      .filter((r) => r.hours > 0)
      .sort((a, b) => b.hours - a.hours)
      .map((r) => ({ label: r.name, hours: r.hours }));
  }

  if (tab === "by-phase") {
    const entries = await db.timesheetEntry.findMany({
      where: {
        timesheetWeek: {
          employeeId: session.user.id,
          weekStartDate: { gte: start, lte: end },
        },
      },
      include: { project: { select: { name: true } } },
    });
    const map = new Map<string, { label: string; sublabel: string; hours: number }>();
    for (const e of entries) {
      const key = `${e.projectId}|${e.phase}`;
      if (!map.has(key)) map.set(key, { label: e.project.name, sublabel: e.phase || "(no phase)", hours: 0 });
      map.get(key)!.hours += e.hours;
    }
    rows = Array.from(map.values())
      .filter((r) => r.hours > 0)
      .sort((a, b) => b.hours - a.hours || a.label.localeCompare(b.label));
  }

  const totalHours = rows.reduce((s, r) => s + r.hours, 0);

  const exportType = tab === "by-project" ? "hours-by-project" : "hours-by-phase";
  const exportBase = `/api/reports/export?type=${exportType}&startDate=${fmtDate(start)}&endDate=${fmtDate(end)}&employeeId=${session.user.id}`;

  const tabs: { id: Tab; label: string }[] = [
    { id: "by-project", label: "By Project" },
    { id: "by-phase", label: "By Phase" },
  ];

  function tabHref(t: Tab) {
    return `/summary?tab=${t}&year=${year}&month=${month}`;
  }

  function filterHref(overrides: Record<string, string>) {
    return `/summary?${new URLSearchParams({ tab, year: String(year), month: String(month), ...overrides })}`;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">My Hours Summary</h2>
          <p className="text-sm text-neutral-500 mt-0.5">{MONTHS[month - 1]} {year}</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`${exportBase}&format=excel`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Export Excel
          </a>
          <a
            href={`${exportBase}&format=pdf`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Export PDF
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Month</p>
          <div className="flex flex-wrap gap-1">
            {MONTHS.map((m, i) => (
              <Link
                key={i}
                href={filterHref({ month: String(i + 1) })}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  month === i + 1
                    ? "bg-primary-500 text-white border-primary-500"
                    : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {m.slice(0, 3)}
              </Link>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Year</p>
          <div className="flex gap-1">
            {[now.getFullYear() - 1, now.getFullYear()].map((y) => (
              <Link
                key={y}
                href={filterHref({ year: String(y) })}
                className={`px-3 py-1 text-xs rounded border transition-colors ${
                  year === y
                    ? "bg-primary-500 text-white border-primary-500"
                    : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {y}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={tabHref(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>{tabs.find((t) => t.id === tab)?.label}</span>
            {totalHours > 0 && (
              <span className="text-sm font-normal text-neutral-500">{totalHours}h total</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-10">No hours logged for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200">
                    <th className="text-left px-5 py-2.5 font-medium text-neutral-600">Project</th>
                    {tab === "by-phase" && (
                      <th className="text-left px-5 py-2.5 font-medium text-neutral-600">Phase</th>
                    )}
                    <th className="text-right px-5 py-2.5 font-medium text-neutral-600">Hours</th>
                    <th className="text-right px-5 py-2.5 font-medium text-neutral-600">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-neutral-800">{row.label}</td>
                      {tab === "by-phase" && (
                        <td className="px-5 py-3 text-neutral-500">{row.sublabel ?? "—"}</td>
                      )}
                      <td className="px-5 py-3 text-right font-semibold text-neutral-900">{row.hours}h</td>
                      <td className="px-5 py-3 text-right text-neutral-500">
                        {totalHours > 0 ? `${Math.round((row.hours / totalHours) * 100)}%` : "—"}
                        <div className="h-1 bg-neutral-100 rounded-full mt-1 w-16 ml-auto">
                          <div
                            className="h-1 bg-primary-400 rounded-full"
                            style={{ width: `${totalHours > 0 ? (row.hours / totalHours) * 100 : 0}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-neutral-50 border-t-2 border-neutral-200 font-semibold">
                    <td colSpan={tab === "by-phase" ? 2 : 1} className="px-5 py-2.5 text-neutral-700">Total</td>
                    <td className="px-5 py-2.5 text-right text-primary-600">{totalHours}h</td>
                    <td className="px-5 py-2.5 text-right text-neutral-500">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
