import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Redirect to the main report API and convert the data to Excel/PDF
export async function GET(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "excel";

  // Get the report data
  const reportParams = new URLSearchParams(searchParams);
  reportParams.delete("format");

  const reportUrl = new URL(`/api/reports?${reportParams}`, req.url);
  const reportRes = await fetch(reportUrl.toString(), {
    headers: { cookie: req.headers.get("cookie") ?? "" },
  });
  const { rows } = await reportRes.json() as { rows: Record<string, unknown>[] };

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "No data" }, { status: 404 });
  }

  if (format === "excel") {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="oli-report-${searchParams.get("type")}.xlsx"`,
      },
    });
  }

  // PDF: simple text-based PDF for now
  // (A proper styled PDF would use @react-pdf/renderer in a separate server action)
  const lines = [
    `OLI Architecture — Report`,
    `Type: ${searchParams.get("type")}`,
    `Period: ${searchParams.get("startDate")} to ${searchParams.get("endDate")}`,
    "",
    ...(rows.length > 0 ? [Object.keys(rows[0]).join("\t")] : []),
    ...rows.map((r) => Object.values(r).join("\t")),
  ];

  const text = lines.join("\n");

  return new Response(text, {
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition": `attachment; filename="oli-report-${searchParams.get("type")}.txt"`,
    },
  });
}
