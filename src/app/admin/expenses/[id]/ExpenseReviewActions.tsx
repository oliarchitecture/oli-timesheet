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
import { Download } from "lucide-react";

export function ExpenseReviewActions({
  reportId,
  approvedOnly = false,
}: {
  reportId: string;
  approvedOnly?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
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

  async function handleReject() {
    setError("");
    if (!comment.trim()) {
      setError("Please provide a rejection reason.");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/expenses/${reportId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJECT", reviewComment: comment }),
      });
      if (res.ok) {
        setRejectOpen(false);
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
      <div className="flex gap-2">
        <Button onClick={handleApprove} disabled={isPending}>
          Approve
        </Button>
        <Button variant="destructive" onClick={() => setRejectOpen(true)} disabled={isPending}>
          Reject
        </Button>
        <Button variant="outline" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export ZIP
        </Button>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Expense Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="comment">Reason for rejection</Label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="Explain why this report is being rejected…"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isPending}>
              {isPending ? "Rejecting…" : "Reject Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
