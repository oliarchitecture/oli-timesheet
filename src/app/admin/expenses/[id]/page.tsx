import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { ExpenseReviewActions } from "./ExpenseReviewActions";
import { AdminDocumentList } from "./AdminDocumentList";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CATEGORY_LABELS: Record<string, string> = {
  TRANSPORTATION: "Transportation",
  MEALS: "Meals",
  ACCOMMODATION: "Accommodation",
  OTHER: "Other",
};

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  DRAFT: "secondary",
  SUBMITTED: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

export default async function AdminExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");
  const { id } = await params;

  const report = await db.expenseReport.findUnique({
    where: { id },
    include: {
      employee: { select: { name: true, email: true, title: true } },
      reviewer: { select: { name: true } },
      items: {
        include: { project: { select: { name: true } } },
        orderBy: { date: "asc" },
      },
      documents: { orderBy: { uploadedAt: "asc" } },
    },
  });

  if (!report) notFound();

  const total = report.items.reduce((s, i) => s + i.amount, 0);
  const amountDue = total - report.advanceAmount;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <BackButton />
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">
            Expense Report — {MONTH_NAMES[report.month - 1]} {report.year}
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">{report.employee.name}</p>
        </div>
        <Badge variant={statusVariant[report.status] ?? "secondary"} className="ml-auto">
          {report.status}
        </Badge>
      </div>

      {/* Employee Info */}
      <div className="grid grid-cols-2 gap-4 rounded-xl border border-neutral-200 bg-white p-6">
        <div>
          <p className="text-xs text-neutral-500 mb-0.5">Employee</p>
          <p className="text-sm font-medium">{report.employee.name}</p>
          {report.employee.title && <p className="text-xs text-neutral-400">{report.employee.title}</p>}
        </div>
        <div>
          <p className="text-xs text-neutral-500 mb-0.5">Email</p>
          <p className="text-sm">{report.employee.email}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500 mb-0.5">Period</p>
          <p className="text-sm">{MONTH_NAMES[report.month - 1]} {report.year}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500 mb-0.5">Submitted</p>
          <p className="text-sm">
            {report.submittedAt ? new Date(report.submittedAt).toLocaleDateString() : "—"}
          </p>
        </div>
        {report.reviewer && (
          <div>
            <p className="text-xs text-neutral-500 mb-0.5">Reviewed by</p>
            <p className="text-sm">{report.reviewer.name}</p>
          </div>
        )}
        {report.reviewedAt && (
          <div>
            <p className="text-xs text-neutral-500 mb-0.5">Reviewed on</p>
            <p className="text-sm">{new Date(report.reviewedAt).toLocaleDateString()}</p>
          </div>
        )}
      </div>

      {report.reviewComment && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-medium">Review comment: </span>{report.reviewComment}
        </div>
      )}

      {/* Line Items */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h3 className="text-sm font-semibold text-neutral-800">Expense Items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-100">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-600">Date</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-600">Project</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-600">Category</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-600">Description</th>
                <th className="px-4 py-2.5 text-right font-medium text-neutral-600">Amount ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {report.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 text-neutral-700">
                    {new Date(item.date).toLocaleDateString("en-US")}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{item.project.name}</td>
                  <td className="px-4 py-3 text-neutral-700">
                    {item.category === "OTHER"
                      ? `Other: ${item.otherDescription ?? ""}`
                      : CATEGORY_LABELS[item.category]}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{item.description}</td>
                  <td className="px-4 py-3 text-right text-neutral-700">${item.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-neutral-100 px-6 py-4">
          <div className="flex flex-col items-end gap-1 text-sm">
            <div className="flex gap-8">
              <span className="text-neutral-500">Total</span>
              <span className="font-semibold w-24 text-right">${total.toFixed(2)}</span>
            </div>
            <div className="flex gap-8">
              <span className="text-neutral-500">Less Advance</span>
              <span className="w-24 text-right">${report.advanceAmount.toFixed(2)}</span>
            </div>
            <div className="flex gap-8 border-t border-neutral-200 pt-1">
              <span className="text-neutral-800 font-medium">Amount Due</span>
              <span className="font-bold w-24 text-right text-primary-600">${amountDue.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {report.notes && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6">
          <p className="text-xs text-neutral-500 mb-1">Notes</p>
          <p className="text-sm text-neutral-700">{report.notes}</p>
        </div>
      )}

      {/* Documents */}
      <AdminDocumentList
        reportId={report.id}
        documents={report.documents.map((d) => ({
          id: d.id,
          fileName: d.fileName,
          fileSize: d.fileSize,
          uploadedAt: d.uploadedAt.toISOString(),
        }))}
      />

      {/* Review Actions */}
      {report.status === "SUBMITTED" && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 space-y-3">
          <h3 className="text-sm font-semibold text-neutral-800">Review</h3>
          <ExpenseReviewActions reportId={report.id} />
        </div>
      )}

      {/* Export for approved reports */}
      {report.status === "APPROVED" && (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 space-y-3">
          <h3 className="text-sm font-semibold text-neutral-800">Export</h3>
          <ExpenseReviewActions reportId={report.id} approvedOnly />
        </div>
      )}
    </div>
  );
}
