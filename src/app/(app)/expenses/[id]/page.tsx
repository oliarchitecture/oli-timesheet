import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { ExpenseForm } from "./ExpenseForm";

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  const { id } = await params;

  const [report, projects] = await Promise.all([
    db.expenseReport.findUnique({
      where: { id },
      include: {
        items: {
          include: { project: { select: { id: true, name: true } } },
          orderBy: { date: "asc" },
        },
        documents: { orderBy: { uploadedAt: "asc" } },
      },
    }),
    db.project.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!report || report.employeeId !== session.user.id) notFound();

  return (
    <div className="space-y-4">
      <BackButton />
      <ExpenseForm
        reportId={report.id}
        month={report.month}
        year={report.year}
        status={report.status}
        advanceAmount={report.advanceAmount}
        notes={report.notes}
        reviewComment={report.reviewComment}
        initialItems={report.items.map((item) => ({
          id: item.id,
          projectId: item.projectId,
          date: item.date.toISOString(),
          category: item.category,
          otherDescription: item.otherDescription,
          description: item.description,
          amount: item.amount,
        }))}
        initialDocuments={report.documents.map((d) => ({
          id: d.id,
          fileName: d.fileName,
          fileSize: d.fileSize,
          mimeType: d.mimeType,
          uploadedAt: d.uploadedAt.toISOString(),
        }))}
        projects={projects}
      />
    </div>
  );
}
