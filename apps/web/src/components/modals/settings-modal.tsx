"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/src/components/ui/alert-dialog";
import { Button } from "@/src/components/ui/button";
import { Checkbox } from "@/src/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
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
  tokenPrefix: string;
  scopes: string[];
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number | null;
  revokedAt: number | null;
};

type ApiTokenListResponse =
  | { success: true; data: { tokens: ApiTokenRecord[] } }
  | { success: false; error?: string };

type ApiTokenRevokeResponse =
  | { success: true; data: { token: ApiTokenRecord } }
  | { success: false; error?: string };

type CreatedApiToken = {
  id: string;
  token: string;
  tokenPrefix: string;
};

type ApiTokenCreateResponse =
  | { success: true; data: CreatedApiToken }
  | { success: false; error?: string };

function formatDateTime(value: number | null, locale: string) {
  if (!value) return "—";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SettingsModal() {
  const settings = useSettings();
  const t = useTranslations("Modals.settings");
  const locale = useLocale();
  const [tokens, setTokens] = useState<ApiTokenRecord[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null);
  const [newTokenName, setNewTokenName] = useState("");
  const [isCreatingToken, setIsCreatingToken] = useState(false);
  const [createdToken, setCreatedToken] = useState<CreatedApiToken | null>(null);
  const [hasSavedCreatedToken, setHasSavedCreatedToken] = useState(false);

  const loadTokens = useCallback(async () => {
    setIsLoadingTokens(true);
    setTokenError(null);

    try {
      const response = await fetch("/api/cli/tokens", {
        method: "GET",
      });
      const payload = (await response.json()) as ApiTokenListResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.success === false ? payload.error : undefined);
      }

      setTokens(payload.data.tokens);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("failedToLoadTokens");
      setTokenError(message || t("failedToLoadTokens"));
      toast.error(message || t("failedToLoadTokens"));
    } finally {
      setIsLoadingTokens(false);
    }
  }, [t]);

  useEffect(() => {
    if (settings.isOpen) {
      void loadTokens();
    }
  }, [loadTokens, settings.isOpen]);

  const handleOpenChange = (open: boolean) => {
    if (open) return;

    if (createdToken && !hasSavedCreatedToken) {
      toast.info(t("saveTokenBeforeClosing"));
      return;
    }

    setCreatedToken(null);
    setHasSavedCreatedToken(false);
    settings.onClose();
  };

  const createToken = async () => {
    setIsCreatingToken(true);

    try {
      const response = await fetch("/api/cli/tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newTokenName.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as ApiTokenCreateResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.success === false ? payload.error : undefined);
      }

      setCreatedToken(payload.data);
      setHasSavedCreatedToken(false);
      setNewTokenName("");
      await loadTokens();
      toast.success(t("tokenCreated"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("failedToCreateToken");
      toast.error(message || t("failedToCreateToken"));
    } finally {
      setIsCreatingToken(false);
    }
  };

  const copyCreatedToken = async () => {
    if (!createdToken) return;

    try {
      await navigator.clipboard.writeText(createdToken.token);
      toast.success(t("tokenCopied"));
    } catch {
      toast.error(t("failedToCopyToken"));
    }
  };

  const acknowledgeSavedToken = () => {
    setCreatedToken(null);
    setHasSavedCreatedToken(false);
  };

  const revokeToken = async (tokenId: string) => {
    setRevokingTokenId(tokenId);

    try {
      const response = await fetch(`/api/cli/tokens?tokenId=${encodeURIComponent(tokenId)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as ApiTokenRevokeResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.success === false ? payload.error : undefined);
      }

      setTokens((current) =>
        current.map((token) =>
          token.id === payload.data.token.id ? payload.data.token : token,
        ),
      );
      toast.success(t("tokenRevoked"));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("failedToRevokeToken");
      toast.error(message || t("failedToRevokeToken"));
    } finally {
      setRevokingTokenId(null);
    }
  };

  return (
    <Dialog open={settings.isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle>{t('mySettings')}</DialogTitle>
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
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {tokenError}
            </div>
          ) : null}

          <div className="mb-3 rounded-md border bg-muted/30 p-3">
            <div className="mb-2 flex flex-col gap-1">
              <Label htmlFor="new-api-token-name">{t("createApiToken")}</Label>
              <span className="text-xs text-muted-foreground">
                {t("createApiTokenDescription")}
              </span>
            </div>
            <div className="flex gap-2">
              <Input
                disabled={isCreatingToken || Boolean(createdToken)}
                id="new-api-token-name"
                onChange={(event) => setNewTokenName(event.target.value)}
                placeholder={t("tokenNamePlaceholder")}
                value={newTokenName}
              />
              <Button
                disabled={isCreatingToken || Boolean(createdToken)}
                onClick={() => void createToken()}
                type="button"
              >
                {isCreatingToken ? t("creatingToken") : t("createToken")}
              </Button>
            </div>
          </div>

          {createdToken ? (
            <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
              <div className="mb-2">
                <div className="font-medium text-sm">{t("newTokenReady")}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("newTokenVisibleOnce")}
                </p>
              </div>
              <div className="flex gap-2">
                <Input
                  className="font-mono text-xs"
                  readOnly
                  type="text"
                  value={createdToken.token}
                />
                <Button
                  onClick={() => void copyCreatedToken()}
                  type="button"
                  variant="outline"
                >
                  {t("copyToken")}
                </Button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Checkbox
                  checked={hasSavedCreatedToken}
                  id="saved-created-token"
                  onCheckedChange={(checked) =>
                    setHasSavedCreatedToken(checked === true)
                  }
                />
                <Label
                  className="cursor-pointer text-xs text-muted-foreground"
                  htmlFor="saved-created-token"
                >
                  {t("iHaveSavedToken")}
                </Label>
              </div>
              <Button
                className="mt-3"
                disabled={!hasSavedCreatedToken}
                onClick={acknowledgeSavedToken}
                size="sm"
                type="button"
              >
                {t("hideSavedToken")}
              </Button>
            </div>
          ) : null}

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {!isLoadingTokens && tokens.length === 0 ? (
              <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                {t("noApiTokens")}
              </div>
            ) : null}

            {tokens.map((token) => {
              const isRevoked = Boolean(token.revokedAt);
              const isRevoking = revokingTokenId === token.id;

              return (
                <div
                  className="rounded-md border p-3 text-sm"
                  key={token.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{token.name}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                          {token.tokenPrefix}...
                        </span>
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
                      <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                        <span>{t("scopes")}: {token.scopes.join(", ")}</span>
                        <span>{t("createdAt")}: {formatDateTime(token.createdAt, locale)}</span>
                        <span>{t("lastUsedAt")}: {formatDateTime(token.lastUsedAt, locale)}</span>
                        <span>{t("expiresAt")}: {formatDateTime(token.expiresAt, locale)}</span>
                      </div>
                    </div>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          disabled={isRevoked || isRevoking}
                          size="sm"
                          type="button"
                          variant="destructive"
                        >
                          {isRevoking ? t("revoking") : t("revoke")}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("revokeTokenTitle")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("revokeTokenDescription", {
                              tokenPrefix: token.tokenPrefix,
                            })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => void revokeToken(token.id)}
                          >
                            {t("confirmRevoke")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
