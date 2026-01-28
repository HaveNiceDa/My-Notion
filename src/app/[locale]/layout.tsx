import "./globals.css";
import { Toaster } from "sonner";
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/src/i18n/routing";

import { ThemeProvider } from "@/src/components/providers/theme-provider";
import { ConvexClientProvider } from "@/src/components/providers/convex-provider";
import { ModalProvider } from "@/src/components/providers/modal-provider";
import { EdgeStoreProvider } from "@/src/lib/edgestore";

const inter = Inter({ subsets: ["latin"] });

export async function generateMetadata({
  params,
}: {
  params: Promise<{
    locale: string;
  }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Layout" });

  return {
    title: t("title"),
    description: t("description"),
    icons: {
      icon: [
        {
          media: "(prefers-color-scheme: light)",
          url: "/logo.svg",
          href: "/logo.svg",
        },
        {
          media: "(prefers-color-scheme: dark)",
          url: "/logo-dark.svg",
          href: "/logo-dark.svg",
        },
      ],
    },
  };
}

interface RootLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
}

export default async function RootLayout({
  children,
  params,
}: RootLayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Load messages for the current locale
  const messages = await import(`../../../messages/${locale}.json`);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning={true}>
        <ConvexClientProvider>
          <EdgeStoreProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
              storageKey="notion-clone-2"
            >
              <NextIntlClientProvider
                locale={locale}
                messages={messages.default}
              >
                <Toaster position="top-center" />
                <ModalProvider />
                {children}
              </NextIntlClientProvider>
            </ThemeProvider>
          </EdgeStoreProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
