import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpenseFilters } from "./ExpenseFilters";
import { Suspense } from "react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  DRAFT: "secondary",
  SUBMITTED: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

export default async function AdminExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; year?: string; month?: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;
  const statusFilter = sp.status ?? "";
  const yearFilter = sp.year ?? "";
  const monthFilter = sp.month ?? "";

  const where: Record<string, unknown> = {};
  if (statusFilter) where.status = statusFilter;
  if (yearFilter) where.year = Number(yearFilter);
  if (monthFilter) where.month = Number(monthFilter);

  const reports = await db.expenseReport.findMany({
    where,
    include: {
      employee: { select: { name: true, email: true } },
      items: { select: { amount: true } },
    },
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
  });

  const pendingCount = reports.filter((r) => r.status === "SUBMITTED").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Expense Reports</h2>
        <p className="text-sm text-neutral-500 mt-0.5">
          {pendingCount} pending review · {reports.length} total
        </p>
      </div>

      <Suspense>
        <ExpenseFilters
          currentYear={yearFilter}
          currentMonth={monthFilter}
          currentStatus={statusFilter}
        />
      </Suspense>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>All Reports</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {reports.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-8">No expense reports found.</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {reports.map((r) => {
                const total = r.items.reduce((s, i) => s + i.amount, 0);
                return (
                  <Link
                    key={r.id}
                    href={`/admin/expenses/${r.id}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-neutral-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-800">
                        {r.employee.name} — {MONTH_NAMES[r.month - 1]} {r.year}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {r.items.length} item{r.items.length !== 1 ? "s" : ""} · ${total.toFixed(2)}
                        {r.submittedAt ? ` · Submitted ${new Date(r.submittedAt).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <Badge variant={statusVariant[r.status] ?? "secondary"}>{r.status}</Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
