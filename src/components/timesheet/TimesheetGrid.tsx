"use client";

import { useState, useTransition, useImperativeHandle, forwardRef, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn, formatDateShort, getWeekDays, isSameDay, DAYS_OF_WEEK } from "@/lib/utils";
import { Save, Loader2, X, MessageSquare, ChevronUp, ChevronDown } from "lucide-react";
import { getFederalHolidays, isSameUTCDay } from "@/lib/holidays";

// ── Constants ────────────────────────────────────────────────────────────────

const PHASES = ["Pre-Design", "S/D", "D/D", "C/D", "C/A", "Interior Design", "ASR"];

const ABSENCE_CODES = ["H", "V", "S", "C", "B", "R", "H/D"] as const;
type AbsenceCode = typeof ABSENCE_CODES[number];

const ABSENCE_HOURS: Record<AbsenceCode, number> = {
  H: 8, V: 8, S: 8, C: 8, B: 8, R: 8, "H/D": 4,
};

const ABSENCE_LABEL: Record<AbsenceCode, string> = {
  H: "Holiday", V: "Vacation", S: "Sick Day", C: "Comp-time", B: "Business trip", R: "Bereavement", "H/D": "Half Day",
};

const ABSENCE_COLOR: Record<AbsenceCode, string> = {
  H:   "bg-orange-100 text-orange-700 border-orange-200",
  V:   "bg-sky-100 text-sky-700 border-sky-200",
  S:   "bg-blue-200 text-blue-800 border-blue-300",
  C:   "bg-rose-100 text-rose-700 border-rose-200",
  B:   "bg-lime-100 text-lime-700 border-lime-200",
  R:   "bg-amber-100 text-amber-800 border-amber-200",
  "H/D": "bg-purple-100 text-purple-700 border-purple-200",
};

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

interface ActiveRow { projectId: string; phase: string; }

interface TimesheetGridProps {
  timesheetId: string;
  weekStart: Date;
  projects: Project[];
  entries: EntryData[];
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "REVISION_REQUESTED";
  isAdmin?: boolean;
  lastSaved?: Date | null;
  showSubmit?: boolean;
  onSaved?: () => void;
  periodStart?: Date;
  periodEnd?: Date;
  officeAdminProjectId?: string | null;
  /** Ordered list of rows for this period (persisted). */
  rowOrder?: Array<{ projectId: string; phase: string }> | null;
  /** Template rows to use when this week has no entries yet. */
  templateRows?: Array<{ projectId: string; phase: string }>;
  /** Called whenever the row arrangement changes so the parent can persist it. */
  onRowOrderChange?: (rows: ActiveRow[]) => void;
  /** Called after a successful save with the entries that were saved. */
  onEntriesSaved?: (entries: EntryData[]) => void;
}

export interface TimesheetGridHandle {
  save: () => Promise<void>;
  isDirty: boolean;
}

function rowKey(r: ActiveRow) { return `${r.projectId}|${r.phase}`; }

// ── Cell input component ──────────────────────────────────────────────────────

function CellInput({
  hours,
  absenceCode,
  onChange,
  readOnly,
}: {
  hours: number;
  absenceCode: string | null | undefined;
  onChange: (hours: number, absenceCode: string | null) => void;
  readOnly: boolean;
}) {
  const code = absenceCode as AbsenceCode | null;

  if (readOnly) {
    if (code) {
      return (
        <span className={cn("inline-flex items-center justify-center w-9 h-7 rounded border text-xs font-bold", ABSENCE_COLOR[code])}>
          {code}
        </span>
      );
    }
    return (
      <span className={cn("text-sm", hours > 0 ? "text-neutral-800 font-medium" : "text-neutral-300")}>
        {hours > 0 ? hours : "–"}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <select
        value={code ?? ""}
        onChange={(e) => {
          const val = e.target.value as AbsenceCode | "";
          if (val === "") {
            onChange(hours, null);
          } else {
            onChange(ABSENCE_HOURS[val], val);
          }
        }}
        className={cn(
          "w-12 text-center rounded border py-0.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary-300 cursor-pointer",
          code ? cn(ABSENCE_COLOR[code], "border") : "border-neutral-200 bg-white text-neutral-400"
        )}
        title={code ? ABSENCE_LABEL[code] : "Select absence type"}
      >
        <option value="">–</option>
        {ABSENCE_CODES.map((c) => (
          <option key={c} value={c} title={ABSENCE_LABEL[c]}>{c}</option>
        ))}
      </select>

      {!code && (
        <input
          type="number"
          min="0"
          max="24"
          step="0.5"
          value={hours || ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0, null)}
          placeholder="h"
          className="w-12 text-center rounded border border-transparent bg-transparent py-0.5 text-sm text-neutral-800 placeholder-neutral-300 hover:border-neutral-200 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-300 transition-colors"
        />
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build initial rows from entries, optionally sorted by a saved rowOrder. */
function buildInitialRows(
  entries: EntryData[],
  templateRows: Array<{ projectId: string; phase: string }> | undefined,
  rowOrder: Array<{ projectId: string; phase: string }> | null | undefined,
  officeAdminProjectId: string | null | undefined
): ActiveRow[] {
  let rows: ActiveRow[] = [];

  if (entries.length > 0) {
    // Derive rows from existing entries
    for (const e of entries) {
      const key = `${e.projectId}|${e.phase}`;
      if (!rows.find((r) => rowKey(r) === key)) {
        rows.push({ projectId: e.projectId, phase: e.phase });
      }
    }
  } else if (templateRows && templateRows.length > 0) {
    // Use template from sibling week
    rows = templateRows.map((r) => ({ projectId: r.projectId, phase: r.phase }));
  } else if (officeAdminProjectId) {
    // Seed with Office Admin row as default
    rows = [{ projectId: officeAdminProjectId, phase: "" }];
  }

  // Sort by persisted rowOrder if available
  if (rowOrder && rowOrder.length > 0) {
    const orderMap = new Map(rowOrder.map((r, i) => [`${r.projectId}|${r.phase}`, i]));
    rows.sort((a, b) => {
      const ia = orderMap.get(rowKey(a)) ?? 9999;
      const ib = orderMap.get(rowKey(b)) ?? 9999;
      return ia - ib;
    });
  }

  // Ensure Office Admin is first if present
  if (officeAdminProjectId) {
    const oaIdx = rows.findIndex((r) => r.projectId === officeAdminProjectId);
    if (oaIdx > 0) {
      const [oa] = rows.splice(oaIdx, 1);
      rows.unshift(oa);
    }
  }

  return rows;
}

/** Build initial entries, pre-filling holidays on the Office Admin row if applicable. */
function buildInitialEntries(
  entries: EntryData[],
  weekStart: Date,
  officeAdminProjectId: string | null | undefined,
  hasOfficeAdminRow: boolean
): EntryData[] {
  if (!officeAdminProjectId || !hasOfficeAdminRow) return entries;

  const year = weekStart.getUTCFullYear();
  const holidays = getFederalHolidays(year);
  // Also check next year's New Year's in case week spans Dec 31 → Jan 1
  const nextYearHolidays = getFederalHolidays(year + 1);
  const allHolidays = [...holidays, ...nextYearHolidays];

  const weekDays = getWeekDays(weekStart);
  const result = [...entries];

  for (const day of weekDays) {
    const isHoliday = allHolidays.some((h) => isSameUTCDay(h.date, day));
    if (!isHoliday) continue;
    // Skip if any entry already exists for this date
    const alreadyCovered = entries.some((e) => isSameDay(e.date, day));
    if (alreadyCovered) continue;
    result.push({
      projectId: officeAdminProjectId,
      phase: "",
      date: day.toISOString(),
      hours: 8,
      absenceCode: "H",
    });
  }
  return result;
}

// ── Main component ────────────────────────────────────────────────────────────

export const TimesheetGrid = forwardRef<TimesheetGridHandle, TimesheetGridProps>(function TimesheetGrid({
  timesheetId,
  weekStart,
  projects,
  entries,
  status,
  isAdmin = false,
  lastSaved,
  showSubmit = true,
  onSaved,
  periodStart,
  periodEnd,
  officeAdminProjectId,
  rowOrder,
  templateRows,
  onRowOrderChange,
  onEntriesSaved,
}, ref) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [savedAt, setSavedAt] = useState<Date | null>(lastSaved ?? null);
  const [error, setError] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs so handleSave always reads the latest state even inside a stale debounce closure
  const localEntriesRef = useRef<EntryData[]>([]);
  const activeRowsRef = useRef<ActiveRow[]>([]);

  const weekDays = getWeekDays(weekStart);
  const isReadOnly = status === "SUBMITTED" || status === "APPROVED" || (isAdmin && status !== "DRAFT");

  function isBlocked(day: Date): boolean {
    if (periodStart && day.getTime() < periodStart.getTime()) return true;
    if (periodEnd && day.getTime() > periodEnd.getTime()) return true;
    return false;
  }

  // ── Row & entry state ──────────────────────────────────────────────────────

  const initialRows = buildInitialRows(entries, templateRows, rowOrder, officeAdminProjectId);
  const initialEntries = buildInitialEntries(entries, weekStart, officeAdminProjectId, initialRows.some((r) => r.projectId === officeAdminProjectId));

  const [activeRows, setActiveRows] = useState<ActiveRow[]>(initialRows);
  const [localEntries, setLocalEntries] = useState<EntryData[]>(initialEntries);

  // Keep refs in sync with latest state so debounced handleSave never reads stale closures
  localEntriesRef.current = localEntries;
  activeRowsRef.current = activeRows;
  const [addProjectId, setAddProjectId] = useState("");
  const [rowPhases, setRowPhases] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const r of initialRows) m[rowKey(r)] = r.phase;
    return m;
  });

  // ── Row notes state ────────────────────────────────────────────────────────

  const [notesOpen, setNotesOpen] = useState<Record<string, boolean>>({});
  const [rowNotes, setRowNotes] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const e of initialEntries) {
      const k = `${e.projectId}|${e.phase}`;
      if (e.notes && !m[k]) m[k] = e.notes;
    }
    return m;
  });

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const availableToAdd = projects.filter(
    (p) => !activeRows.find((r) => r.projectId === p.id && r.phase === "")
  );

  function addRow(projectId: string) {
    if (!projectId) return;
    const newRow: ActiveRow = { projectId, phase: "" };
    const newRows = [...activeRows, newRow];
    setActiveRows(newRows);
    setAddProjectId("");
    onRowOrderChange?.(newRows);
  }

  function removeRow(key: string) {
    const row = activeRows.find((r) => rowKey(r) === key);
    if (!row) return;
    const newRows = activeRows.filter((r) => rowKey(r) !== key);
    setActiveRows(newRows);
    setLocalEntries((prev) => prev.filter((e) => !(e.projectId === row.projectId && e.phase === row.phase)));
    onRowOrderChange?.(newRows);
  }

  function moveRowUp(key: string) {
    const idx = activeRows.findIndex((r) => rowKey(r) === key);
    if (idx <= 0) return;
    const newRows = [...activeRows];
    [newRows[idx - 1], newRows[idx]] = [newRows[idx], newRows[idx - 1]];
    setActiveRows(newRows);
    onRowOrderChange?.(newRows);
  }

  function moveRowDown(key: string) {
    const idx = activeRows.findIndex((r) => rowKey(r) === key);
    if (idx < 0 || idx >= activeRows.length - 1) return;
    const newRows = [...activeRows];
    [newRows[idx], newRows[idx + 1]] = [newRows[idx + 1], newRows[idx]];
    setActiveRows(newRows);
    onRowOrderChange?.(newRows);
  }

  function updateRowPhase(oldKey: string, newPhase: string) {
    const row = activeRows.find((r) => rowKey(r) === oldKey);
    if (!row) return;
    setLocalEntries((prev) =>
      prev.map((e) =>
        e.projectId === row.projectId && e.phase === row.phase ? { ...e, phase: newPhase } : e
      )
    );
    setActiveRows((prev) =>
      prev.map((r) => rowKey(r) === oldKey ? { ...r, phase: newPhase } : r)
    );
    setIsDirty(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setAutoSaving(true);
      handleSave().finally(() => setAutoSaving(false));
    }, 1500);
  }

  function getCellValue(projectId: string, phase: string, date: Date) {
    return localEntries.find(
      (e) => e.projectId === projectId && e.phase === phase && isSameDay(e.date, date)
    );
  }

  function setCellValue(projectId: string, phase: string, date: Date, hours: number, absenceCode: string | null) {
    const dateStr = date.toISOString();
    setIsDirty(true);
    setLocalEntries((prev) => {
      const exists = prev.find((e) => e.projectId === projectId && e.phase === phase && isSameDay(e.date, date));
      if (exists) {
        return prev.map((e) =>
          e.projectId === projectId && e.phase === phase && isSameDay(e.date, date)
            ? { ...e, hours, absenceCode }
            : e
        );
      }
      return [...prev, { projectId, phase, date: dateStr, hours, absenceCode }];
    });

    // Debounced auto-save (#3)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setAutoSaving(true);
      handleSave({ refresh: false }).finally(() => setAutoSaving(false));
    }, 1500);
  }

  function updateRowNotes(key: string, row: ActiveRow, value: string) {
    setRowNotes((prev) => ({ ...prev, [key]: value }));
    setLocalEntries((prev) =>
      prev.map((e) =>
        e.projectId === row.projectId && e.phase === row.phase ? { ...e, notes: value } : e
      )
    );
    setIsDirty(true);

    // Debounced auto-save
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setAutoSaving(true);
      handleSave({ refresh: false }).finally(() => setAutoSaving(false));
    }, 1500);
  }

  function getRowHours(projectId: string, phase: string, date: Date) {
    return getCellValue(projectId, phase, date)?.hours ?? 0;
  }

  function getRowTotal(projectId: string, phase: string) {
    return weekDays.reduce((sum, day) => sum + getRowHours(projectId, phase, day), 0);
  }

  function getDayTotal(date: Date) {
    return activeRows.reduce((sum, row) => sum + getRowHours(row.projectId, row.phase, date), 0);
  }

  function getWeekTotal() {
    return activeRows.reduce((sum, row) => sum + getRowTotal(row.projectId, row.phase), 0);
  }

  async function handleSave({ refresh = false }: { refresh?: boolean } = {}) {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setSaving(true);
    setError("");
    try {
      // Use refs so we always send the latest data regardless of when this closure was captured
      const entriesToSave = localEntriesRef.current.filter((e) =>
        activeRowsRef.current.find((r) => r.projectId === e.projectId && r.phase === e.phase)
      );
      const res = await fetch(`/api/timesheets/${timesheetId}/entries`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: entriesToSave }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSavedAt(new Date());
      setIsDirty(false);
      onSaved?.();
      onEntriesSaved?.(entriesToSave);
      if (refresh) {
        startTransition(() => router.refresh());
      }
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
      isSavingRef.current = false;
    }
  }

  useImperativeHandle(ref, () => ({
    isDirty,
    save: () => handleSave({ refresh: true }),
  }));

  const totalCols = 2 + weekDays.length + 1 + (!isReadOnly ? 2 : 0); // project, phase, days, total, (notes icon col, reorder+delete col)

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {ABSENCE_CODES.map((c) => (
          <span key={c} className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded border font-medium", ABSENCE_COLOR[c])}>
            <span className="font-bold">{c}</span>
            <span className="font-normal opacity-70">= {ABSENCE_LABEL[c]}</span>
          </span>
        ))}
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-100 border-b border-neutral-200">
              <th className="text-left px-3 py-3 font-semibold text-neutral-600 w-48">Project</th>
              <th className="text-left px-2 py-3 font-semibold text-neutral-600 w-36">Phase</th>
              {weekDays.map((day, i) => {
                const blocked = isBlocked(day);
                return (
                  <th key={i} className={cn("text-center px-1 py-3 font-semibold min-w-[68px]", blocked ? "bg-neutral-50 text-neutral-300" : "text-neutral-600")}>
                    <div>{DAYS_OF_WEEK[i]}</div>
                    <div className="text-xs font-normal mt-0.5">{formatDateShort(day)}</div>
                  </th>
                );
              })}
              <th className="text-center px-2 py-3 font-semibold text-neutral-600 bg-neutral-200 min-w-[52px]">Total</th>
              {!isReadOnly && <th className="w-8" title="Notes" />}
              {!isReadOnly && <th className="w-16" />}
            </tr>
          </thead>
          <tbody>
            {activeRows.length === 0 && (
              <tr>
                <td colSpan={totalCols} className="text-center py-10 text-neutral-400 text-sm">
                  No projects added yet. Use the dropdown below to add a project row.
                </td>
              </tr>
            )}
            {activeRows.map((row, idx) => {
              const key = rowKey(row);
              const project = projects.find((p) => p.id === row.projectId);

              return (
                <tr key={key} className={cn("border-b border-neutral-100", idx % 2 === 0 ? "bg-white" : "bg-neutral-50/40")}>
                  {/* Project name */}
                  <td className="px-3 py-2 text-neutral-900 font-semibold text-sm leading-snug max-w-[192px]">
                    <div className="flex flex-col gap-0.5">
                      <span title={project?.name} className="block truncate">{project?.name ?? "—"}</span>
                      {notesOpen[key] && !isReadOnly && (
                        <textarea
                          value={rowNotes[key] ?? ""}
                          onChange={(e) => updateRowNotes(key, row, e.target.value)}
                          placeholder="Add a note…"
                          rows={2}
                          className="mt-1 w-full rounded border border-neutral-200 px-2 py-1 text-xs font-normal resize-none focus:outline-none focus:ring-1 focus:ring-primary-300"
                        />
                      )}
                      {isReadOnly && rowNotes[key] && (
                        <span className="text-xs font-normal text-neutral-400 truncate">{rowNotes[key]}</span>
                      )}
                    </div>
                  </td>

                  {/* Phase dropdown */}
                  <td className="px-2 py-1.5">
                    {isReadOnly ? (
                      <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                        {row.phase || "—"}
                      </span>
                    ) : (
                      <select
                        value={row.phase}
                        onChange={(e) => updateRowPhase(key, e.target.value)}
                        className="w-full rounded border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-300"
                      >
                        <option value="">Select phase...</option>
                        {PHASES.map((ph) => (
                          <option key={ph} value={ph}>{ph}</option>
                        ))}
                      </select>
                    )}
                  </td>

                  {/* Day cells */}
                  {weekDays.map((day, i) => {
                    if (isBlocked(day)) {
                      return <td key={i} className="bg-neutral-50/80 border-x border-neutral-100" />;
                    }
                    const cell = getCellValue(row.projectId, row.phase, day);
                    return (
                      <td key={i} className="px-1 py-1.5 text-center">
                        <CellInput
                          hours={cell?.hours ?? 0}
                          absenceCode={cell?.absenceCode}
                          readOnly={isReadOnly}
                          onChange={(h, ac) => setCellValue(row.projectId, row.phase, day, h, ac)}
                        />
                      </td>
                    );
                  })}

                  {/* Row total */}
                  <td className="px-2 py-2 text-center font-semibold text-neutral-700 bg-neutral-50 text-sm">
                    {getRowTotal(row.projectId, row.phase) > 0 ? getRowTotal(row.projectId, row.phase) : "–"}
                  </td>

                  {/* Notes toggle */}
                  {!isReadOnly && (
                    <td className="px-1 text-center">
                      <button
                        onClick={() => setNotesOpen((prev) => ({ ...prev, [key]: !prev[key] }))}
                        className={cn(
                          "p-1 rounded transition-colors",
                          rowNotes[key]
                            ? "text-primary-500 hover:text-primary-700"
                            : "text-neutral-300 hover:text-neutral-500"
                        )}
                        title={rowNotes[key] ? "Edit note" : "Add note"}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}

                  {/* Reorder + Delete */}
                  {!isReadOnly && (
                    <td className="px-1 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          onClick={() => moveRowUp(key)}
                          disabled={idx === 0}
                          className="p-0.5 text-neutral-300 hover:text-neutral-600 disabled:opacity-20 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => moveRowDown(key)}
                          disabled={idx === activeRows.length - 1}
                          className="p-0.5 text-neutral-300 hover:text-neutral-600 disabled:opacity-20 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => removeRow(key)}
                          className="p-0.5 text-neutral-300 hover:text-red-400 transition-colors"
                          title="Remove row"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-neutral-100 border-t-2 border-neutral-200 font-semibold">
              <td colSpan={2} className="px-3 py-2.5 text-sm text-neutral-700">Total / Day</td>
              {weekDays.map((day, i) => {
                if (isBlocked(day)) {
                  return <td key={i} className="bg-neutral-50/80" />;
                }
                const total = getDayTotal(day);
                return (
                  <td key={i} className={cn("text-center px-1 py-2.5 text-sm", total > 0 ? "text-neutral-800" : "text-neutral-400")}>
                    {total > 0 ? total : "–"}
                  </td>
                );
              })}
              <td className="text-center px-2 py-2.5 text-sm font-bold text-primary-600 bg-primary-50">
                {getWeekTotal()}h
              </td>
              {!isReadOnly && <td colSpan={2} />}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Add project row */}
      {!isReadOnly && (
        <div className="flex items-center gap-2">
          <select
            value={addProjectId}
            onChange={(e) => addRow(e.target.value)}
            className="flex-1 max-w-xs rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-300"
          >
            <option value="">+ Add a project row...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <span className="text-xs text-neutral-400">Select project, then choose phase in the row</span>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-xs text-neutral-400 flex items-center gap-1.5">
          {autoSaving ? (
            <><Loader2 className="h-3 w-3 animate-spin" /><span>Saving…</span></>
          ) : savedAt ? (
            <span>Last saved {savedAt.toLocaleTimeString()}</span>
          ) : (
            <span>Not saved yet</span>
          )}
          {error && <span className="ml-2 text-red-500">{error}</span>}
        </div>

        {!isReadOnly && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleSave({ refresh: true })} disabled={saving || autoSaving || isPending}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Draft
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});
