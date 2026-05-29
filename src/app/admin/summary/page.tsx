import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet, FileText, Download } from "lucide-react";

type Tab = "by-employee" | "by-project" | "by-phase";

function monthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  return { start, end };
}

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function AdminSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; year?: string; month?: string; employeeId?: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const tab = (sp.tab ?? "by-employee") as Tab;

  const now = new Date();
  const year = sp.year ? parseInt(sp.year) : now.getFullYear();
  const month = sp.month ? parseInt(sp.month) : now.getMonth() + 1;
  const employeeId = sp.employeeId && sp.employeeId !== "all" ? sp.employeeId : undefined;

  const { start, end } = monthBounds(year, month);

  const employees = await db.employee.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // ── Fetch data for the active tab ──────────────────────────────────────────

  let rows: { label: string; sublabel?: string; hours: number; extra?: string }[] = [];

  if (tab === "by-employee") {
    const data = await db.employee.findMany({
      where: { isActive: true, ...(employeeId ? { id: employeeId } : {}) },
      select: {
        name: true,
        timesheets: {
          where: { weekStartDate: { gte: start, lte: end } },
          include: { entries: { select: { hours: true } } },
        },
      },
      orderBy: { name: "asc" },
    });
    rows = data
      .map((e) => ({
        label: e.name,
        hours: e.timesheets.flatMap((t) => t.entries).reduce((s, x) => s + x.hours, 0),
      }))
      .filter((r) => r.hours > 0)
      .sort((a, b) => b.hours - a.hours);
  }

  if (tab === "by-project") {
    const data = await db.project.findMany({
      select: {
        name: true,
        clientName: true,
        entries: {
          where: {
            timesheetWeek: {
              weekStartDate: { gte: start, lte: end },
              ...(employeeId ? { employeeId } : {}),
            },
          },
          select: { hours: true, timesheetWeek: { select: { employeeId: true } } },
        },
      },
      orderBy: { name: "asc" },
    });
    rows = data
      .map((p) => ({
        label: p.name,
        sublabel: p.clientName ?? undefined,
        hours: p.entries.reduce((s, e) => s + e.hours, 0),
        extra: `${new Set(p.entries.map((e) => e.timesheetWeek.employeeId)).size} contributor(s)`,
      }))
      .filter((r) => r.hours > 0)
      .sort((a, b) => b.hours - a.hours);
  }

  if (tab === "by-phase") {
    const entries = await db.timesheetEntry.findMany({
      where: {
        timesheetWeek: {
          weekStartDate: { gte: start, lte: end },
          ...(employeeId ? { employeeId } : {}),
        },
      },
      include: {
        project: { select: { name: true } },
        timesheetWeek: { select: { employeeId: true } },
      },
    });
    const map = new Map<string, { label: string; sublabel: string; hours: number; contributors: Set<string> }>();
    for (const e of entries) {
      const key = `${e.projectId}|${e.phase}`;
      if (!map.has(key)) {
        map.set(key, { label: e.project.name, sublabel: e.phase || "(no phase)", hours: 0, contributors: new Set() });
      }
      const r = map.get(key)!;
      r.hours += e.hours;
      r.contributors.add(e.timesheetWeek.employeeId);
    }
    rows = Array.from(map.values())
      .filter((r) => r.hours > 0)
      .sort((a, b) => b.hours - a.hours || a.label.localeCompare(b.label))
      .map(({ contributors, ...r }) => ({ ...r, extra: `${contributors.size} contributor(s)` }));
  }

  const totalHours = rows.reduce((s, r) => s + r.hours, 0);

  // Build export URL params
  const exportBase = `/api/reports/export?type=${
    tab === "by-employee" ? "hours-by-employee" : tab === "by-project" ? "hours-by-project" : "hours-by-phase"
  }&startDate=${fmtDate(start)}&endDate=${fmtDate(end)}${employeeId ? `&employeeId=${employeeId}` : ""}`;

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const tabs: { id: Tab; label: string }[] = [
    { id: "by-employee", label: "By Employee" },
    { id: "by-project", label: "By Project" },
    { id: "by-phase", label: "By Phase" },
  ];

  function tabHref(t: Tab) {
    const p = new URLSearchParams({ tab: t, year: String(year), month: String(month) });
    if (employeeId) p.set("employeeId", employeeId);
    return `/admin/summary?${p}`;
  }

  function filterHref(overrides: Record<string, string>) {
    const p = new URLSearchParams({ tab, year: String(year), month: String(month), ...(employeeId ? { employeeId } : {}), ...overrides });
    return `/admin/summary?${p}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Summary</h2>
          <p className="text-sm text-neutral-500 mt-0.5">Hours breakdown for {MONTHS[month - 1]} {year}</p>
        </div>
        {/* Export buttons */}
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
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Month</p>
          <div className="flex gap-1">
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
        <div className="space-y-1">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Employee</p>
          <div className="flex gap-1 flex-wrap">
            <Link
              href={filterHref({ employeeId: "" })}
              className={`px-3 py-1 text-xs rounded border transition-colors ${
                !employeeId ? "bg-primary-500 text-white border-primary-500" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              All
            </Link>
            {employees.map((e) => (
              <Link
                key={e.id}
                href={filterHref({ employeeId: e.id })}
                className={`px-3 py-1 text-xs rounded border transition-colors ${
                  employeeId === e.id ? "bg-primary-500 text-white border-primary-500" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {e.name.split(" ")[0]}
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
            <span className="text-sm font-normal text-neutral-500">{totalHours}h total</span>
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
                    <th className="text-left px-5 py-2.5 font-medium text-neutral-600">
                      {tab === "by-employee" ? "Employee" : "Project"}
                    </th>
                    {tab !== "by-employee" && (
                      <th className="text-left px-5 py-2.5 font-medium text-neutral-600">
                        {tab === "by-phase" ? "Phase" : "Client"}
                      </th>
                    )}
                    {tab !== "by-employee" && (
                      <th className="text-left px-5 py-2.5 font-medium text-neutral-600">Contributors</th>
                    )}
                    <th className="text-right px-5 py-2.5 font-medium text-neutral-600">Hours</th>
                    <th className="text-right px-5 py-2.5 font-medium text-neutral-600">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-neutral-800">{row.label}</td>
                      {tab !== "by-employee" && (
                        <td className="px-5 py-3 text-neutral-500">{row.sublabel ?? "—"}</td>
                      )}
                      {tab !== "by-employee" && (
                        <td className="px-5 py-3 text-neutral-500">{row.extra ?? "—"}</td>
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
                    <td colSpan={tab === "by-employee" ? 1 : 3} className="px-5 py-2.5 text-neutral-700">Total</td>
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
