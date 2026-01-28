"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/src/components/ui/button";

export default function Error() {
  const t = useTranslations("Error");
  
  return (
    <div className="h-full flex flex-col justify-center items-center space-y-4">
      <Image
        className="dark:hidden"
        src="/error.png"
        height="300"
        width="300"
        alt="Error"
      />
      <Image
        className="hidden dark:block"
        src="/error-dark.png"
        height="300"
        width="300"
        alt="Error"
      />
      <h2 className="text-xl font-medium">{t('somethingWentWrong')}</h2>
      <Button asChild>
        <Link href="/documents">{t('goBack')}</Link>
      </Button>
    </div>
  );
}
