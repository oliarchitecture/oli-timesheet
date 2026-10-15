"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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

/**
 * Lets an employee report they worked a day of their approved PTO. The approved request is
 * not changed: a note is added, the day stops counting, and admins are emailed.
 */
export function WorkedDayButton({ dayId }: { dayId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/leave/days/${dayId}/worked`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Couldn't save. Please try again.");
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            disabled={sending || isPending}
            className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"
          >
            {(sending || isPending) && <Loader2 className="h-3 w-3 animate-spin" />}
            I worked this day
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Report this day as worked?</AlertDialogTitle>
            <AlertDialogDescription>
              Your approved request stays as it is. A note is added to it, this day stops counting against your
              balance, and your admin is notified. Only an admin can undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={send}>I worked this day</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
