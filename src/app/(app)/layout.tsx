import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <Sidebar role={session.user.role as "ADMIN" | "EMPLOYEE"} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header
          userName={session.user.name ?? ""}
          userEmail={session.user.email ?? ""}
          userPhoto={session.user.image}
          pageTitle="OLI Architecture"
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
