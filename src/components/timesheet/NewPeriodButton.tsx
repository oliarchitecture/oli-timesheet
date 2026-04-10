"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CalendarPlus, Loader2 } from "lucide-react";

function computeEndDate(startValue: string): string {
  const d = new Date(startValue + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function nearestOccurrenceOfDay(day: number): string {
  const today = new Date();
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), day));
  if (d < today) d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

interface NewPeriodButtonProps {
  defaultPeriodStartDay?: number | null;
}

export function NewPeriodButton({ defaultPeriodStartDay }: NewPeriodButtonProps) {
  const router = useRouter();

  const todayIso = new Date().toISOString().slice(0, 10);
  const initialStart = defaultPeriodStartDay
    ? nearestOccurrenceOfDay(defaultPeriodStartDay)
    : todayIso;

  const [open, setOpen] = useState(false);
  const [startValue, setStartValue] = useState(initialStart);
  const [endValue, setEndValue] = useState(computeEndDate(initialStart));
  const [rememberDefault, setRememberDefault] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleStartChange(val: string) {
    setStartValue(val);
    if (val) setEndValue(computeEndDate(val));
    setError("");
  }

  async function handleCreate() {
    if (!startValue || !endValue) { setError("Please fill in both dates."); return; }
    const diffDays = (new Date(endValue).getTime() - new Date(startValue).getTime()) / 86400000;
    if (diffDays <= 7) { setError("End date must be more than 7 days after start."); return; }

    setSubmitting(true);
    setError("");
    try {
      if (rememberDefault) {
        const day = new Date(startValue + "T00:00:00Z").getUTCDate();
        await fetch("/api/profile/period-defaults", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ defaultPeriodStartDay: day }),
        });
      }

      const res = await fetch("/api/report-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: startValue + "T00:00:00Z",
          endDate: endValue + "T00:00:00Z",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create period");
      }

      const period = await res.json();
      setOpen(false);
      router.push(`/timesheets/period/${period.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <CalendarPlus className="h-4 w-4" />
          New Timesheet
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New Timesheet</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="np-start">Start</Label>
              <Input
                id="np-start"
                type="date"
                value={startValue}
                onChange={(e) => handleStartChange(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-end">
                End
                <span className="ml-1 text-[10px] font-normal text-neutral-400">auto</span>
              </Label>
              <Input
                id="np-end"
                type="date"
                value={endValue}
                onChange={(e) => { setEndValue(e.target.value); setError(""); }}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberDefault}
              onChange={(e) => setRememberDefault(e.target.checked)}
              className="rounded border-neutral-300"
            />
            <span className="text-sm text-neutral-600">Remember this start day</span>
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <Button className="w-full" onClick={handleCreate} disabled={submitting}>
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create Timesheet"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
