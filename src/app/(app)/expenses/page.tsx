import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Receipt } from "lucide-react";

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

export default async function ExpensesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const reports = await db.expenseReport.findMany({
    where: { employeeId: session.user.id },
    include: { items: { select: { amount: true } } },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">My Expenses</h2>
          <p className="text-sm text-neutral-500 mt-0.5">Submit and track monthly expense reports</p>
        </div>
        <Button asChild>
          <Link href="/expenses/new">
            <Plus className="h-4 w-4" />
            New Report
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Expense Reports</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
              <Receipt className="h-8 w-8 mb-2" />
              <p className="text-sm">No expense reports yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {reports.map((r) => {
                const total = r.items.reduce((s, i) => s + i.amount, 0);
                return (
                  <Link
                    key={r.id}
                    href={`/expenses/${r.id}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-neutral-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-neutral-800">
                        {MONTH_NAMES[r.month - 1]} {r.year}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {r.items.length} item{r.items.length !== 1 ? "s" : ""} · ${total.toFixed(2)}
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
