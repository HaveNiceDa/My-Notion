import * as Sentry from "@sentry/node";

const SENTRY_DSN = process.env.SENTRY_AI_SERVICE_DSN;

export function initSentry(): void {
  if (!SENTRY_DSN) {
    console.log("[Sentry] DSN not configured, skipping initialization");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    sendDefaultPii: false,
  });

  console.log("[Sentry] Initialized for AI service");
}

export function captureException(error: unknown, context?: Record<string, any>): void {
  if (!SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setTag(key, String(value));
      });
    }
    Sentry.captureException(error);
  });
}

export function startSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (!SENTRY_DSN) return fn();
  return Sentry.startSpan({ name, op: "ai.service" }, fn);
}
