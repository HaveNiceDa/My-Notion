"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Eye, EyeOff, Loader2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Input } from "@/src/components/ui/input";
import { useSettings } from "@notion/business/hooks";
import { Label } from "@/src/components/ui/label";
import { ModeToggle } from "@/src/components/mode-toggle";
import { LanguageToggle } from "@/src/components/language-toggle";
import { useLocale, useTranslations } from "next-intl";

type ApiTokenRecord = {
  id: string;
  name: string;
  token: string | null;
  tokenPrefix: string;
  scopes: string[];
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number | null;
  revokedAt: number | null;
};

type ApiTokenListResponse =
  | {
      success: true;
      data: {
        tokens: ApiTokenRecord[];
        unavailable?: boolean;
        reason?: "NETWORK_UNAVAILABLE" | "SERVICE_UNAVAILABLE";
        warning?: string;
      };
    }
  | { success: false; error?: string };

type ApiTokenCreateResponse =
  | { success: true; data: ApiTokenRecord }
  | { success: false; error?: string };

function formatDateTime(value: number | null, locale: string) {
  if (!value) return "—";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isNetworkTokenMessage(message: string | null) {
  return /NETWORK_UNAVAILABLE|fetch failed|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EHOSTUNREACH|network|unexpected_error/i.test(
    message ?? "",
  );
}

export function SettingsModal() {
  const settings = useSettings();
  const t = useTranslations("Modals.settings");
  const locale = useLocale();
  const [tokens, setTokens] = useState<ApiTokenRecord[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenWarning, setTokenWarning] = useState<string | null>(null);
  const [isTokenNetworkIssue, setIsTokenNetworkIssue] = useState(false);
  const [isResettingToken, setIsResettingToken] = useState(false);
  const [showDefaultToken, setShowDefaultToken] = useState(false);

  const loadTokens = useCallback(async () => {
    setIsLoadingTokens(true);
    setTokenError(null);
    setTokenWarning(null);
    setIsTokenNetworkIssue(false);

    try {
      const response = await fetch("/api/cli/tokens", {
        method: "GET",
      });
      const payload = (await response.json()) as ApiTokenListResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.success === false ? payload.error : undefined);
      }

      if (payload.data.unavailable) {
        setTokenWarning(payload.data.warning ?? "failedToLoadTokens");
        setIsTokenNetworkIssue(
          payload.data.reason === "NETWORK_UNAVAILABLE" ||
            isNetworkTokenMessage(payload.data.warning ?? null),
        );
      } else {
        setTokens(payload.data.tokens);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setTokenError(message || "failedToLoadTokens");
      setIsTokenNetworkIssue(isNetworkTokenMessage(message));
    } finally {
      setIsLoadingTokens(false);
    }
  }, []);

  useEffect(() => {
    if (settings.isOpen) {
      void loadTokens();
    }
  }, [loadTokens, settings.isOpen]);

  const handleOpenChange = (open: boolean) => {
    if (open) return;

    setShowDefaultToken(false);
    settings.onClose();
  };

  const resetDefaultToken = async () => {
    setIsResettingToken(true);

    try {
      const response = await fetch("/api/cli/tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resetDefault: true,
        }),
      });
      const payload = (await response.json()) as ApiTokenCreateResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.success === false ? payload.error : undefined);
      }

      setTokens([payload.data]);
      setShowDefaultToken(true);
      await loadTokens();
      toast.success(t("tokenReset"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("failedToResetToken");
      toast.error(message || t("failedToResetToken"));
    } finally {
      setIsResettingToken(false);
    }
  };

  const copyToken = async (tokenValue: string | null) => {
    if (!tokenValue) {
      toast.error(t("tokenUnavailableReset"));
      return;
    }

    try {
      await navigator.clipboard.writeText(tokenValue);
      toast.success(t("tokenCopied"));
    } catch {
      toast.error(t("failedToCopyToken"));
    }
  };

  return (
    <Dialog open={settings.isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle>{t('mySettings')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("manageApiTokens")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col gap-y-1">
            <Label>{t('appearance')}</Label>
            <span className="text-[0.8rem] text-muted-foreground">
              {t('customizeHowNotionLooks')}
            </span>
          </div>
          <ModeToggle />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-y-1">
            <Label>{t('language')}</Label>
            <span className="text-[0.8rem] text-muted-foreground">
              {t('changeTheLanguageOfNotion')}
            </span>
          </div>
          <LanguageToggle />
        </div>
        <div className="mt-6 border-t pt-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex flex-col gap-y-1">
              <Label>{t("apiTokens")}</Label>
              <span className="text-[0.8rem] text-muted-foreground">
                {t("manageApiTokens")}
              </span>
            </div>
            <Button
              disabled={isLoadingTokens}
              onClick={() => void loadTokens()}
              size="sm"
              type="button"
              variant="outline"
            >
              {isLoadingTokens ? t("loadingTokens") : t("refresh")}
            </Button>
          </div>

          {tokenError ? (
            <div className="flex min-h-28 flex-col items-center justify-center rounded-md border border-destructive/40 bg-destructive/10 px-4 py-5 text-center text-sm text-destructive">
              {isTokenNetworkIssue ? (
                <>
                  <WifiOff className="mb-2 h-5 w-5" />
                  <div className="font-medium">{t("tokenNetworkErrorTitle")}</div>
                  <div className="mt-1 text-xs text-destructive/80">
                    {t("tokenNetworkErrorDescription")}
                  </div>
                </>
              ) : (
                tokenError === "failedToLoadTokens" ? t("failedToLoadTokens") : tokenError
              )}
            </div>
          ) : null}
          {tokenWarning ? (
            <div className="flex min-h-28 flex-col items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-5 text-center text-sm text-amber-700">
              <WifiOff className="mb-2 h-5 w-5" />
              <div className="font-medium">
                {isTokenNetworkIssue ? t("tokenNetworkErrorTitle") : t("failedToLoadTokens")}
              </div>
              <div className="mt-1 max-w-md text-xs text-amber-700/80">
                {isTokenNetworkIssue
                  ? t("tokenNetworkErrorDescription")
                  : tokenWarning !== "failedToLoadTokens"
                    ? tokenWarning
                    : t("tokenTemporarilyUnavailable")}
              </div>
            </div>
          ) : null}

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {isLoadingTokens && tokens.length === 0 ? (
              <div className="flex min-h-36 flex-col items-center justify-center rounded-md border bg-muted/20 p-5 text-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <div className="space-y-1">
                    <div className="text-sm font-medium">{t("loadingTokenTitle")}</div>
                    <div className="text-xs text-muted-foreground">
                      {t("loadingTokenDescription")}
                    </div>
                  </div>
                </div>
                <div className="mt-4 h-2 w-40 animate-pulse rounded-full bg-muted" />
              </div>
            ) : null}

            {!isLoadingTokens && tokens.length === 0 && !tokenWarning ? (
              <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                {t("noApiTokens")}
              </div>
            ) : null}

            {tokens.map((token) => {
              const isRevoked = Boolean(token.revokedAt);

              return (
                <div className="rounded-md border p-3 text-sm" key={token.id}>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{token.name}</span>
                        <span
                          className={
                            isRevoked
                              ? "rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                              : "rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-600"
                          }
                        >
                          {isRevoked ? t("revoked") : t("active")}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          disabled={isResettingToken}
                          onClick={() => void resetDefaultToken()}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {isResettingToken ? t("resettingToken") : t("resetToken")}
                        </Button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <div className="relative min-w-0 flex-1">
                        <Input
                          className="pr-10 font-mono text-xs"
                          readOnly
                          type={showDefaultToken ? "text" : "password"}
                          value={token.token ?? token.tokenPrefix}
                        />
                        <Button
                          aria-label={showDefaultToken ? t("hideToken") : t("showToken")}
                          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
                          disabled={!token.token || isRevoked}
                          onClick={() => setShowDefaultToken((value) => !value)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          {showDefaultToken ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                        <Button
                          disabled={!token.token || isRevoked}
                          onClick={() => void copyToken(token.token)}
                          type="button"
                          variant="outline"
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          {t("copyToken")}
                        </Button>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {token.token
                        ? `${t("createdAt")}: ${formatDateTime(token.createdAt, locale)} · ${t("lastUsedAt")}: ${formatDateTime(token.lastUsedAt, locale)}`
                        : t("tokenUnavailableReset")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
