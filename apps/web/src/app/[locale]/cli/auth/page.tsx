"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@notion/business/utils";
import { LanguageToggle } from "@/src/components/language-toggle";
import { ModeToggle } from "@/src/components/mode-toggle";
import { Button } from "@/src/components/ui/button";

type ActionState = "idle" | "loading" | "approved" | "denied" | "error";

async function submitDecision(action: "approve" | "deny", userCode: string) {
  const response = await fetch(`/api/cli/auth/device/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userCode }),
  });
  const payload = (await response.json().catch(() => null)) as
    | { success: true }
    | { success: false; error?: { message?: string; code?: string } }
    | null;

  if (!response.ok || !payload?.success) {
    throw new Error(
      payload?.success === false
        ? payload.error?.message ?? payload.error?.code ?? "Authorization failed"
        : `HTTP ${response.status}`,
    );
  }
}

export default function CliAuthPage() {
  const t = useTranslations("CliAuth");
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useUser();
  const userCode = searchParams.get("user_code") ?? "";
  const [state, setState] = useState<ActionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const isSubmitting = state === "loading";

  const canSubmit =
    isLoaded && isSignedIn && Boolean(userCode) && confirmed && state === "idle";
  const userCodeLabel = userCode || t("missingCode");
  const permissions = [
    t("permissions.search"),
    t("permissions.read"),
    t("permissions.create"),
    t("permissions.update"),
  ];

  async function handleDecision(action: "approve" | "deny") {
    if (isSubmitting) return;
    if (action === "approve" && !canSubmit) return;
    if (action === "deny" && (!isLoaded || !isSignedIn || !userCode)) return;

    setState("loading");
    setError(null);
    try {
      await submitDecision(action, userCode);
      setState(action === "approve" ? "approved" : "denied");
    } catch (decisionError) {
      setState("error");
      setError(
        decisionError instanceof Error
          ? decisionError.message
          : t("messages.authorizationFailed"),
      );
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#fbfbfa] text-foreground dark:bg-[#111111]">
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border bg-background shadow-sm">
            <Image
              src="/logo.png"
              height={24}
              width={24}
              alt={t("brandLogoAlt")}
              className="dark:hidden"
              priority
            />
            <Image
              src="/logo-dark.png"
              height={24}
              width={24}
              alt={t("brandLogoAlt")}
              className="hidden dark:block"
              priority
            />
          </div>
          <div>
            <div className="text-sm font-semibold">{t("brand")}</div>
            <div className="text-xs text-muted-foreground">{t("brandSubtitle")}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ModeToggle />
        </div>
      </header>

      <section className="relative z-10 flex min-h-[calc(100vh-88px)] items-start justify-center px-4 pb-12 pt-12 sm:pt-20">
        <div className="w-full max-w-[380px] text-center">
          <div className="mb-5 flex flex-col items-center">
            <div className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border bg-background shadow-sm">
              <Image
                src="/logo.png"
                height={34}
                width={34}
                alt={t("brandLogoAlt")}
                className="dark:hidden"
                priority
              />
              <Image
                src="/logo-dark.png"
                height={34}
                width={34}
                alt={t("brandLogoAlt")}
                className="hidden dark:block"
                priority
              />
            </div>
            <div className="text-sm text-muted-foreground">My-Notion CLI</div>
          </div>

          <h1 className="text-xl font-semibold tracking-tight">
            {t("compactTitle")}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("compactSubtitle")}
          </p>

          <div className="mt-7 rounded-xl bg-muted/35 px-6 py-5 text-left dark:bg-muted/15">
            <div className="mb-4 flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-muted-foreground">
                {t("userCode")}
              </span>
              <span className="font-mono text-lg font-semibold tracking-[0.14em]">
                {userCodeLabel}
              </span>
            </div>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {permissions.map((permission) => (
                <li key={permission} className="flex items-start gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                  <span>{permission}</span>
                </li>
              ))}
            </ul>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-2 text-left text-xs leading-5 text-muted-foreground">
            <input
              checked={confirmed}
              className="mt-1 h-4 w-4 rounded border-muted-foreground/30"
              disabled={!isLoaded || !isSignedIn || isSubmitting}
              onChange={(event) => setConfirmed(event.target.checked)}
              type="checkbox"
            />
            <span>{t("confirmTrust")}</span>
          </label>

          <div className="mt-5 min-h-10">
            {!userCode ? (
              <StatusCard tone="error" icon={<XCircle className="h-4 w-4" />}>
                {t("messages.missingParams")} <code>my-notion auth login</code>.
              </StatusCard>
            ) : null}

            {isLoaded && !isSignedIn ? (
              <StatusCard>{t("messages.redirecting")}</StatusCard>
            ) : null}

            {state === "approved" ? (
              <StatusCard tone="success" icon={<CheckCircle2 className="h-4 w-4" />}>
                {t("messages.approved")}
              </StatusCard>
            ) : null}

            {state === "denied" ? (
              <StatusCard>{t("messages.denied")}</StatusCard>
            ) : null}

            {state === "error" ? (
              <StatusCard tone="error" icon={<XCircle className="h-4 w-4" />}>
                {error}
              </StatusCard>
            ) : null}
          </div>

          {(state === "idle" || state === "loading") && userCode ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Button
                className="rounded-lg"
                disabled={!isLoaded || !isSignedIn || isSubmitting}
                onClick={() => void handleDecision("deny")}
                variant="outline"
              >
                {t("deny")}
              </Button>
              <Button
                className="rounded-lg"
                disabled={!canSubmit || isSubmitting}
                onClick={() => void handleDecision("approve")}
              >
                {isSubmitting ? t("approving") : t("approve")}
              </Button>
            </div>
          ) : null}

          <p className="mt-4 flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t("securityFootnote")}
          </p>
        </div>
      </section>
    </main>
  );
}

function StatusCard({
  children,
  icon,
  tone = "neutral",
}: {
  children: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "success" | "error";
}) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-lg border p-3 text-left text-sm leading-6",
        tone === "neutral" && "bg-muted/20 text-muted-foreground",
        tone === "success" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        tone === "error" &&
          "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      {icon ? <span className="mt-1 shrink-0">{icon}</span> : null}
      <div>{children}</div>
    </div>
  );
}
