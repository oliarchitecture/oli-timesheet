"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Check, X, RotateCcw, Loader2 } from "lucide-react";

type ReviewStatus = "APPROVED" | "REJECTED" | "REVISION_REQUESTED";

export function LeaveReviewActions({ leaveId }: { leaveId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [action, setAction] = useState<ReviewStatus | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitReview(status: ReviewStatus, reviewComment: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/leave/${leaveId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, comment: reviewComment }),
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

  function openDialog(newAction: ReviewStatus) {
    setAction(newAction);
    setComment("");
    setError("");
    setDialogOpen(true);
  }

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        <Button variant="success" size="sm" onClick={() => submitReview("APPROVED", "")} disabled={loading || isPending}>
          {loading && action === null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Approve
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
        <Button variant="destructive" size="sm" onClick={() => openDialog("REJECTED")} disabled={loading || isPending}>
          <X className="h-3.5 w-3.5" />
          Reject
        </Button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{action === "REJECTED" ? "Reject PTO Request" : "Request Revision"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-neutral-600">
              {action === "REJECTED"
                ? "This is a final decision — the employee cannot resubmit a rejected request."
                : "The request will be returned to the employee to correct and resubmit."}
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="comment">{action === "REJECTED" ? "Reason for rejection" : "What needs to change (required)"}</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder={action === "REJECTED" ? "Explain why the request is being rejected..." : "Describe what needs to be changed..."}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              variant={action === "REJECTED" ? "destructive" : "default"}
              className={action === "REVISION_REQUESTED" ? "bg-amber-600 hover:bg-amber-700 text-white" : undefined}
              onClick={() => action && submitReview(action, comment)}
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
