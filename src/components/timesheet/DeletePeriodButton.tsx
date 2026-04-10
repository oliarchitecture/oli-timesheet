"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";

export function DeletePeriodButton({ periodId }: { periodId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this draft timesheet? This cannot be undone.")) return;
    setLoading(true);
    const res = await fetch(`/api/report-periods/${periodId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/timesheets");
    } else {
      alert("Failed to delete timesheet.");
      setLoading(false);
    }
  }

  return (
    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      Delete Draft
    </Button>
  );
}
