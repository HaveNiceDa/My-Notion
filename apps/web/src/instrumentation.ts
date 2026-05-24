import * as Sentry from "@sentry/nextjs";

const REQUIRED_SERVER_ENV_VARS = [
  "LLM_API_KEY",
  "NEXT_PUBLIC_CONVEX_URL",
] as const;

const OPTIONAL_SERVER_ENV_VARS = [
  "SERPAPI_API_KEY",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
] as const;

function validateEnvVars() {
  const missing = REQUIRED_SERVER_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `[Env] 缺少必需环境变量: ${missing.join(", ")}。请在 .env.local 或部署平台中配置。`,
    );
  }

  const optionalMissing = OPTIONAL_SERVER_ENV_VARS.filter((key) => !process.env[key]);
  if (optionalMissing.length > 0) {
    console.warn(
      `[Env] 可选环境变量未配置: ${optionalMissing.join(", ")}。相关功能将不可用。`,
    );
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    validateEnvVars();
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
