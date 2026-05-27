import OpenAI from "openai";

import { DASHSCOPE_BASE_URL, DEFAULT_MODEL, getActualModelId } from "../../config";
import type { QueryRewriteVariant } from "./types";

interface QueryRewriteResponse {
  keywordQuery?: string;
  semanticQuery?: string;
}

const QUERY_REWRITE_SYSTEM_PROMPT = [
  "你是 My-Notion 的检索 Query Rewrite 模块。",
  "你的任务是把用户问题改写成更适合混合检索的查询，不回答问题。",
  "必须只输出 JSON，格式为 {\"keywordQuery\":\"...\",\"semanticQuery\":\"...\"}。",
  "keywordQuery 应保留专有名词、函数名、错误码、标题、时间线索，适合关键词/BM25 检索。",
  "semanticQuery 应补充同义表达、上下文意图和相关概念，适合向量语义检索。",
].join("\n");

export async function rewriteQueryForDeepRetrieval(query: string): Promise<QueryRewriteVariant[]> {
  const original = normalizeVariant({ kind: "original", query });
  if (!original) {
    return [];
  }

  // deep 策略优先让独立 LLM 生成检索 query，避免把语义扩展规则硬编码进业务链路。
  const llmVariants = await rewriteWithLLM(query).catch((error) => {
    console.warn("[Retrieval] query rewrite LLM failed, fallback to local rewrite:", error);
    return [];
  });

  return dedupeVariants([original, ...llmVariants, ...fallbackRewrite(query)]);
}

async function rewriteWithLLM(query: string): Promise<QueryRewriteVariant[]> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    return [];
  }

  const client = new OpenAI({ apiKey, baseURL: DASHSCOPE_BASE_URL });
  const model = getActualModelId(process.env.RETRIEVAL_REWRITE_MODEL || DEFAULT_MODEL);

  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: QUERY_REWRITE_SYSTEM_PROMPT },
      { role: "user", content: query },
    ],
  });

  const content = response.choices[0]?.message?.content;
  const parsed = parseRewriteResponse(content);
  return [
    normalizeVariant({ kind: "keyword", query: parsed?.keywordQuery ?? "" }),
    normalizeVariant({ kind: "semantic", query: parsed?.semanticQuery ?? "" }),
  ].filter((variant): variant is QueryRewriteVariant => Boolean(variant));
}

function parseRewriteResponse(content: string | null | undefined): QueryRewriteResponse | null {
  if (!content) {
    return null;
  }

  try {
    const jsonText = content.match(/\{[\s\S]*\}/)?.[0] ?? content;
    const parsed = JSON.parse(jsonText) as QueryRewriteResponse;
    return typeof parsed === "object" && parsed ? parsed : null;
  } catch {
    return null;
  }
}

function fallbackRewrite(query: string): QueryRewriteVariant[] {
  const tokens = tokenizeForKeywordQuery(query);
  const keywordQuery = tokens.join(" ");

  return [
    normalizeVariant({ kind: "keyword", query: keywordQuery }),
    normalizeVariant({ kind: "semantic", query: query }),
  ].filter((variant): variant is QueryRewriteVariant => Boolean(variant));
}

function tokenizeForKeywordQuery(query: string): string[] {
  return Array.from(
    new Set(
      query
        .split(/[\s,，.。:：;；/\\()[\]{}'"`]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2),
    ),
  ).slice(0, 12);
}

function normalizeVariant(variant: QueryRewriteVariant): QueryRewriteVariant | null {
  const query = variant.query.trim();
  if (!query) {
    return null;
  }

  return { kind: variant.kind, query };
}

function dedupeVariants(variants: QueryRewriteVariant[]): QueryRewriteVariant[] {
  const seen = new Set<string>();
  const deduped: QueryRewriteVariant[] = [];

  for (const variant of variants) {
    const key = `${variant.kind}:${variant.query.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(variant);
  }

  return deduped.slice(0, 3);
}
