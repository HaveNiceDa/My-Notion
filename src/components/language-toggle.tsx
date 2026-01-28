"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/src/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { useTranslations } from "next-intl";

type Language = {
  code: string;
  name: string;
};

const languages: Language[] = [
  { code: "en", name: "English" },
  { code: "zh-CN", name: "简体中文" },
  { code: "zh-TW", name: "繁體中文" },
];

export function LanguageToggle() {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const t = useTranslations("LanguageToggle");

  const changeLanguage = (newLocale: string) => {
    if (locale === newLocale) return;
    
    // 构建新的URL，保持当前路径但更改语言
    const currentPath = window.location.pathname;
    const newPath = currentPath.replace(`/${locale}`, `/${newLocale}`);
    
    router.push(newPath);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          {locale === "en" ? "EN" : locale === "zh-CN" ? "中" : "繁"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={locale === lang.code ? "bg-primary/10" : ""}
          >
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}