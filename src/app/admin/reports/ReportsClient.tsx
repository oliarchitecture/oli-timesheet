"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Download, FileSpreadsheet, FileText } from "lucide-react";

interface Employee { id: string; name: string; }
interface Project { id: string; name: string; }

interface ReportRow {
  name: string;
  [key: string]: string | number;
}

export function ReportsClient({ employees, projects }: { employees: Employee[]; projects: Project[] }) {
  const [reportType, setReportType] = useState("hours-by-employee");
  const [employeeId, setEmployeeId] = useState("all");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportRow[] | null>(null);
  const [error, setError] = useState("");

  async function runReport() {
    setLoading(true);
    setError("");
    setData(null);
    try {
      const params = new URLSearchParams({
        type: reportType,
        startDate,
        endDate,
        ...(employeeId !== "all" ? { employeeId } : {}),
      });
      const res = await fetch(`/api/reports?${params}`);
      if (!res.ok) throw new Error("Report failed");
      const result = await res.json();
      setData(result.rows);
    } catch {
      setError("Failed to generate report.");
    } finally {
      setLoading(false);
    }
  }

  async function exportReport(format: "pdf" | "excel") {
    const params = new URLSearchParams({
      type: reportType,
      startDate,
      endDate,
      format,
      ...(employeeId !== "all" ? { employeeId } : {}),
    });
    window.open(`/api/reports/export?${params}`, "_blank");
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader><CardTitle>Report Filters</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours-by-employee">Hours by Employee</SelectItem>
                  <SelectItem value="hours-by-project">Hours by Project</SelectItem>
                  <SelectItem value="leave-summary">Leave Summary</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startDate">From</Label>
              <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">To</Label>
              <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={runReport} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Generate Report
            </Button>
            {data && (
              <>
                <Button variant="outline" onClick={() => exportReport("excel")}>
                  <FileSpreadsheet className="h-4 w-4" />
                  Export Excel
                </Button>
                <Button variant="outline" onClick={() => exportReport("pdf")}>
                  <FileText className="h-4 w-4" />
                  Export PDF
                </Button>
              </>
            )}
          </div>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </CardContent>
      </Card>

      {/* Results */}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle>
              {reportType === "hours-by-employee" && "Hours by Employee"}
              {reportType === "hours-by-project" && "Hours by Project"}
              {reportType === "leave-summary" && "Leave Summary"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-8">No data for the selected period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200">
                      {Object.keys(data[0]).map((key) => (
                        <th key={key} className="text-left px-5 py-2.5 font-medium text-neutral-600 capitalize">
                          {key.replace(/_/g, " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, i) => (
                      <tr key={i} className="border-b border-neutral-100 last:border-0">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-5 py-3 text-neutral-700">{String(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
