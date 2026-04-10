"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CalendarRange } from "lucide-react";

interface PeriodSetupFormProps {
  defaultPeriodStartDay?: number | null;
}

/** endDate = startDate + 1 month - 1 day */
function computeEndDate(start: Date): Date {
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return end;
}

/** Format a UTC date as YYYY-MM-DD for <input type="date"> */
function toInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Compute the nearest future (or today) occurrence of a given day-of-month */
function nearestOccurrenceOfDay(day: number): Date {
  const today = new Date();
  const candidate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), day));
  if (candidate < today) {
    candidate.setUTCMonth(candidate.getUTCMonth() + 1);
  }
  return candidate;
}

export function PeriodSetupForm({ defaultPeriodStartDay }: PeriodSetupFormProps) {
  const router = useRouter();

  const initialStart = defaultPeriodStartDay
    ? nearestOccurrenceOfDay(defaultPeriodStartDay)
    : (() => {
        const today = new Date();
        return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
      })();

  const [startValue, setStartValue] = useState(toInputValue(initialStart));
  const [endValue, setEndValue] = useState(toInputValue(computeEndDate(initialStart)));
  const [rememberDefault, setRememberDefault] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleStartChange(val: string) {
    setStartValue(val);
    if (val) {
      const s = new Date(val + "T00:00:00Z");
      setEndValue(toInputValue(computeEndDate(s)));
    }
    setError("");
  }

  function validateDates(): string | null {
    if (!startValue || !endValue) return "Please select both dates.";
    const s = new Date(startValue + "T00:00:00Z");
    const e = new Date(endValue + "T00:00:00Z");
    const diffDays = (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 7) return "End date must be more than 7 days after start date.";
    return null;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const validationError = validateDates();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // Optionally save default start day
      if (rememberDefault && startValue) {
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
      router.push(`/timesheets/period/${period.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
      <div className="flex items-center gap-2 mb-2">
        <CalendarRange className="h-5 w-5 text-primary-500" />
        <h3 className="text-base font-semibold text-neutral-800">Set Reporting Period</h3>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="start-date">Start date</Label>
          <Input
            id="start-date"
            type="date"
            value={startValue}
            onChange={(e) => handleStartChange(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="end-date">
            End date
            <span className="ml-1.5 text-xs font-normal text-neutral-400">(auto-set, editable)</span>
          </Label>
          <Input
            id="end-date"
            type="date"
            value={endValue}
            onChange={(e) => {
              setEndValue(e.target.value);
              setError("");
            }}
            required
          />
          <p className="text-xs text-neutral-400">Must be more than 7 days after start date.</p>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rememberDefault}
            onChange={(e) => setRememberDefault(e.target.checked)}
            className="rounded border-neutral-300 text-primary-500 focus:ring-primary-300"
          />
          <span className="text-sm text-neutral-600">
            Remember this start day for next period
          </span>
        </label>
        {rememberDefault && startValue && (
          <p className="text-xs text-neutral-400 -mt-2 ml-6">
            Next period will default to starting on day {new Date(startValue + "T00:00:00Z").getUTCDate()} of the month.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating period…
          </>
        ) : (
          "Create Reporting Period"
        )}
      </Button>
    </form>
  );
}
