"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Check, RotateCcw, X, Loader2 } from "lucide-react";

interface ReviewActionsProps {
  timesheetId: string;
  status: "SUBMITTED" | "APPROVED" | "REJECTED";
}

export function ReviewActions({ timesheetId, status }: ReviewActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [action, setAction] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAction(newStatus: "APPROVED" | "REJECTED") {
    if (newStatus !== "APPROVED") {
      setAction(newStatus);
      setDialogOpen(true);
      return;
    }
    await submitReview("APPROVED", "");
  }

  async function submitReview(newStatus: "APPROVED" | "REJECTED", reviewComment: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/timesheets/${timesheetId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, comment: reviewComment }),
      });
      if (!res.ok) throw new Error("Review failed");
      setDialogOpen(false);
      startTransition(() => router.refresh());
    } catch {
      setError("Action failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (status === "APPROVED" || status === "REJECTED") {
    return (
      <div className="text-sm text-neutral-500">
        This timesheet has already been {status.toLowerCase()}.
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-2">
        <Button
          variant="success"
          size="sm"
          onClick={() => handleAction("APPROVED")}
          disabled={loading || isPending}
        >
          {loading && action === null ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Approve
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => handleAction("REJECTED")}
          disabled={loading || isPending}
        >
          <X className="h-3.5 w-3.5" />
          Reject
        </Button>
      </div>

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {action === "REJECTED" ? "Reject Timesheet" : "Return for Edits"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="comment">
                Comment {action === "REJECTED" ? "(required)" : "(optional)"}
              </Label>
              <Textarea
                id="comment"
                placeholder="Explain why this timesheet is being rejected..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => submitReview(action!, comment)}
              disabled={loading || (action === "REJECTED" && !comment.trim())}
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {action === "REJECTED" ? "Reject" : "Return for Edits"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
