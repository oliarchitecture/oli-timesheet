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

type ReviewStatus = "APPROVED" | "REJECTED" | "REVISION_REQUESTED";

interface PeriodReviewActionsProps {
  periodId: string;
  status: string;
}

export function PeriodReviewActions({ periodId, status }: PeriodReviewActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [action, setAction] = useState<ReviewStatus | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (status !== "SUBMITTED") {
    return (
      <div className="text-sm text-neutral-500">
        {status === "APPROVED"
          ? "This timesheet period has been approved."
          : status === "REJECTED"
          ? "This timesheet period has been rejected."
          : status === "REVISION_REQUESTED"
          ? "Revision has been requested. Awaiting employee resubmission."
          : null}
      </div>
    );
  }

  function openDialog(newAction: ReviewStatus) {
    setAction(newAction);
    setComment("");
    setError("");
    setDialogOpen(true);
  }

  async function handleApprove() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/report-periods/${periodId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to approve");
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setLoading(false);
    }
  }

  async function submitDialog() {
    if (!action || !comment.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/report-periods/${periodId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action, comment }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Action failed");
      }
      setDialogOpen(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        <Button
          variant="success"
          size="sm"
          onClick={handleApprove}
          disabled={loading || isPending}
        >
          {loading && action === null ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Approve Period
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="border-amber-300 text-amber-700 hover:bg-amber-50"
          onClick={() => openDialog("REVISION_REQUESTED")}
          disabled={loading || isPending}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Request Revision
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => openDialog("REJECTED")}
          disabled={loading || isPending}
        >
          <X className="h-3.5 w-3.5" />
          Reject Period
        </Button>
      </div>

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {action === "REJECTED" ? "Reject Period" : "Request Revision"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-neutral-600">
              {action === "REJECTED"
                ? "The entire period will be rejected. This is a final decision."
                : "All weeks will be returned to Draft. The employee can re-edit and resubmit."}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="period-comment">Comment (required)</Label>
              <Textarea
                id="period-comment"
                placeholder={
                  action === "REJECTED"
                    ? "Explain why this period is being rejected…"
                    : "Describe what needs to be changed…"
                }
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
              variant={action === "REJECTED" ? "destructive" : "default"}
              className={action === "REVISION_REQUESTED" ? "bg-amber-600 hover:bg-amber-700 text-white" : undefined}
              onClick={submitDialog}
              disabled={loading || !comment.trim()}
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {action === "REJECTED" ? "Reject" : "Request Revision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
