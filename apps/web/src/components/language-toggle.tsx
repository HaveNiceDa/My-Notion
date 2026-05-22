"use client";

import { useParams, useRouter } from "next/navigation";

import { Button } from "@/src/components/ui/button";

export function LanguageToggle() {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const toggleLanguage = () => {
    const newLocale = locale === "zh-CN" ? "en" : "zh-CN";
    const currentPath = window.location.pathname;
    const newPath = currentPath.replace(`/${locale}`, `/${newLocale}`);
    router.push(`${newPath}${window.location.search}${window.location.hash}`);
  };

  return (
    <Button variant="outline" size="icon" onClick={toggleLanguage}>
      {locale === "zh-CN" ? "中" : "EN"}
    </Button>
  );
}
