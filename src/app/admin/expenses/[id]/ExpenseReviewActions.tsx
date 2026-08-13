"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Download, RotateCcw } from "lucide-react";

type ReviewAction = "REJECT" | "REVISION_REQUESTED";

export function ExpenseReviewActions({
  reportId,
  approvedOnly = false,
}: {
  reportId: string;
  approvedOnly?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<ReviewAction | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  async function handleApprove() {
    startTransition(async () => {
      const res = await fetch(`/api/expenses/${reportId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      });
      if (res.ok) {
        router.refresh();
      }
    });
  }

  function openDialog(action: ReviewAction) {
    setDialogAction(action);
    setComment("");
    setError("");
    setDialogOpen(true);
  }

  async function submitDialog() {
    if (!dialogAction) return;
    setError("");
    if (!comment.trim()) {
      setError(dialogAction === "REJECT" ? "Please provide a rejection reason." : "Please describe what needs to change.");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/expenses/${reportId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: dialogAction, reviewComment: comment }),
      });
      if (res.ok) {
        setDialogOpen(false);
        router.refresh();
      }
    });
  }

  function handleExport() {
    window.location.href = `/api/expenses/${reportId}/export`;
  }

  if (approvedOnly) {
    return (
      <Button variant="outline" onClick={handleExport}>
        <Download className="h-4 w-4" />
        Export ZIP
      </Button>
    );
  }

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        <Button onClick={handleApprove} disabled={isPending}>
          Approve
        </Button>
        <Button
          variant="outline"
          className="border-amber-300 text-amber-700 hover:bg-amber-50"
          onClick={() => openDialog("REVISION_REQUESTED")}
          disabled={isPending}
        >
          <RotateCcw className="h-4 w-4" />
          Request Revision
        </Button>
        <Button variant="destructive" onClick={() => openDialog("REJECT")} disabled={isPending}>
          Reject
        </Button>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export ZIP
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "REJECT" ? "Reject Expense Report" : "Request Revision"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-neutral-600">
              {dialogAction === "REJECT"
                ? "This is a final decision — the employee cannot resubmit a rejected report."
                : "The report will be returned to the employee to correct and resubmit."}
            </p>
            <Label htmlFor="comment">
              {dialogAction === "REJECT" ? "Reason for rejection" : "What needs to change (required)"}
            </Label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder={dialogAction === "REJECT" ? "Explain why this report is being rejected…" : "Describe what needs to be changed…"}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant={dialogAction === "REJECT" ? "destructive" : "default"}
              className={dialogAction === "REVISION_REQUESTED" ? "bg-amber-600 hover:bg-amber-700 text-white" : undefined}
              onClick={submitDialog}
              disabled={isPending}
            >
              {isPending ? "Submitting…" : dialogAction === "REJECT" ? "Reject Report" : "Request Revision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
