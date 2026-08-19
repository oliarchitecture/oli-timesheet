import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

export default async function RequestsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const requests = await db.generalRequest.findMany({
    where: { employeeId: session.user.id },
    include: { _count: { select: { notes: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Requests</h2>
          <p className="text-sm text-neutral-500 mt-0.5">Submit a general request or comment to the admin</p>
        </div>
        <Button asChild>
          <Link href="/requests/new">
            <Plus className="h-4 w-4" />
            New Request
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>My Requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {requests.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-8">No requests yet.</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {requests.map((r) => (
                <Link
                  key={r.id}
                  href={`/requests/${r.id}`}
                  className="block px-6 py-4 hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-800">{r.subject}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {formatDate(r.createdAt)}
                        {r._count.notes > 0 && ` · ${r._count.notes} note${r._count.notes !== 1 ? "s" : ""}`}
                      </p>
                    </div>
                    <Badge variant={statusVariant[r.status] ?? "secondary"}>{r.status}</Badge>
                  </div>
                  <p className="text-sm text-neutral-600 mt-2 whitespace-pre-wrap">{r.note}</p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
