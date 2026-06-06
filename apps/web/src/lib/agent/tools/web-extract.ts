import { enqueueEvent } from "../stream";
import type { ToolContext } from "./types";
import { buildToolErrorResult, withToolResultContract } from "./result-contract";

const MAX_CONTENT_LENGTH = 12_000;
const FETCH_TIMEOUT_MS = 12_000;
const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

interface ExtractedPage {
  url: string;
  finalUrl: string;
  title?: string;
  description?: string;
  content: string;
  metadata: {
    contentLength: number;
    truncated: boolean;
    contentType: string | null;
  };
}

type ExtractedContent = Pick<ExtractedPage, "title" | "description" | "content">;

// URL 正文抽取：服务端 fetch + 轻量 HTML 清洗，避免让 LLM 直接访问任意网络资源。
export async function executeWebExtract(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  const url = typeof args.url === "string" ? args.url.trim() : "";
  const validation = validateExtractUrl(url);
  if (!validation.ok) {
    return {
      url,
      content: "",
      ...buildToolErrorResult("web_extract", validation.error, { reason: "validation_error" }),
    };
  }

  try {
    const page = await fetchAndExtract(validation.url);
    if (ctx.stream) {
      enqueueEvent(ctx.stream.controller, ctx.stream.encoder, {
        type: "tool-result-delta",
        toolCallId: ctx.stream.toolCallId,
        delta: [
          `Title: ${page.title ?? "(untitled)"}`,
          `URL: ${page.finalUrl}`,
          page.content.slice(0, 1000),
        ].join("\n\n"),
      });
    }
    return withToolResultContract("web_extract", { ...page }, {
      summary: `Extracted ${page.content.length} characters from ${page.finalUrl}.`,
      sources: [{
        type: "web",
        url: page.finalUrl,
        title: page.title,
      }],
      metadata: page.metadata,
    });
  } catch (error) {
    return {
      url,
      content: "",
      ...buildToolErrorResult("web_extract", error),
    };
  }
}

function validateExtractUrl(rawUrl: string): { ok: true; url: URL } | { ok: false; error: string } {
  if (!rawUrl) return { ok: false, error: "url is required" };

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, error: "url must be a valid absolute URL" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "only http and https URLs are supported" };
  }
  if (isBlockedHost(url.hostname)) {
    return { ok: false, error: "local and private network URLs are not allowed" };
  }

  return { ok: true, url };
}

async function fetchAndExtract(url: URL): Promise<ExtractedPage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "My-Notion-Agent/1.0",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    const body = await response.text();
    const extracted = contentType?.includes("text/plain")
      ? extractPlainText(body)
      : extractHtml(body);
    const content = truncate(extracted.content, MAX_CONTENT_LENGTH);

    return {
      url: url.toString(),
      finalUrl: response.url,
      title: extracted.title,
      description: extracted.description,
      content,
      metadata: {
        contentLength: content.length,
        truncated: extracted.content.length > MAX_CONTENT_LENGTH,
        contentType,
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractHtml(html: string): ExtractedContent {
  const title = decodeHtml(findFirst(html, /<title[^>]*>([\s\S]*?)<\/title>/i));
  const description = decodeHtml(
    findFirst(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
      ?? findFirst(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i),
  );
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  return {
    title,
    description,
    content: normalizeWhitespace(decodeHtml(cleaned) ?? ""),
  };
}

function extractPlainText(text: string): ExtractedContent {
  return { content: normalizeWhitespace(text) };
}

function findFirst(input: string, pattern: RegExp): string | undefined {
  return input.match(pattern)?.[1]?.trim();
}

function decodeHtml(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .trim();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local")) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  return false;
}
