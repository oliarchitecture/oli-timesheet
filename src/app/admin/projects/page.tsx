import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { Project } from "@prisma/client";
import { AddProjectDialog } from "./AddProjectDialog";
import { ProjectActions } from "./ProjectActions";

const statusVariant: Record<string, "success" | "secondary" | "warning"> = {
  ACTIVE: "success",
  COMPLETED: "secondary",
  ON_HOLD: "warning",
};

export default async function ProjectsPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/dashboard");

  const projects = await db.project.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Projects</h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            {projects.filter((p) => p.status === "ACTIVE").length} active projects
          </p>
        </div>
        <AddProjectDialog />
      </div>

      <Card>
        <CardContent className="p-0">
          {projects.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-10">No projects yet.</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {projects.map((p: Project) => (
                <div key={p.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-neutral-800">{p.name}</p>
                    <p className="text-xs text-neutral-500">
                      {p.clientName ?? "—"}
                      {p.code ? ` · ${p.code}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={statusVariant[p.status] ?? "secondary"}>
                      {p.status.replace("_", " ")}
                    </Badge>
                    <span className="text-xs text-neutral-400">
                      Added {formatDate(p.createdAt)}
                    </span>
                    <ProjectActions project={p} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
