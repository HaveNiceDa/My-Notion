"use client";
import { Button } from "@/src/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Heroes } from "./Heroes";
import { useConvexAuth } from "convex/react";
import { Spinner } from "@/src/components/spinner";
import Link from "next/link";
import { SignInButton } from "@clerk/clerk-react";
import { useTranslations } from "next-intl";

export default function Heading() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const t = useTranslations("Marketing");

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold">
        {t("heading")}
      </h1>

      <h3 className="text-base sm:text-xl md:text-2xl font-medium">
        {t("subheading")}
      </h3>
      {isLoading && (
        <div className="w-full flex justify-center items-center">
          <Spinner size="lg" />
        </div>
      )}
      {isAuthenticated && !isLoading && (
        <Button asChild>
          <Link href="/documents">
            {t("enterNotion")}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      )}
      {!isAuthenticated && !isLoading && (
        <SignInButton>
          <Button>
            {t("getNotionFree")}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </SignInButton>
      )}
    </div>
  );
}
