"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";

export interface RequestNoteItem {
  id: string;
  body: string;
  createdAt: string | Date;
  authorId: string;
  author: { name: string };
}

interface RequestNotesThreadProps {
  requestId: string;
  notes: RequestNoteItem[];
  currentUserId: string;
  closed: boolean;
}

function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function RequestNotesThread({ requestId, notes, currentUserId, closed }: RequestNotesThreadProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    if (!body.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/requests/${requestId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to send");
      }
      setBody("");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">Notes</p>

      {notes.length === 0 ? (
        <p className="text-sm text-neutral-400">No notes yet.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => {
            const isMe = n.authorId === currentUserId;
            return (
              <div
                key={n.id}
                className={`rounded-lg p-3 text-sm border ${isMe ? "bg-primary-50 border-primary-200" : "bg-neutral-50 border-neutral-200"}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-medium text-neutral-700">{n.author.name}</span>
                  <span className="text-xs text-neutral-400">{formatDateTime(n.createdAt)}</span>
                </div>
                <p className="text-neutral-700 whitespace-pre-wrap">{n.body}</p>
              </div>
            );
          })}
        </div>
      )}

      {closed ? (
        <p className="text-xs text-neutral-400 italic">This conversation is closed.</p>
      ) : (
        <div className="space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="Write a note..."
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button size="sm" onClick={handleSend} disabled={loading || isPending || !body.trim()}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send Note
          </Button>
        </div>
      )}
    </div>
  );
}
