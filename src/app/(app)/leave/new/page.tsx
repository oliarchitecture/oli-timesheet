"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { getFederalHolidays, isSameUTCDay } from "@/lib/holidays";

const LEAVE_TYPES = [
  { value: "VACATION", label: "Vacation" },
  { value: "SICK", label: "Sick" },
  { value: "PERSONAL", label: "Personal / Non-Paid Time" },
  { value: "COMP_DAY", label: "Comp Day" },
  { value: "OTHER", label: "Other" },
];

type DayEntry = { date: string; halfDay: boolean; reason: string };

function buildWorkdays(start: string, end: string): DayEntry[] {
  const result: DayEntry[] = [];
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
      result.push({ date: cur.toISOString().slice(0, 10), halfDay: false, reason: "" });
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return result;
}

export default function NewLeaveRequestPage() {
  const router = useRouter();
  const [type, setType] = useState("VACATION");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [days, setDays] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function recomputeDays(start: string, end: string) {
    if (start && end && end >= start) {
      setDays(buildWorkdays(start, end));
    } else {
      setDays([]);
    }
  }

  function handleStartDate(val: string) {
    setStartDate(val);
    recomputeDays(val, endDate);
  }

  function handleEndDate(val: string) {
    setEndDate(val);
    recomputeDays(startDate, val);
  }

  function updateDay(index: number, field: keyof DayEntry, value: boolean | string) {
    setDays((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: value } : d))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startDate || !endDate) {
      setError("Please select a start and end date.");
      return;
    }
    if (days.length === 0) {
      setError("The selected range contains no working days.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          startDate,
          endDate,
          days: days.map((d) => ({ date: d.date, halfDay: d.halfDay, reason: d.reason || null })),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to submit");
      }
      router.push("/leave");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const totalDays = days.reduce((sum, d) => sum + (d.halfDay ? 0.5 : 1), 0);
  const noWorkdays = startDate && endDate && endDate >= startDate && days.length === 0;

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
          <Link href="/leave"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <h2 className="text-xl font-semibold text-neutral-900">New PTO Request</h2>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Leave Type */}
            <div className="space-y-1.5">
              <Label htmlFor="type">Leave Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => handleEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* No working days warning */}
            {noWorkdays && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                The selected range contains no working days (weekends and holidays are excluded).
              </p>
            )}

            {/* Per-day calendar */}
            {days.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                    Days
                  </p>
                  <p className="text-xs text-neutral-500">
                    {totalDays} working day{totalDays !== 1 ? "s" : ""}
                    {" · "}holidays &amp; weekends excluded
                  </p>
                </div>

                <div className="space-y-1.5">
                  {days.map((day, i) => {
                    const d = new Date(day.date + "T00:00:00Z");
                    const dayName = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
                    const datePart = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
                    return (
                      <div
                        key={day.date}
                        className="flex items-center gap-3 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
                      >
                        {/* Date label */}
                        <div className="w-20 shrink-0">
                          <p className="text-xs font-semibold text-neutral-800">{dayName}</p>
                          <p className="text-xs text-neutral-500">{datePart}</p>
                        </div>

                        {/* Full Day / Half Day toggle */}
                        <div className="inline-flex rounded border border-neutral-200 overflow-hidden text-xs shrink-0">
                          <button
                            type="button"
                            onClick={() => updateDay(i, "halfDay", false)}
                            className={cn(
                              "px-3 py-1.5 font-medium transition-colors",
                              !day.halfDay
                                ? "bg-primary-500 text-white"
                                : "bg-white text-neutral-600 hover:bg-neutral-50"
                            )}
                          >
                            Full Day
                          </button>
                          <button
                            type="button"
                            onClick={() => updateDay(i, "halfDay", true)}
                            className={cn(
                              "px-3 py-1.5 font-medium transition-colors border-l border-neutral-200",
                              day.halfDay
                                ? "bg-primary-500 text-white"
                                : "bg-white text-neutral-600 hover:bg-neutral-50"
                            )}
                          >
                            Half Day
                          </button>
                        </div>

                        {/* Reason */}
                        <input
                          type="text"
                          placeholder="Reason (optional)"
                          value={day.reason}
                          onChange={(e) => updateDay(i, "reason", e.target.value)}
                          className="flex-1 min-w-0 rounded border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-700 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-primary-300"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" type="button" asChild>
                <Link href="/leave">Cancel</Link>
              </Button>
              <Button type="submit" disabled={loading || days.length === 0}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit Request
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
