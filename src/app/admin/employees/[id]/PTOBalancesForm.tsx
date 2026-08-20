"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";

const LEAVE_TYPES = [
  { type: "VACATION", label: "Vacation", hasTotal: true },
  { type: "SICK", label: "Sick", hasTotal: true },
  { type: "COMP_DAY", label: "Comp Day", hasTotal: true },
  { type: "PERSONAL", label: "Personal / Non-Paid Time", hasTotal: false },
  { type: "OTHER", label: "Other", hasTotal: false },
];

interface LeaveBalance {
  type: string;
  totalDays: number;
  usedDays: number;
}

interface PTOBalancesFormProps {
  employeeId: string;
  balances: LeaveBalance[];
}

export function PTOBalancesForm({ employeeId, balances }: PTOBalancesFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const year = new Date().getFullYear();

  const [totals, setTotals] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const lt of LEAVE_TYPES) {
      const existing = balances.find((b) => b.type === lt.type);
      initial[lt.type] = existing?.totalDays ?? 0;
    }
    return initial;
  });

  const [used, setUsed] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const lt of LEAVE_TYPES) {
      const existing = balances.find((b) => b.type === lt.type);
      initial[lt.type] = existing?.usedDays ?? 0;
    }
    return initial;
  });

  async function handleRenew() {
    setRenewing(true);
    setError("");
    setSuccess(false);
    try {
      const res = await fetch("/api/admin/renew-leave-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, year }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to renew");
      }
      setSuccess(true);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRenewing(false);
    }
  }

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
          balances: LEAVE_TYPES.map((lt) => ({
            type: lt.type,
            totalDays: lt.hasTotal ? totals[lt.type] : 0,
            usedDays: used[lt.type],
          })),
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

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {LEAVE_TYPES.map((lt) => (
          <div key={lt.type} className="space-y-1.5">
            <Label>{lt.label}</Label>
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

      <div className="flex items-center gap-2 flex-wrap">
        <Button type="submit" size="sm" disabled={loading || isPending}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save PTO Balances
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRenew}
          disabled={renewing || isPending}
          title={`Reset to new year allotment for ${year} based on years of service`}
        >
          {renewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Reset to {year} Allotment
        </Button>
      </div>
    </form>
  );
}
