"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/src/i18n/navigation";
import { Button } from "@/src/components/ui/button";

export function LanguageToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale } = useParams<{ locale: string }>();

  const toggleLanguage = () => {
    const newLocale = locale === "zh-CN" ? "en" : "zh-CN";
    const queryString = searchParams.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname, {
      locale: newLocale,
    });
  };

  return (
    <Button variant="outline" size="icon" onClick={toggleLanguage}>
      {locale === "zh-CN" ? "中" : "EN"}
    </Button>
  );
}
