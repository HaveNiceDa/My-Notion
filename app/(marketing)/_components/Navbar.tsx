"use client";

import { useConvexAuth } from "convex/react";
import { useScrollTop } from "@/app/hooks/use-scroll-top";
import { cn } from "@/app/lib/utils";
import { Logo } from "./Logo";
import { ModeToggle } from "@/app/components/mode-toggle";
import { SignInButton, UserButton } from "@clerk/clerk-react";
import { Button } from "@/app/components/ui/button";
import { Spinner } from "@/app/components/spinner";
import Link from "next/link";

export function Navbar() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const scrolled = useScrollTop();

  return (
    <div
      className={cn(
        `z-50 bg-background dark:bg-[#1F1F1F] fixed top-0 flex items-center w-full p-6`,
        scrolled && "border-b shadow-sm",
      )}
    >
      <Logo />
      <div className="md:ml-auto md:justify-end flex gap-x-2 justify-between items-center w-full">
        {isLoading && <Spinner />}
        {!isAuthenticated && !isLoading && (
          <>
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm">
                Login
              </Button>
            </SignInButton>
            <SignInButton mode="modal">
              <Button size="sm">Get Joshion free</Button>
            </SignInButton>
          </>
        )}
        {isAuthenticated && !isLoading && (
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/documents">Enter Notion</Link>
            </Button>
            <UserButton afterSignOutUrl="/" />
          </>
        )}
        <ModeToggle />
      </div>
    </div>
  );
}
