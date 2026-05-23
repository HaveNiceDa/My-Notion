"use client";

import { useParams } from "next/navigation";
import { useRouter } from "@/src/i18n/navigation";
import { Button } from "@/src/components/ui/button";

export function LanguageToggle() {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const toggleLanguage = () => {
    const newLocale = locale === "zh-CN" ? "en" : "zh-CN";
    const currentPath = window.location.pathname;
    const newPath = currentPath.replace(`/${locale}`, `/${newLocale}`);
    router.push(`${newPath}${window.location.search}${window.location.hash}`, { locale: newLocale });
  };

  return (
    <Button variant="outline" size="icon" onClick={toggleLanguage}>
      {locale === "zh-CN" ? "中" : "EN"}
    </Button>
  );
}
