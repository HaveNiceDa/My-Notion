"use client";

import { useParams } from "next/navigation";
import { useRouter, usePathname } from "@/src/i18n/navigation";
import { Button } from "@/src/components/ui/button";

export function LanguageToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useParams<{ locale: string }>();

  const toggleLanguage = () => {
    const newLocale = locale === "zh-CN" ? "en" : "zh-CN";
    router.push(pathname, { locale: newLocale });
  };

  return (
    <Button variant="outline" size="icon" onClick={toggleLanguage}>
      {locale === "zh-CN" ? "中" : "EN"}
    </Button>
  );
}
