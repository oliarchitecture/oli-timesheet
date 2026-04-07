import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { downloadReceipt } from "@/lib/supabase-storage";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const report = await db.expenseReport.findUnique({
    where: { id },
    include: {
      employee: { select: { name: true, email: true } },
      items: {
        include: { project: { select: { name: true } } },
        orderBy: { date: "asc" },
      },
      documents: true,
    },
  });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const monthName = MONTH_NAMES[report.month - 1];
  const total = report.items.reduce((s, i) => s + i.amount, 0);
  const amountDue = total - report.advanceAmount;

  // Build Excel
  const XLSX = await import("xlsx");
  const rows: unknown[][] = [
    ["OLI Architecture"],
    ["6 West 18th Street, 2A, New York, NY 10011"],
    ["Tel: 212 675 0555"],
    [],
    ["EXPENSE REPORT"],
    [],
    ["Name:", report.employee.name, "", "Month:", `${monthName} ${report.year}`],
    ["Submitted:", report.submittedAt ? report.submittedAt.toLocaleDateString() : ""],
    [],
    ["Date", "Project", "Category", "Description", "Amount ($)"],
    ...report.items.map((item) => [
      new Date(item.date).toLocaleDateString("en-US"),
      item.project.name,
      item.category === "OTHER" ? `Other: ${item.otherDescription ?? ""}` : item.category.charAt(0) + item.category.slice(1).toLowerCase(),
      item.description,
      item.amount.toFixed(2),
    ]),
    [],
    ["", "", "", "Total:", total.toFixed(2)],
    ["", "", "", "Less Advance:", report.advanceAmount.toFixed(2)],
    ["", "", "", "Amount Due:", amountDue.toFixed(2)],
  ];

  if (report.notes) {
    rows.push([], ["Notes:", report.notes]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Expense Report");
  const xlsxBuf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  // Build ZIP
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const safeName = report.employee.name.replace(/\s+/g, "");
  zip.file(`ExpenseReport-${safeName}-${monthName}${report.year}.xlsx`, xlsxBuf);

  if (report.documents.length > 0) {
    const receiptsFolder = zip.folder("receipts")!;
    await Promise.all(
      report.documents.map(async (doc) => {
        try {
          const buf = await downloadReceipt(doc.fileUrl);
          receiptsFolder.file(doc.fileName, buf);
        } catch {
          // skip missing files
        }
      })
    );
  }

  const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
  return new Response(new Uint8Array(zipBuf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="ExpenseReport-${safeName}-${monthName}${report.year}.zip"`,
    },
  });
}
