"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

/** Admin's answer to an employee saying they worked a day of their approved PTO. */
export function DayRemovalActions({ dayId }: { dayId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const [error, setError] = useState("");

  async function decide(decision: "approve" | "decline") {
    setBusy(decision);
    setError("");
    try {
      const res = await fetch(`/api/leave/days/${dayId}/removal`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't save. Please try again.");
      if (data.requestDeleted) {
        router.push("/admin/leave");
      } else {
        startTransition(() => router.refresh());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-amber-800">Employee says they worked this day</p>
      <div className="flex gap-1.5">
        <Button type="button" size="sm" className="h-7 px-2 text-xs" disabled={!!busy || isPending} onClick={() => decide("approve")}>
          {busy === "approve" && <Loader2 className="h-3 w-3 animate-spin" />}
          Remove from PTO
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={!!busy || isPending} onClick={() => decide("decline")}>
          {busy === "decline" && <Loader2 className="h-3 w-3 animate-spin" />}
          Keep
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
