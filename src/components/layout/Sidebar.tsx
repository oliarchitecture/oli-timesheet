"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  Clock,
  Calendar,
  Users,
  FolderKanban,
  BarChart3,
  Settings,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const employeeNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/timesheets", label: "Timesheets", icon: Clock },
  { href: "/leave", label: "PTO", icon: Calendar },
  { href: "/profile", label: "My Profile", icon: Settings },
];

const adminNav: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/employees", label: "Employees", icon: Users },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban },
  { href: "/admin/timesheets", label: "Timesheets", icon: Clock },
  { href: "/admin/leave", label: "PTO Requests", icon: Calendar },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
];

interface SidebarProps {
  role: "ADMIN" | "EMPLOYEE";
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const navItems = role === "ADMIN" ? adminNav : employeeNav;

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-neutral-800 text-white">
      {/* Logo */}
      <div className="flex flex-col items-center px-5 py-5 border-b border-neutral-700">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/sidebar-logo.png" alt="OLI Architecture" style={{ width: 100, height: "auto" }} />
        <p className="text-xs text-neutral-400 mt-2">
          {role === "ADMIN" ? "Admin" : "Employee"} Portal
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin" || item.href === "/dashboard"
              ? pathname === item.href
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-primary-500 text-white"
                  : "text-neutral-300 hover:bg-neutral-700 hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
              {isActive && <ChevronRight className="h-3 w-3 ml-auto opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-neutral-700">
        <p className="text-xs text-neutral-500">© 2026 OLI Architecture</p>
      </div>
    </aside>
  );
}
