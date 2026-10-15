"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/** Lets an employee say they worked a day of their approved PTO; an admin then approves taking it off. */
export function WorkedDayButton({ dayId }: { dayId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/leave/days/${dayId}/removal`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Couldn't send. Please try again.");
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={send}
        disabled={sending || isPending}
        className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"
      >
        {(sending || isPending) && <Loader2 className="h-3 w-3 animate-spin" />}
        I worked this day
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
