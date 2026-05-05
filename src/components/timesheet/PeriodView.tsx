"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TimesheetGrid, TimesheetGridHandle } from "./TimesheetGrid";
import { Badge } from "@/components/ui/badge";
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

type PeriodStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "REVISION_REQUESTED";

interface WeekData {
  id: string;
  weekStartDate: string;
  status: PeriodStatus;
  updatedAt: string;
  entries: EntryData[];
}

interface PeriodViewProps {
  periodId: string;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  reviewComment?: string | null;
  weeks: WeekData[];
  projects: Project[];
  isAdmin?: boolean;
  officeAdminProjectId?: string | null;
  rowOrder?: Array<{ projectId: string; phase: string }> | null;
}

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  DRAFT: "secondary",
  SUBMITTED: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  REVISION_REQUESTED: "warning",
};

const statusLabel: Record<string, string> = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  REVISION_REQUESTED: "Revision Requested",
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
  reviewComment,
  weeks,
  projects,
  isAdmin = false,
  officeAdminProjectId,
  rowOrder,
}: PeriodViewProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const gridRef = useRef<TimesheetGridHandle>(null);

  // Local cache of entries per week — updated when TimesheetGrid saves successfully.
  // This prevents data loss when switching weeks (TimesheetGrid remounts via key=weekId
  // and would otherwise reinitialise from the stale server-side entries prop).
  const [weekEntriesCache, setWeekEntriesCache] = useState<Record<string, EntryData[]>>(
    () => Object.fromEntries(weeks.map((w) => [w.id, w.entries]))
  );

  const selectedWeek = weeks[selectedIndex] ?? weeks[0];

  // #11 — only allow submit after period end date has passed
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const periodEndDate = new Date(endDate);
  periodEndDate.setUTCHours(0, 0, 0, 0);
  const canSubmitNow = status === "DRAFT" && !isAdmin && periodEndDate <= today;

  if (!selectedWeek) {
    return <p className="text-sm text-neutral-500 py-8 text-center">No weeks found for this timesheet.</p>;
  }

  async function switchWeek(newIndex: number) {
    if (newIndex === selectedIndex) return;

    // Save current week if dirty (this also calls router.refresh)
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
              <Badge variant={statusVariant[status] ?? "secondary"}>
                {statusLabel[status] ?? status}
              </Badge>
            </div>
            <p className="text-sm text-neutral-500">{weeks.length} week{weeks.length !== 1 ? "s" : ""}</p>
          </div>

          {status === "DRAFT" && !isAdmin && (
            <div className="flex flex-col items-end gap-1">
              {canSubmitNow ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={submitting}>
                      {submitting ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
                      ) : (
                        <><Send className="h-4 w-4" /> Submit Timesheet</>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Submit timesheet?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Once submitted, you will not be able to edit this timesheet until it is returned for revision. Make sure all entries are complete.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSubmitPeriod} disabled={submitting}>
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                        Confirm Submit
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button
                  disabled
                  title={`Period ends ${formatDateShort(periodEndDate)}. Submit after the period closes.`}
                >
                  <Send className="h-4 w-4" /> Submit Timesheet
                </Button>
              )}
              {!canSubmitNow && (
                <p className="text-xs text-neutral-400">
                  Available after {formatDateShort(periodEndDate)}
                </p>
              )}
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          )}
        </div>

        {(status === "REVISION_REQUESTED" || status === "REJECTED") && reviewComment && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="font-medium">
              {status === "REVISION_REQUESTED" ? "Revision requested: " : "Rejected: "}
            </span>
            {reviewComment}
          </div>
        )}
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
                  week.status === "APPROVED" ? "bg-green-400" :
                  week.status === "REVISION_REQUESTED" ? "bg-amber-400" : "bg-red-400"
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
          entries={weekEntriesCache[selectedWeek.id] ?? selectedWeek.entries}
          status={selectedWeek.status}
          onEntriesSaved={(saved) =>
            setWeekEntriesCache((prev) => ({ ...prev, [selectedWeek.id]: saved }))
          }
          isAdmin={isAdmin}
          lastSaved={selectedWeek.updatedAt ? new Date(selectedWeek.updatedAt) : null}
          showSubmit={false}
          periodStart={new Date(startDate)}
          periodEnd={new Date(endDate)}
          officeAdminProjectId={officeAdminProjectId}
          rowOrder={rowOrder}
          templateRows={
            (weekEntriesCache[selectedWeek.id] ?? selectedWeek.entries).length === 0
              ? (() => {
                  const seen = new Set<string>();
                  const rows: Array<{ projectId: string; phase: string }> = [];
                  // Look through cached entries from sibling weeks first, fall back to server entries
                  for (const w of weeks.filter((w) => w.id !== selectedWeek.id)) {
                    const wEntries = weekEntriesCache[w.id] ?? w.entries;
                    for (const e of wEntries) {
                      if (!seen.has(e.projectId)) {
                        seen.add(e.projectId);
                        rows.push({ projectId: e.projectId, phase: "" });
                      }
                    }
                  }
                  return rows;
                })()
              : undefined
          }
          onRowOrderChange={(newOrder) => {
            if (!periodId) return;
            fetch(`/api/report-periods/${periodId}/row-order`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rowOrder: newOrder }),
            }).catch(() => {});
          }}
        />
      </div>
    </div>
  );
}
