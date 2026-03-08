"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn, formatDateShort, getWeekDays, isSameDay, DAYS_OF_WEEK } from "@/lib/utils";
import { Save, Send, Loader2 } from "lucide-react";

interface Project {
  id: string;
  name: string;
}

interface EntryData {
  projectId: string;
  date: string; // ISO date string
  hours: number;
  notes?: string | null;
}

interface TimesheetGridProps {
  timesheetId: string;
  weekStart: Date;
  projects: Project[];
  entries: EntryData[];
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  isAdmin?: boolean;
  lastSaved?: Date | null;
}

export function TimesheetGrid({
  timesheetId,
  weekStart,
  projects,
  entries,
  status,
  isAdmin = false,
  lastSaved,
}: TimesheetGridProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(lastSaved ?? null);
  const [error, setError] = useState("");

  const weekDays = getWeekDays(weekStart);
  const isReadOnly = status === "SUBMITTED" || status === "APPROVED" || (isAdmin && status !== "DRAFT");

  // Local state for grid edits
  const [localEntries, setLocalEntries] = useState<EntryData[]>(entries);

  function getHours(projectId: string, date: Date): number {
    const entry = localEntries.find(
      (e) => e.projectId === projectId && isSameDay(e.date, date)
    );
    return entry?.hours ?? 0;
  }

  function setHours(projectId: string, date: Date, value: string) {
    const hours = parseFloat(value) || 0;
    const dateStr = date.toISOString();
    setLocalEntries((prev) => {
      const exists = prev.find((e) => e.projectId === projectId && isSameDay(e.date, date));
      if (exists) {
        return prev.map((e) =>
          e.projectId === projectId && isSameDay(e.date, date) ? { ...e, hours } : e
        );
      }
      return [...prev, { projectId, date: dateStr, hours }];
    });
  }

  function getDayTotal(date: Date): number {
    return localEntries
      .filter((e) => isSameDay(e.date, date))
      .reduce((sum, e) => sum + e.hours, 0);
  }

  function getWeekTotal(): number {
    return localEntries.reduce((sum, e) => sum + e.hours, 0);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/timesheets/${timesheetId}/entries`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: localEntries }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSavedAt(new Date());
      startTransition(() => router.refresh());
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      // Save first
      const saveRes = await fetch(`/api/timesheets/${timesheetId}/entries`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: localEntries }),
      });
      if (!saveRes.ok) throw new Error("Save failed");

      // Then submit
      const submitRes = await fetch(`/api/timesheets/${timesheetId}/submit`, {
        method: "POST",
      });
      if (!submitRes.ok) throw new Error("Submit failed");

      startTransition(() => router.refresh());
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="text-left px-4 py-2.5 font-medium text-neutral-600 w-48">Project</th>
              {weekDays.map((day, i) => (
                <th key={i} className="text-center px-2 py-2.5 font-medium text-neutral-600 min-w-[60px]">
                  <div>{DAYS_OF_WEEK[i]}</div>
                  <div className="text-xs font-normal text-neutral-400">{formatDateShort(day)}</div>
                </th>
              ))}
              <th className="text-center px-3 py-2.5 font-medium text-neutral-600 bg-neutral-100">Total</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project, idx) => {
              const projectTotal = weekDays.reduce((sum, day) => sum + getHours(project.id, day), 0);
              return (
                <tr key={project.id} className={cn("border-b border-neutral-100", idx % 2 === 0 ? "bg-white" : "bg-neutral-50/50")}>
                  <td className="px-4 py-2 text-neutral-700 font-medium text-xs leading-tight">
                    {project.name}
                  </td>
                  {weekDays.map((day, i) => {
                    const val = getHours(project.id, day);
                    return (
                      <td key={i} className="px-1 py-1.5 text-center">
                        {isReadOnly ? (
                          <span className={cn("text-sm", val > 0 ? "text-neutral-800 font-medium" : "text-neutral-300")}>
                            {val > 0 ? val : "–"}
                          </span>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            max="24"
                            step="0.5"
                            value={val || ""}
                            onChange={(e) => setHours(project.id, day, e.target.value)}
                            placeholder="–"
                            className="w-12 text-center rounded border border-transparent bg-transparent py-1 text-sm text-neutral-800 placeholder-neutral-300 hover:border-neutral-200 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-300 transition-colors"
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center font-semibold text-neutral-700 bg-neutral-50 text-sm">
                    {projectTotal > 0 ? projectTotal : "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-neutral-100 border-t-2 border-neutral-200 font-semibold">
              <td className="px-4 py-2.5 text-sm text-neutral-700">Total / Day</td>
              {weekDays.map((day, i) => {
                const total = getDayTotal(day);
                return (
                  <td key={i} className={cn("text-center px-2 py-2.5 text-sm", total > 0 ? "text-neutral-800" : "text-neutral-400")}>
                    {total > 0 ? total : "–"}
                  </td>
                );
              })}
              <td className="text-center px-3 py-2.5 text-sm text-primary-600 bg-primary-50">
                {getWeekTotal()}h
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-xs text-neutral-400">
          {savedAt ? `Last saved ${savedAt.toLocaleTimeString()}` : "Not saved yet"}
          {error && <span className="ml-2 text-red-500">{error}</span>}
        </div>

        {!isReadOnly && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || submitting}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Draft
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving || submitting}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Submit for Approval
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
