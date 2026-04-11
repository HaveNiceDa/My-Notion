"use client";

import { useConvexAuth } from "convex/react";
import { useScrollTop } from "@/src/hooks/use-scroll-top";
import { cn } from "@/src/lib/utils";
import { Logo } from "./Logo";
import { ModeToggle } from "@/src/components/mode-toggle";
import { LanguageToggle } from "@/src/components/language-toggle";
import { SignInButton, UserButton } from "@clerk/clerk-react";
import { Button } from "@/src/components/ui/button";
import { Spinner } from "@/src/components/spinner";
import Link from "next/link";
import { useTranslations } from "next-intl";

export function Navbar() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const scrolled = useScrollTop();
  const t = useTranslations("Marketing");

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
                {t('login')}
              </Button>
            </SignInButton>
            <SignInButton mode="modal">
              <Button size="sm">{t('getNotionFree')}</Button>
            </SignInButton>
          </>
        )}
        {isAuthenticated && !isLoading && (
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/documents">{t('enterNotion')}</Link>
            </Button>
            <UserButton afterSignOutUrl="/" />
          </>
        )}
        <ModeToggle />
        <LanguageToggle />
      </div>
    </div>
  );
}
