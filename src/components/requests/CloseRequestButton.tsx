"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";

export function CloseRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  async function handleClose() {
    setLoading(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/close`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to close");
      startTransition(() => router.refresh());
    } catch {
      // no-op; button just stays enabled for retry
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClose} disabled={loading || isPending}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
      Close Conversation
    </Button>
  );
}
