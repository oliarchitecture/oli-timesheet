"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Check, X, Loader2 } from "lucide-react";

export function LeaveReviewActions({ leaveId }: { leaveId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitReview(status: "APPROVED" | "REJECTED", reviewComment: string) {
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

  return (
    <>
      <div className="flex gap-2">
        <Button variant="success" size="sm" onClick={() => submitReview("APPROVED", "")} disabled={loading || isPending}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Approve
        </Button>
        <Button variant="destructive" size="sm" onClick={() => setDialogOpen(true)} disabled={loading || isPending}>
          <X className="h-3.5 w-3.5" />
          Reject
        </Button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reject Leave Request</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="comment">Reason for rejection</Label>
              <Textarea id="comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Explain why the request is being rejected..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => submitReview("REJECTED", comment)} disabled={loading || !comment.trim()}>
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
