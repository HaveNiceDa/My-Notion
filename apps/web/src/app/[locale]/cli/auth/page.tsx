"use client";

import { useMemo, useState } from "react";
import { SignInButton, useUser } from "@clerk/nextjs";
import { ShieldCheck, Terminal } from "lucide-react";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useUser();
  const userCode = searchParams.get("user_code") ?? "";
  const deviceCode = searchParams.get("device_code") ?? "";
  const [state, setState] = useState<ActionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const canSubmit = useMemo(
    () => userCode.length > 0 && deviceCode.length > 0 && state === "idle",
    [deviceCode, state, userCode],
  );

  async function handleDecision(action: "approve" | "deny") {
    if (!canSubmit) return;
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
          : "Authorization failed",
      );
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <section className="w-full max-w-xl rounded-2xl border bg-background p-8 shadow-lg">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Terminal className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Authorize My-Notion CLI</h1>
            <p className="text-sm text-muted-foreground">
              Allow this local CLI session to access your My-Notion documents.
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-lg border bg-muted/40 p-4">
          <div className="mb-2 text-sm font-medium">User code</div>
          <div className="font-mono text-2xl tracking-widest">
            {userCode || "Missing code"}
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            Confirm that this code matches the one printed by your terminal.
          </div>
        </div>

        <div className="mb-6 flex gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:text-yellow-300">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            After approval, the CLI can read and write documents with your
            account permissions. Only approve if you trust this local Agent or
            terminal session.
          </p>
        </div>

        {!userCode || !deviceCode ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Missing authorization parameters. Please rerun{" "}
            <code>my-notion auth login</code>.
          </div>
        ) : null}

        {isLoaded && !isSignedIn ? (
          <SignInButton mode="modal">
            <Button className="w-full">Sign in to continue</Button>
          </SignInButton>
        ) : null}

        {isLoaded && isSignedIn ? (
          <>
          {state === "approved" ? (
            <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-sm text-green-700 dark:text-green-300">
              Authorization approved. You can return to the terminal.
            </div>
          ) : null}

          {state === "denied" ? (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              Authorization denied. You can close this page.
            </div>
          ) : null}

          {state === "error" ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {state === "idle" || state === "loading" ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                className="flex-1"
                disabled={!canSubmit || state === "loading"}
                onClick={() => void handleDecision("approve")}
              >
                Approve CLI access
              </Button>
              <Button
                className="flex-1"
                disabled={!canSubmit || state === "loading"}
                onClick={() => void handleDecision("deny")}
                variant="outline"
              >
                Deny
              </Button>
            </div>
          ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
