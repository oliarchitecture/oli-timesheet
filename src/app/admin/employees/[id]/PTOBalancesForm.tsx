"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";

// Vacation, Sick and Comp Day run on the work year; these two stay on the yearly balance row.
const YEARLY_TYPES = [
  { type: "PERSONAL", label: "Personal / Non-Paid Time", hasTotal: false },
  { type: "OTHER", label: "Other", hasTotal: false },
];

interface LeaveBalance {
  type: string;
  totalDays: number;
  usedDays: number;
}

/** A Vacation or Sick line for the current work year (see getPtoSummary). */
export interface WorkYearLine {
  total: number;
  used: number;
  autoTotal: number;
  autoUsed: number;
}

interface PTOBalancesFormProps {
  employeeId: string;
  balances: LeaveBalance[];
  /** Null when the employee has no start date, so there is no work year. */
  workYear: { cycleStart: string; label: string; vacation: WorkYearLine; sick: WorkYearLine; comp: WorkYearLine } | null;
}

type Field = "vacationTotal" | "vacationUsed" | "sickTotal" | "sickUsed" | "compTotal" | "compUsed";

export function PTOBalancesForm({ employeeId, balances, workYear }: PTOBalancesFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const year = new Date().getFullYear();

  const auto: Record<Field, number> = {
    vacationTotal: workYear?.vacation.autoTotal ?? 0,
    vacationUsed: workYear?.vacation.autoUsed ?? 0,
    sickTotal: workYear?.sick.autoTotal ?? 0,
    sickUsed: workYear?.sick.autoUsed ?? 0,
    compTotal: workYear?.comp.autoTotal ?? 0,
    compUsed: workYear?.comp.autoUsed ?? 0,
  };
  const [workYearValues, setWorkYearValues] = useState<Record<Field, number>>({
    vacationTotal: workYear?.vacation.total ?? 0,
    vacationUsed: workYear?.vacation.used ?? 0,
    sickTotal: workYear?.sick.total ?? 0,
    sickUsed: workYear?.sick.used ?? 0,
    compTotal: workYear?.comp.total ?? 0,
    compUsed: workYear?.comp.used ?? 0,
  });

  const [totals, setTotals] = useState<Record<string, number>>(() =>
    Object.fromEntries(YEARLY_TYPES.map((lt) => [lt.type, balances.find((b) => b.type === lt.type)?.totalDays ?? 0]))
  );
  const [used, setUsed] = useState<Record<string, number>>(() =>
    Object.fromEntries(YEARLY_TYPES.map((lt) => [lt.type, balances.find((b) => b.type === lt.type)?.usedDays ?? 0]))
  );

  /** A value the admin left at the automatic number is saved as "automatic", so it keeps following the formula. */
  const overrideOf = (f: Field) => (workYearValues[f] === auto[f] ? null : workYearValues[f]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch(`/api/employees/${employeeId}/pto`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          balances: YEARLY_TYPES.map((lt) => ({
            type: lt.type,
            totalDays: lt.hasTotal ? totals[lt.type] : 0,
            usedDays: used[lt.type],
          })),
          workYear: workYear && {
            cycleStart: workYear.cycleStart,
            lines: [
              { type: "VACATION", totalDays: overrideOf("vacationTotal"), usedDays: overrideOf("vacationUsed") },
              { type: "SICK", totalDays: overrideOf("sickTotal"), usedDays: overrideOf("sickUsed") },
              { type: "COMP_DAY", totalDays: overrideOf("compTotal"), usedDays: overrideOf("compUsed") },
            ],
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }

      setSuccess(true);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // A plain render function, not a component, so the inputs keep focus while typing.
  function workYearInput(field: Field, label: string) {
    const isManual = workYearValues[field] !== auto[field];
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <Input
            id={`pto-${field}`}
            type="number"
            min="0"
            max="365"
            step="0.5"
            value={workYearValues[field]}
            onChange={(e) => setWorkYearValues((prev) => ({ ...prev, [field]: parseFloat(e.target.value) || 0 }))}
            className="w-20"
          />
          <span className="text-xs text-neutral-500">{label}</span>
        </div>
        {isManual ? (
          <button
            type="button"
            onClick={() => setWorkYearValues((prev) => ({ ...prev, [field]: auto[field] }))}
            className="text-left text-[11px] text-amber-700 hover:underline"
          >
            Set by admin · use automatic ({auto[field]})
          </button>
        ) : (
          <span className="text-[11px] text-neutral-400">Automatic</span>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {workYear ? (
        <div className="space-y-3">
          <p className="text-xs text-neutral-500">
            Work year {workYear.label}. Renews automatically on the start-date anniversary. Vacation and Sick totals
            follow the OLI policy, Comp Day starts at 0 for you to grant, and used days count approved PTO requests,
            unless you change them here.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Vacation</Label>
              <div className="flex items-start gap-3">
                {workYearInput("vacationTotal", "total")}
                {workYearInput("vacationUsed", "used")}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Sick</Label>
              <div className="flex items-start gap-3">
                {workYearInput("sickTotal", "total")}
                {workYearInput("sickUsed", "used")}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Comp Day</Label>
              <div className="flex items-start gap-3">
                {workYearInput("compTotal", "total")}
                {workYearInput("compUsed", "used")}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-neutral-500">Add a start date above to track Vacation and Sick by work year.</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        {YEARLY_TYPES.map((lt) => (
          <div key={lt.type} className="space-y-1.5">
            <Label>{lt.label} ({year})</Label>
            <div className="flex items-center gap-3">
              {lt.hasTotal && (
                <div className="flex items-center gap-1.5">
                  <Input
                    id={`pto-total-${lt.type}`}
                    type="number"
                    min="0"
                    max="365"
                    step="0.5"
                    value={totals[lt.type]}
                    onChange={(e) => setTotals((prev) => ({ ...prev, [lt.type]: parseFloat(e.target.value) || 0 }))}
                    className="w-20"
                  />
                  <span className="text-xs text-neutral-500">total</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Input
                  id={`pto-used-${lt.type}`}
                  type="number"
                  min="0"
                  max="365"
                  step="0.5"
                  value={used[lt.type]}
                  onChange={(e) => setUsed((prev) => ({ ...prev, [lt.type]: parseFloat(e.target.value) || 0 }))}
                  className="w-20"
                />
                <span className="text-xs text-neutral-500">used</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">PTO balances saved successfully.</p>}

      <Button type="submit" size="sm" disabled={loading || isPending}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Save PTO Balances
      </Button>
    </form>
  );
}
