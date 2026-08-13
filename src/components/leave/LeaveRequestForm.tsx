"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, ArrowLeft, Plus, X } from "lucide-react";
import Link from "next/link";
import { getFederalHolidays, isSameUTCDay } from "@/lib/holidays";

export const LEAVE_TYPES = [
  { value: "VACATION", label: "Vacation" },
  { value: "SICK", label: "Sick" },
  { value: "PERSONAL", label: "Personal / Non-Paid Time" },
  { value: "COMP_DAY", label: "Comp Day" },
  { value: "OTHER", label: "Other" },
];

export type LeaveType = "VACATION" | "SICK" | "PERSONAL" | "COMP_DAY" | "OTHER";

export interface DayEntry {
  date: string;
  type: LeaveType;
  halfDay: boolean;
  reason: string;
}

interface RangeRow {
  _key: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  reason: string;
}

function makeKey() {
  return Math.random().toString(36).slice(2);
}

function emptyRow(): RangeRow {
  return { _key: makeKey(), type: "VACATION", startDate: "", endDate: "", halfDay: false, reason: "" };
}

function computeWorkdays(start: string, end: string): string[] {
  const result: string[] = [];
  const cur = new Date(start + "T00:00:00Z");
  const last = new Date(end + "T00:00:00Z");
  const year1 = cur.getUTCFullYear();
  const year2 = last.getUTCFullYear();
  const holidays = [
    ...getFederalHolidays(year1),
    ...(year2 !== year1 ? getFederalHolidays(year2) : []),
  ];
  while (cur <= last) {
    const dow = cur.getUTCDay();
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = holidays.some((h) => isSameUTCDay(h.date, cur));
    if (!isWeekend && !isHoliday) {
      result.push(cur.toISOString().slice(0, 10));
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return result;
}

/** Expand rows into a flat, deduplicated, date-sorted list of days. Earlier rows win on overlap. */
function expandRows(rows: RangeRow[]): { days: DayEntry[]; overlapCount: number } {
  const seen = new Set<string>();
  const days: DayEntry[] = [];
  let overlapCount = 0;
  for (const row of rows) {
    if (!row.startDate || !row.endDate || row.endDate < row.startDate) continue;
    for (const date of computeWorkdays(row.startDate, row.endDate)) {
      if (seen.has(date)) {
        overlapCount++;
        continue;
      }
      seen.add(date);
      days.push({ date, type: row.type, halfDay: row.halfDay, reason: row.reason });
    }
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  return { days, overlapCount };
}

const DRAFT_KEY = "pto-draft";

interface LeaveRequestFormProps {
  mode: "create" | "edit";
  leaveId?: string;
  initialDays?: DayEntry[];
}

export function LeaveRequestForm({ mode, leaveId, initialDays }: LeaveRequestFormProps) {
  const router = useRouter();
  const [rows, setRows] = useState<RangeRow[]>(() => {
    if (initialDays && initialDays.length > 0) {
      // One row per stored day — simplest lossless representation for edit mode.
      return initialDays.map((d) => ({
        _key: makeKey(),
        type: d.type,
        startDate: d.date,
        endDate: d.date,
        halfDay: d.halfDay,
        reason: d.reason,
      }));
    }
    return [emptyRow()];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [restored, setRestored] = useState(false);

  // Restore draft from localStorage on mount (create mode only)
  useEffect(() => {
    if (mode !== "create") return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as RangeRow[];
      if (Array.isArray(saved) && saved.length > 0) {
        setRows(saved);
        setRestored(true);
      }
    } catch {
      // ignore malformed stored data
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist draft to localStorage whenever rows change (create mode only)
  useEffect(() => {
    if (mode !== "create") return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(rows));
    } catch { /* ignore */ }
  }, [rows, mode]);

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r._key !== key) : prev));
  }

  function updateRow(key: string, field: keyof RangeRow, value: string | boolean) {
    setRows((prev) =>
      prev.map((r) => (r._key === key ? { ...r, [field]: value } : r))
    );
  }

  const { days, overlapCount } = expandRows(rows);
  const totalDays = days.reduce((sum, d) => sum + (d.halfDay ? 0.5 : 1), 0);
  const typeBreakdown = LEAVE_TYPES
    .map((t) => ({
      label: t.label,
      count: days.filter((d) => d.type === t.value).reduce((sum, d) => sum + (d.halfDay ? 0.5 : 1), 0),
    }))
    .filter((t) => t.count > 0);

  async function handleSubmit() {
    if (days.length === 0) {
      setError("Add at least one valid date range.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const url = mode === "create" ? "/api/leave" : `/api/leave/${leaveId}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days: days.map((d) => ({ date: d.date, type: d.type, halfDay: d.halfDay, reason: d.reason || null })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to submit");
      }
      if (mode === "create") {
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      }
      router.push("/leave");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const isEdit = mode === "edit";

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
          <Link href="/leave"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h2 className="text-xl font-semibold text-neutral-900">
          {isEdit ? "Edit PTO Request" : "New PTO Request"}
        </h2>
      </div>

      {restored && (
        <p className="text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded px-3 py-2">
          Draft restored from your last session.
        </p>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h3 className="text-sm font-semibold text-neutral-800">Dates</h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Add a row per date range. Mix types by adding another row with a different type. Weekends &amp; holidays are excluded automatically.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-100">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-600 w-40">Type</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-600 w-36">Start</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-600 w-36">End</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-600 w-28">Day</th>
                <th className="px-4 py-2.5 text-left font-medium text-neutral-600">Reason</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((row) => (
                <tr key={row._key}>
                  <td className="px-4 py-2">
                    <select
                      value={row.type}
                      onChange={(e) => updateRow(row._key, "type", e.target.value)}
                      className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      {LEAVE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="date"
                      value={row.startDate}
                      onChange={(e) => updateRow(row._key, "startDate", e.target.value)}
                      className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="date"
                      value={row.endDate}
                      min={row.startDate}
                      onChange={(e) => updateRow(row._key, "endDate", e.target.value)}
                      className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={row.halfDay ? "half" : "full"}
                      onChange={(e) => updateRow(row._key, "halfDay", e.target.value === "half")}
                      className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="full">Full Day</option>
                      <option value="half">Half Day</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      placeholder="Reason (optional)"
                      value={row.reason}
                      onChange={(e) => updateRow(row._key, "reason", e.target.value)}
                      className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </td>
                  <td className="px-2 py-2">
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(row._key)}
                        className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                        title="Remove row"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
          <div className="text-xs text-neutral-500 text-right">
            {totalDays > 0 ? (
              <>
                {totalDays} working day{totalDays !== 1 ? "s" : ""}
                {typeBreakdown.length > 1 && (
                  <> · {typeBreakdown.map((t) => `${t.count} ${t.label}`).join(", ")}</>
                )}
                {overlapCount > 0 && (
                  <> · {overlapCount} overlapping day{overlapCount !== 1 ? "s" : ""} counted once</>
                )}
              </>
            ) : (
              "Add a date range above"
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>
      )}

      <div className="flex gap-2">
        <Button variant="outline" type="button" asChild>
          <Link href="/leave">Cancel</Link>
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" disabled={loading || days.length === 0}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Resubmit Request" : "Submit Request"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{isEdit ? "Resubmit PTO request?" : "Submit PTO request?"}</AlertDialogTitle>
              <AlertDialogDescription>
                {isEdit
                  ? "This will send your updated request back to your admin for review."
                  : "Once submitted, this request will be sent to your admin for review. Make sure all dates and types are correct."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSubmit} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {isEdit ? "Confirm Resubmit" : "Confirm Submit"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
