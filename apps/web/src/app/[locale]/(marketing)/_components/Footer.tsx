"use client";

import { Button } from "@/src/components/ui/button";
import { Logo } from "./Logo";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

export function Footer() {
  const t = useTranslations("Marketing");

  const handlePrivacyPolicy = () => {
    toast.info(t("comingSoon"));
  };

  const handleTermsConditions = () => {
    toast.info(t("comingSoon"));
  };

  return (
    <div className="flex items-center w-full p-6 bg-background z-50 dark:bg-[#1F1F1F]">
      <Logo />
      <div
        className="md:ml-auto w-full justify-between md:justify-end flex items-center gap-x-2
        text-muted-foreground"
      >
        <Button variant="ghost" size="sm" onClick={handlePrivacyPolicy}>
          {t("privacyPolicy")}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleTermsConditions}>
          {t("termsConditions")}
        </Button>
      </div>
    </div>
  );
}
