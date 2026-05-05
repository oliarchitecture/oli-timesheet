import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { downloadReceipt } from "@/lib/supabase-storage";
import React from "react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const report = await db.expenseReport.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      items: {
        include: { project: { select: { name: true } } },
        orderBy: { date: "asc" },
      },
      documents: true,
    },
  });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Allow admin or the report's own employee
  const isAdmin = session.user.role === "ADMIN";
  const isOwner = report.employee.id === session.user.id;
  if (!isAdmin && !isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const monthName = MONTH_NAMES[report.month - 1];
  const total = report.items.reduce((s, i) => s + i.amount, 0);

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
      item.category === "OTHER"
        ? `Other: ${item.otherDescription ?? ""}`
        : item.category.charAt(0) + item.category.slice(1).toLowerCase(),
      item.description,
      item.amount.toFixed(2),
    ]),
    [],
    ["", "", "", "Total:", total.toFixed(2)],
    ["", "", "", "Less Advance:", report.advanceAmount.toFixed(2)],
    ["", "", "", "Amount Due:", (total - report.advanceAmount).toFixed(2)],
  ];

  if (report.notes) {
    rows.push([], ["Notes:", report.notes]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Expense Report");
  const xlsxBuf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  // Download document buffers (skip failures)
  const docBuffers: { doc: typeof report.documents[number]; buf: Buffer }[] = [];
  await Promise.all(
    report.documents.map(async (doc) => {
      try {
        const buf = await downloadReceipt(doc.fileUrl);
        docBuffers.push({ doc, buf });
      } catch {
        // skip missing files
      }
    })
  );

  // Separate image receipts for PDF embedding
  const imageReceipts = docBuffers
    .filter(({ doc }) => IMAGE_MIME_TYPES.has(doc.mimeType ?? ""))
    .map(({ doc, buf }) => ({
      fileName: doc.fileName,
      dataUrl: `data:${doc.mimeType ?? "image/jpeg"};base64,${buf.toString("base64")}`,
    }));

  // Build PDF (dynamic imports to avoid startup hang)
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { ExpensePDFDocument } = await import("@/lib/expense-pdf");
  const pdfElement = React.createElement(ExpensePDFDocument, {
    employeeName: report.employee.name,
    month: report.month,
    year: report.year,
    items: report.items.map((item) => ({
      date: item.date,
      projectName: item.project.name,
      category: item.category,
      otherDescription: item.otherDescription,
      description: item.description,
      amount: item.amount,
    })),
    advanceAmount: report.advanceAmount,
    notes: report.notes,
    imageReceipts,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
  const pdfBuf = await renderToBuffer(pdfElement);

  // Build ZIP
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const safeName = report.employee.name.replace(/\s+/g, "");
  zip.file(`ExpenseReport-${safeName}-${monthName}${report.year}.xlsx`, xlsxBuf);
  zip.file(`ExpenseReport-${safeName}-${monthName}${report.year}.pdf`, pdfBuf);

  // Non-image docs (PDFs etc.) go into receipts folder
  const nonImageDocs = docBuffers.filter(({ doc }) => !IMAGE_MIME_TYPES.has(doc.mimeType ?? ""));
  if (nonImageDocs.length > 0) {
    const receiptsFolder = zip.folder("receipts")!;
    nonImageDocs.forEach(({ doc, buf }) => {
      receiptsFolder.file(doc.fileName, buf);
    });
  }

  const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
  return new Response(new Uint8Array(zipBuf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="ExpenseReport-${safeName}-${monthName}${report.year}.zip"`,
    },
  });
}
