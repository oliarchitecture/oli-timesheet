"use client";

import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

interface HeaderProps {
  userName: string;
  userEmail: string;
  userPhoto?: string | null;
  pageTitle: string;
}

export function Header({ userName, userEmail, userPhoto, pageTitle }: HeaderProps) {
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="flex items-center justify-between h-14 px-6 bg-white border-b border-neutral-200 shrink-0">
      <h1 className="text-base font-semibold text-neutral-800">{pageTitle}</h1>

      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-neutral-800 leading-tight">{userName}</p>
          <p className="text-xs text-neutral-500 leading-tight">{userEmail}</p>
        </div>
        <Avatar className="h-8 w-8">
          {userPhoto && <AvatarImage src={userPhoto} alt={userName} />}
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Sign out"
          className="h-8 w-8 text-neutral-500 hover:text-neutral-700"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
