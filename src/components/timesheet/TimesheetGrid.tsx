"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn, formatDateShort, getWeekDays, isSameDay, DAYS_OF_WEEK } from "@/lib/utils";
import { Save, Send, Loader2, Plus, X } from "lucide-react";

interface Project {
  id: string;
  name: string;
}

interface EntryData {
  projectId: string;
  date: string;
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

  // Which projects are currently shown as rows (derived from entries + manually added)
  const projectIdsFromEntries = [...new Set(entries.map((e) => e.projectId))];
  const [activeProjectIds, setActiveProjectIds] = useState<string[]>(projectIdsFromEntries);
  const [localEntries, setLocalEntries] = useState<EntryData[]>(entries);
  const [selectValue, setSelectValue] = useState("");

  const activeProjects = activeProjectIds
    .map((id) => projects.find((p) => p.id === id))
    .filter(Boolean) as Project[];

  const availableToAdd = projects.filter((p) => !activeProjectIds.includes(p.id));

  function addProject(projectId: string) {
    if (!projectId || activeProjectIds.includes(projectId)) return;
    setActiveProjectIds((prev) => [...prev, projectId]);
    setSelectValue("");
  }

  function removeProject(projectId: string) {
    setActiveProjectIds((prev) => prev.filter((id) => id !== projectId));
    setLocalEntries((prev) => prev.filter((e) => e.projectId !== projectId));
  }

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
      .filter((e) => activeProjectIds.includes(e.projectId) && isSameDay(e.date, date))
      .reduce((sum, e) => sum + e.hours, 0);
  }

  function getWeekTotal(): number {
    return localEntries
      .filter((e) => activeProjectIds.includes(e.projectId))
      .reduce((sum, e) => sum + e.hours, 0);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const entriesToSave = localEntries.filter((e) => activeProjectIds.includes(e.projectId));
      const res = await fetch(`/api/timesheets/${timesheetId}/entries`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: entriesToSave }),
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
      const entriesToSave = localEntries.filter((e) => activeProjectIds.includes(e.projectId));
      const saveRes = await fetch(`/api/timesheets/${timesheetId}/entries`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: entriesToSave }),
      });
      if (!saveRes.ok) throw new Error("Save failed");

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
            <tr className="bg-neutral-100 border-b border-neutral-200">
              <th className="text-left px-4 py-3 font-semibold text-neutral-600 w-56">Project</th>
              {weekDays.map((day, i) => (
                <th key={i} className="text-center px-2 py-3 font-semibold text-neutral-600 min-w-[64px]">
                  <div>{DAYS_OF_WEEK[i]}</div>
                  <div className="text-xs font-normal text-neutral-400 mt-0.5">{formatDateShort(day)}</div>
                </th>
              ))}
              <th className="text-center px-3 py-3 font-semibold text-neutral-600 bg-neutral-200 min-w-[56px]">Total</th>
              {!isReadOnly && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {activeProjects.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-10 text-neutral-400 text-sm">
                  No projects added yet. Use the dropdown below to add a project.
                </td>
              </tr>
            )}
            {activeProjects.map((project, idx) => {
              const projectTotal = weekDays.reduce((sum, day) => sum + getHours(project.id, day), 0);
              const hasHours = weekDays.some((day) => getHours(project.id, day) > 0);
              return (
                <tr key={project.id} className={cn("border-b border-neutral-100", idx % 2 === 0 ? "bg-white" : "bg-neutral-50/40")}>
                  <td className="px-4 py-2 text-neutral-700 font-medium text-xs leading-snug max-w-[224px]">
                    <span title={project.name} className="block truncate">{project.name}</span>
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
                            className="w-14 text-center rounded border border-transparent bg-transparent py-1 text-sm text-neutral-800 placeholder-neutral-300 hover:border-neutral-200 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-300 transition-colors"
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center font-semibold text-neutral-700 bg-neutral-50 text-sm">
                    {projectTotal > 0 ? projectTotal : "–"}
                  </td>
                  {!isReadOnly && (
                    <td className="px-1 text-center">
                      {!hasHours && (
                        <button
                          onClick={() => removeProject(project.id)}
                          className="text-neutral-300 hover:text-red-400 transition-colors p-1 rounded"
                          title="Remove project"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  )}
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
              <td className="text-center px-3 py-2.5 text-sm font-bold text-primary-600 bg-primary-50">
                {getWeekTotal()}h
              </td>
              {!isReadOnly && <td />}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Add project row */}
      {!isReadOnly && availableToAdd.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectValue}
            onChange={(e) => addProject(e.target.value)}
            className="flex-1 max-w-xs rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-300"
          >
            <option value="">+ Add a project...</option>
            {availableToAdd.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-xs text-neutral-400">
          {savedAt ? `Last saved ${savedAt.toLocaleTimeString()}` : "Not saved yet"}
          {error && <span className="ml-2 text-red-500">{error}</span>}
        </div>

        {!isReadOnly && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || submitting || isPending}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Draft
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving || submitting || isPending || activeProjects.length === 0}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Submit for Approval
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
