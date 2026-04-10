"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TimesheetGrid, TimesheetGridHandle } from "./TimesheetGrid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDateShort, getWeekDays } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Send, Loader2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Project { id: string; name: string; }

interface EntryData {
  projectId: string;
  phase: string;
  date: string;
  hours: number;
  absenceCode?: string | null;
  notes?: string | null;
}

interface WeekData {
  id: string;
  weekStartDate: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  updatedAt: string;
  entries: EntryData[];
}

interface PeriodViewProps {
  periodId: string;
  startDate: string;
  endDate: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  weeks: WeekData[];
  projects: Project[];
  isAdmin?: boolean;
}

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  DRAFT: "secondary",
  SUBMITTED: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

function formatWeekLabel(weekStartDate: string): string {
  const start = new Date(weekStartDate);
  const end = getWeekDays(start)[6];
  return `${formatDateShort(start)} – ${formatDateShort(end)}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PeriodView({
  periodId,
  startDate,
  endDate,
  status,
  weeks,
  projects,
  isAdmin = false,
}: PeriodViewProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const gridRef = useRef<TimesheetGridHandle>(null);

  const selectedWeek = weeks[selectedIndex] ?? weeks[0];

  if (!selectedWeek) {
    return <p className="text-sm text-neutral-500 py-8 text-center">No weeks found for this timesheet.</p>;
  }

  async function switchWeek(newIndex: number) {
    if (newIndex === selectedIndex) return;

    // Auto-save current week if dirty
    if (gridRef.current?.isDirty) {
      await gridRef.current.save();
    }
    setSelectedIndex(newIndex);
  }

  async function handleSubmitPeriod() {
    setSubmitting(true);
    setError("");
    try {
      // Auto-save current week first if dirty
      if (gridRef.current?.isDirty) {
        await gridRef.current.save();
      }

      const res = await fetch(`/api/report-periods/${periodId}/submit`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Submit failed");
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  return (
    <div className="space-y-5">
      {/* Period header */}
      <div className="bg-white rounded-lg border border-neutral-200 p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold text-neutral-900">
                {formatDateShort(start)} – {formatDateShort(end)}
              </h2>
              <Badge variant={statusVariant[status] ?? "secondary"}>{status}</Badge>
            </div>
            <p className="text-sm text-neutral-500">{weeks.length} week{weeks.length !== 1 ? "s" : ""}</p>
          </div>

          {status === "DRAFT" && !isAdmin && (
            <div className="flex flex-col items-end gap-1">
              <Button onClick={handleSubmitPeriod} disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
                ) : (
                  <><Send className="h-4 w-4" /> Submit Timesheet</>
                )}
              </Button>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Week navigation */}
      <div className="bg-white rounded-lg border border-neutral-200 p-5 space-y-5">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          <button
            onClick={() => switchWeek(Math.max(0, selectedIndex - 1))}
            disabled={selectedIndex === 0}
            className="p-1.5 rounded text-neutral-400 hover:text-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {weeks.map((week, i) => (
            <button
              key={week.id}
              onClick={() => switchWeek(i)}
              className={cn(
                "px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-colors shrink-0",
                i === selectedIndex
                  ? "bg-primary-500 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              )}
            >
              {formatWeekLabel(week.weekStartDate)}
              {week.status !== "DRAFT" && (
                <span className={cn(
                  "ml-1.5 inline-block w-1.5 h-1.5 rounded-full align-middle",
                  week.status === "SUBMITTED" ? "bg-amber-400" :
                  week.status === "APPROVED" ? "bg-green-400" : "bg-red-400"
                )} />
              )}
            </button>
          ))}

          <button
            onClick={() => switchWeek(Math.min(weeks.length - 1, selectedIndex + 1))}
            disabled={selectedIndex === weeks.length - 1}
            className="p-1.5 rounded text-neutral-400 hover:text-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Grid for selected week */}
        <TimesheetGrid
          ref={gridRef}
          key={selectedWeek.id}
          timesheetId={selectedWeek.id}
          weekStart={new Date(selectedWeek.weekStartDate)}
          projects={projects}
          entries={selectedWeek.entries}
          status={selectedWeek.status}
          isAdmin={isAdmin}
          lastSaved={selectedWeek.updatedAt ? new Date(selectedWeek.updatedAt) : null}
          showSubmit={false}
          periodStart={new Date(startDate)}
          periodEnd={new Date(endDate)}
        />
      </div>
    </div>
  );
}
