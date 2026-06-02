"use client";

import React, { useState } from "react";
import { useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { BookOpen, FileText, Globe, Loader2, Check, ChevronDown, ChevronUp, Brain, PencilLine, ListChecks } from "lucide-react";
import { cn } from "@notion/business/utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { syncMemoryIndex } from "@/src/lib/agent/memory-sync-client";
import type {
  KnowledgeSearchDoc,
  TaskPlanStep,
  TaskPlanToolResult,
  ToolCallResult,
} from "./types";

interface ToolCallCardProps {
  toolResult: ToolCallResult;
  messageId?: Id<"aiMessages">;
  onExecutePlan?: (prompt: string) => Promise<void>;
}

type RetrievalStrategy = "fast" | "balanced" | "deep";
type MemoryType = "preference" | "project" | "episodic";
type MemorySource = "user_explicit" | "agent_proposed" | "manual";

interface KnowledgeSearchMetadata {
  semanticCount?: number;
  keywordCount?: number;
  metadataCount?: number;
  fusedCount?: number;
  packedCount?: number;
  contextTokenBudget?: number;
  contextEstimatedTokens?: number;
  contextTruncated?: boolean;
  citationQuality?: {
    citationCoverage?: number;
    citedItemCount?: number;
    totalItemCount?: number;
    uniqueDocumentCount?: number;
    needsMoreRetrieval?: boolean;
    explanation?: string;
    packing?: {
      explanation?: string;
      mergedItemCount?: number;
      contextTruncated?: boolean;
    };
  };
}

interface KnowledgeSearchToolResult {
  query?: string;
  strategy?: RetrievalStrategy;
  documents?: KnowledgeSearchDoc[];
  metadata?: KnowledgeSearchMetadata;
  error?: string;
}

interface MemoryItem {
  id?: string;
  type?: MemoryType;
  content?: string;
  source?: MemorySource;
  reason?: string;
  confidence?: number;
  expiresAt?: number;
  supersedesMemoryId?: string;
}

interface MemoryReadToolResult {
  memories?: MemoryItem[];
  error?: string;
}

interface MemoryWriteToolResult {
  dryRun?: boolean;
  confirmationRequired?: boolean;
  message?: string;
  memory?: MemoryItem;
  memoryWriteStatus?: "saved" | "cancelled";
  savedMemoryId?: string;
  error?: string;
}

interface WebExtractToolResult {
  url?: string;
  finalUrl?: string;
  title?: string;
  description?: string;
  content?: string;
  error?: string;
  metadata?: {
    truncated?: boolean;
  };
}

interface DocumentSearchItem {
  documentId: string;
  title: string;
  path?: string[];
  updatedAt?: number;
}

interface DocumentSearchToolResult {
  query?: string;
  documents?: DocumentSearchItem[];
  error?: string;
}

type DocumentUpdateMode = "overwrite" | "append";
type DocumentWriteStatus = "applied" | "cancelled";

interface DocumentWritePreview {
  documentId?: string;
  title?: string;
  currentTitle?: string;
  contentMarkdown?: string;
  parentDocument?: string;
  mode?: DocumentUpdateMode;
}

interface DocumentWriteToolResult {
  dryRun?: boolean;
  confirmationRequired?: boolean;
  action?: "document_write" | "document_update";
  summary?: string;
  message?: string;
  document?: DocumentWritePreview;
  documentWriteStatus?: DocumentWriteStatus;
  savedDocumentId?: string;
  error?: string;
}

function getDocumentUrl(documentId: string): string {
  if (typeof window !== "undefined") {
    const locale = window.location.pathname.split("/")[1] || "zh-CN";
    return `/${locale}/documents/${documentId}`;
  }
  return `/documents/${documentId}`;
}

function formatRetrievalStrategy(
  t: ReturnType<typeof useTranslations>,
  strategy?: RetrievalStrategy,
): string | null {
  if (strategy === "fast") return t("retrievalStrategyFast");
  if (strategy === "balanced") return t("retrievalStrategyBalanced");
  if (strategy === "deep") return t("retrievalStrategyDeep");
  return null;
}

function KnowledgeSearchResult({ result }: { result: KnowledgeSearchToolResult }) {
  const t = useTranslations("AI");
  const docs = result.documents ?? [];
  const strategyLabel = formatRetrievalStrategy(t, result.strategy);
  const metadata = result.metadata;

  if (result.error) {
    return <span className="text-destructive text-xs">{result.error}</span>;
  }

  if (docs.length === 0) {
    return (
      <div className="space-y-1">
        {strategyLabel && (
          <div className="text-xs text-muted-foreground">
            {t("retrievalStrategyLabel")}: {strategyLabel}
          </div>
        )}
        <span className="text-muted-foreground text-xs">{t("noDocumentsFound")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {(strategyLabel || metadata) && (
        <div className="rounded-md bg-background/70 px-2 py-1.5 text-xs text-muted-foreground">
          {strategyLabel && (
            <div>
              {t("retrievalStrategyLabel")}:{" "}
              <span className="font-medium text-foreground">{strategyLabel}</span>
            </div>
          )}
          {metadata && (
            <>
              <div>
                {t("retrievalRecallStats", {
                  semantic: metadata.semanticCount ?? 0,
                  keyword: metadata.keywordCount ?? 0,
                  metadata: metadata.metadataCount ?? 0,
                  fused: metadata.fusedCount ?? docs.length,
                })}
              </div>
              {metadata.packedCount !== undefined && (
                <div>
                  {t("retrievalPackingStats", {
                    packed: metadata.packedCount,
                    tokens: metadata.contextEstimatedTokens ?? 0,
                    budget: metadata.contextTokenBudget ?? 0,
                  })}
                  {metadata.contextTruncated ? ` · ${t("retrievalContextTruncated")}` : ""}
                </div>
              )}
              {metadata.citationQuality && (
                <div>
                  {t("retrievalCitationQuality", {
                    coverage: Math.round((metadata.citationQuality.citationCoverage ?? 0) * 100),
                    documents: metadata.citationQuality.uniqueDocumentCount ?? 0,
                  })}
                  {metadata.citationQuality.needsMoreRetrieval
                    ? ` · ${t("retrievalNeedsMoreEvidence")}`
                    : ""}
                </div>
              )}
              {metadata.citationQuality?.packing?.explanation && (
                <div className="line-clamp-2">
                  {metadata.citationQuality.packing.explanation}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {docs.map((doc, idx) => (
        <a
          key={doc.documentId || idx}
          href={doc.documentId ? getDocumentUrl(doc.documentId) : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
            doc.documentId
              ? "hover:bg-accent cursor-pointer text-foreground"
              : "text-muted-foreground cursor-default",
          )}
          onClick={(e) => { if (!doc.documentId) e.preventDefault(); }}
        >
          <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{doc.title || t("untitledDocument")}</span>
          {doc.sources && doc.sources.length > 0 && (
            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
              {doc.sources.join("+")}
            </span>
          )}
        </a>
      ))}
    </div>
  );
}

function DocumentReadResult({ result }: { result: { document?: { id: string; title: string } } }) {
  const t = useTranslations("AI");

  if (!result.document) {
    return <span className="text-muted-foreground text-xs">{t("noDocumentAvailable")}</span>;
  }

  return (
    <a
      href={getDocumentUrl(result.document.id)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent transition-colors cursor-pointer"
    >
      <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="truncate font-medium">{result.document.title}</span>
    </a>
  );
}

function buildPlanExecutionPrompt(
  result: TaskPlanToolResult,
  t: ReturnType<typeof useTranslations>,
): string {
  const steps = result.steps ?? [];
  const stepList = steps
    .map((step, index) => {
      const description = step.description ? `: ${step.description}` : "";
      return `${index + 1}. ${step.title ?? t("taskPlanUntitledStep")}${description}`;
    })
    .join("\n");

  return [
    t("planExecutionPromptIntro"),
    "",
    `${t("planExecutionPromptObjective")}: ${result.objective ?? ""}`,
    "",
    `${t("planExecutionPromptSteps")}:`,
    stepList,
  ].join("\n");
}

function TaskPlanResult({
  result,
  onExecutePlan,
}: {
  result: TaskPlanToolResult;
  onExecutePlan?: (prompt: string) => Promise<void>;
}) {
  const t = useTranslations("AI");
  const steps = result.steps ?? [];
  const [executionStatus, setExecutionStatus] = useState<"idle" | "starting" | "started">("idle");

  if (result.error) {
    return <span className="text-destructive text-xs">{result.error}</span>;
  }

  async function handleExecutePlan() {
    if (!onExecutePlan || steps.length === 0) return;
    setExecutionStatus("starting");
    await onExecutePlan(buildPlanExecutionPrompt(result, t));
    setExecutionStatus("started");
  }

  return (
    <div className="space-y-1.5">
      {result.objective && (
        <div className="rounded-md bg-background/70 px-2 py-1.5 text-xs text-foreground">
          {result.objective}
        </div>
      )}
      {steps.map((step, index) => (
        <div key={step.id ?? index} className="flex gap-2 rounded-md px-2 py-1 text-xs">
          <span className="mt-0.5 text-muted-foreground">{index + 1}.</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-foreground">{step.title ?? t("taskPlanUntitledStep")}</span>
              {step.status && (
                <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {formatTaskPlanStatus(t, step.status)}
                </span>
              )}
            </div>
            {step.description && (
              <div className="mt-0.5 line-clamp-2 text-muted-foreground">{step.description}</div>
            )}
          </div>
        </div>
      ))}
      {onExecutePlan && steps.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleExecutePlan}
            disabled={executionStatus !== "idle"}
            className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-60"
          >
            {executionStatus === "starting"
              ? t("planExecutionStarting")
              : executionStatus === "started"
                ? t("planExecutionStarted")
                : t("executePlan")}
          </button>
          <span className="text-[11px] text-muted-foreground">
            {executionStatus === "idle" ? t("planConfirmationRequired") : t("planExecutionVisible")}
          </span>
        </div>
      )}
    </div>
  );
}

function formatTaskPlanStatus(
  t: ReturnType<typeof useTranslations>,
  status: NonNullable<TaskPlanStep["status"]>,
): string {
  if (status === "in_progress") return t("taskPlanInProgress");
  if (status === "completed") return t("taskPlanCompleted");
  if (status === "blocked") return t("taskPlanBlocked");
  return t("taskPlanPending");
}

function WebSearchResult({ result }: { result: { query?: string; results?: { title: string; link: string; snippet: string }[]; error?: string } }) {
  const t = useTranslations("AI");

  if (result.error) {
    return <span className="text-destructive text-xs">{result.error}</span>;
  }

  const results = result.results ?? [];
  if (results.length === 0) {
    return <span className="text-muted-foreground text-xs">{t("searchedFor")}: {result.query}</span>;
  }

  return (
    <div className="space-y-1">
      {results.map((item, idx) => (
        <a
          key={idx}
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent transition-colors cursor-pointer"
        >
          <Globe className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
          <div className="min-w-0">
            <span className="truncate font-medium text-foreground block">{item.title}</span>
            <span className="text-muted-foreground line-clamp-2">{item.snippet}</span>
          </div>
        </a>
      ))}
    </div>
  );
}

function WebExtractResult({ result }: { result: WebExtractToolResult }) {
  const t = useTranslations("AI");
  if (result.error) {
    return <span className="text-destructive text-xs">{result.error}</span>;
  }

  return (
    <a
      href={result.finalUrl ?? result.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-md px-2 py-1.5 text-xs hover:bg-accent transition-colors"
    >
      <div className="flex items-center gap-2">
        <Globe className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium text-foreground">
          {result.title ?? result.finalUrl ?? result.url}
        </span>
      </div>
      {result.description && (
        <div className="mt-1 line-clamp-2 text-muted-foreground">{result.description}</div>
      )}
      {result.content && (
        <div className="mt-1 line-clamp-3 text-muted-foreground">{result.content}</div>
      )}
      {result.metadata?.truncated && (
        <div className="mt-1 text-[10px] text-muted-foreground">{t("webExtractTruncated")}</div>
      )}
    </a>
  );
}

function DocumentSearchResult({ result }: { result: DocumentSearchToolResult }) {
  const t = useTranslations("AI");
  if (result.error) {
    return <span className="text-destructive text-xs">{result.error}</span>;
  }

  const documents = result.documents ?? [];
  if (documents.length === 0) {
    return <span className="text-muted-foreground text-xs">{t("noDocumentsFound")}</span>;
  }

  return (
    <div className="space-y-1">
      {documents.map((doc) => (
        <a
          key={doc.documentId}
          href={getDocumentUrl(doc.documentId)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent transition-colors cursor-pointer"
        >
          <FileText className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
          <div className="min-w-0">
            <span className="truncate font-medium text-foreground block">{doc.title || t("untitledDocument")}</span>
            {doc.path && doc.path.length > 0 && (
              <span className="text-muted-foreground line-clamp-1">{doc.path.join(" / ")}</span>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}

function MemoryReadResult({ result }: { result: MemoryReadToolResult }) {
  const t = useTranslations("AI");
  if (result.error) {
    return <span className="text-destructive text-xs">{result.error}</span>;
  }

  const memories = result.memories ?? [];
  if (memories.length === 0) {
    return <span className="text-muted-foreground text-xs">{t("noMemoriesFound")}</span>;
  }

  return (
    <div className="space-y-1">
      {memories.map((memory, idx) => (
        <div key={memory.id ?? idx} className="rounded-md bg-background/70 px-2 py-1.5 text-xs">
          <div className="font-medium text-foreground">{memory.content}</div>
          {memory.type && (
            <div className="text-[10px] text-muted-foreground">{memory.type}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function MemoryWriteResult({
  result,
  toolCallId,
  messageId,
}: {
  result: MemoryWriteToolResult;
  toolCallId: string;
  messageId?: Id<"aiMessages">;
}) {
  const t = useTranslations("AI");
  const createMemory = useMutation(api.agentMemories.createAgentMemory);
  const updateToolResultState = useMutation(api.aiChat.updateToolResultState);
  const initialStatus = result.memoryWriteStatus === "saved"
    ? "saved"
    : result.memoryWriteStatus === "cancelled"
      ? "cancelled"
      : "idle";
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "cancelled" | "error">(initialStatus);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (result.error) {
    return <span className="text-destructive text-xs">{result.error}</span>;
  }

  const memory = result.memory;
  const canConfirm = Boolean(result.dryRun && result.confirmationRequired && memory?.content);

  async function handleSaveMemory() {
    if (!memory?.content || !memory.type) return;
    setStatus("saving");
    setErrorMessage(null);

    try {
      const savedMemory = await createMemory({
        type: memory.type,
        content: memory.content,
        source: memory.source ?? "agent_proposed",
        reason: memory.reason,
        confidence: memory.confidence,
        expiresAt: memory.expiresAt,
        supersedesMemoryId: memory.supersedesMemoryId
          ? memory.supersedesMemoryId as Id<"agentMemories">
          : undefined,
      });
      if (messageId) {
        await updateToolResultState({
          messageId,
          toolCallId,
          status: "saved",
          savedMemoryId: savedMemory.id,
        });
      }
      await syncMemoryIndex({
        id: savedMemory.id,
        type: savedMemory.type,
        content: savedMemory.content,
        reason: savedMemory.reason,
        confidence: savedMemory.confidence,
        source: savedMemory.source,
        updatedAt: savedMemory.updatedAt,
      }).catch((error) => console.warn("[Agent Memory Sync] save failed:", error));
      setStatus("saved");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleCancelMemory() {
    setStatus("cancelled");
    if (!messageId) return;

    try {
      await updateToolResultState({ messageId, toolCallId, status: "cancelled" });
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="space-y-1 rounded-md bg-background/70 px-2 py-1.5 text-xs">
      <div className="font-medium text-foreground">
        {status === "cancelled"
          ? t("memoryCancelled")
          : status === "saved" || !result.dryRun
            ? t("memorySaved")
            : t("memoryWritePreview")}
      </div>
      {result.confirmationRequired && status === "idle" && (
        <div className="text-muted-foreground">{t("memoryConfirmationRequired")}</div>
      )}
      {memory?.content && (
        <div className="text-muted-foreground">{memory.content}</div>
      )}
      {errorMessage && (
        <div className="text-destructive">{t("memorySaveFailed")}: {errorMessage}</div>
      )}
      {canConfirm && status !== "saved" && status !== "cancelled" && (
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleSaveMemory}
            disabled={status === "saving"}
            className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-60"
          >
            {status === "saving" ? t("memorySaving") : t("saveMemory")}
          </button>
          <button
            type="button"
            onClick={handleCancelMemory}
            disabled={status === "saving"}
            className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            {t("cancelMemory")}
          </button>
        </div>
      )}
    </div>
  );
}

function DocumentWriteResult({
  result,
  toolCallId,
  messageId,
}: {
  result: DocumentWriteToolResult;
  toolCallId: string;
  messageId?: Id<"aiMessages">;
}) {
  const t = useTranslations("AI");
  const createDocument = useMutation(api.documents.createFromMarkdown);
  const updateDocument = useMutation(api.documents.updateFromMarkdown);
  const updateToolResultState = useMutation(api.aiChat.updateToolResultState);
  const initialStatus = result.documentWriteStatus === "applied"
    ? "applied"
    : result.documentWriteStatus === "cancelled"
      ? "cancelled"
      : "idle";
  const [status, setStatus] = useState<"idle" | "saving" | "applied" | "cancelled" | "error">(initialStatus);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (result.error) {
    return <span className="text-destructive text-xs">{result.error}</span>;
  }

  const document = result.document;
  const isUpdate = result.action === "document_update";
  const canConfirm = Boolean(result.dryRun && result.confirmationRequired && document);

  async function handleApplyDocumentWrite() {
    if (!document) return;
    setStatus("saving");
    setErrorMessage(null);

    try {
      const savedDocument = isUpdate
        ? await updateDocument({
          documentId: document.documentId ?? "",
          title: document.title,
          contentMarkdown: document.contentMarkdown,
          mode: document.mode ?? "append",
        })
        : await createDocument({
          title: document.title ?? t("untitledDocument"),
          contentMarkdown: document.contentMarkdown,
          parentDocument: document.parentDocument,
        });

      if (messageId) {
        await updateToolResultState({
          messageId,
          toolCallId,
          status: "applied",
          savedDocumentId: savedDocument.id as Id<"documents">,
        });
      }
      setStatus("applied");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleCancelDocumentWrite() {
    setStatus("cancelled");
    if (!messageId) return;

    try {
      await updateToolResultState({ messageId, toolCallId, status: "cancelled" });
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  const title = document?.title ?? document?.currentTitle ?? t("untitledDocument");
  const preview = document?.contentMarkdown ?? "";
  const savedId = result.savedDocumentId;

  return (
    <div className="space-y-2 rounded-md bg-background/70 px-2 py-1.5 text-xs">
      <div className="font-medium text-foreground">
        {status === "cancelled"
          ? t("documentWriteCancelled")
          : status === "applied" || !result.dryRun
            ? t("documentWriteApplied")
            : isUpdate
              ? t("documentUpdatePreview")
              : t("documentWritePreview")}
      </div>
      {result.confirmationRequired && status === "idle" && (
        <div className="text-muted-foreground">{t("documentConfirmationRequired")}</div>
      )}
      <div className="rounded-md border border-border bg-muted/30 p-2">
        <div className="font-medium text-foreground">{title}</div>
        {isUpdate && (
          <div className="text-[10px] text-muted-foreground">
            {t("documentUpdateMode")}: {document?.mode ?? "append"}
          </div>
        )}
        {preview && (
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-background p-2 text-[11px] text-muted-foreground">
            {preview}
          </pre>
        )}
      </div>
      {savedId && (
        <a
          href={getDocumentUrl(savedId)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-[11px] font-medium text-primary hover:underline"
        >
          {t("openDocument")}
        </a>
      )}
      {errorMessage && (
        <div className="text-destructive">{t("documentWriteFailed")}: {errorMessage}</div>
      )}
      {canConfirm && status !== "applied" && status !== "cancelled" && (
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleApplyDocumentWrite}
            disabled={status === "saving"}
            className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-60"
          >
            {status === "saving" ? t("documentWriting") : t("applyDocumentWrite")}
          </button>
          <button
            type="button"
            onClick={handleCancelDocumentWrite}
            disabled={status === "saving"}
            className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            {t("cancelDocumentWrite")}
          </button>
        </div>
      )}
    </div>
  );
}

export function ToolCallCard({ toolResult, messageId, onExecutePlan }: ToolCallCardProps) {
  const t = useTranslations("AI");
  const isCompleted = toolResult.status === "completed";
  const isRunning = toolResult.status === "calling" || toolResult.status === "executing";
  const [expanded, setExpanded] = useState(true);

  const toolName = toolResult.name;
  const displayName =
    toolName === "knowledge_search"
      ? t("knowledgeSearchTool")
      : toolName === "document_read"
        ? t("documentReadTool")
        : toolName === "document_search"
          ? t("documentSearchTool")
        : toolName === "document_write"
          ? t("documentWriteTool")
          : toolName === "document_update"
            ? t("documentUpdateTool")
            : toolName === "web_search"
              ? t("webSearchTool")
              : toolName === "web_extract"
                ? t("webExtractTool")
        : toolName === "memory_read"
          ? t("memoryReadTool")
          : toolName === "memory_write"
            ? t("memoryWriteTool")
            : toolName === "task_plan"
              ? t("taskPlanTool")
            : toolName;

  const ToolIcon =
    toolName === "knowledge_search"
      ? BookOpen
      : toolName === "document_read"
        ? FileText
        : toolName === "document_search"
          ? FileText
        : toolName === "document_write" || toolName === "document_update"
          ? PencilLine
        : toolName === "web_search" || toolName === "web_extract"
          ? Globe
          : toolName === "task_plan"
            ? ListChecks
          : Brain;

  let resultContent: React.ReactNode = null;
  let resultSummary: string | null = null;
  if (isCompleted && toolResult.result) {
    const result = toolResult.result as Record<string, unknown>;
    if (toolName === "knowledge_search") {
      const typedResult = result as unknown as KnowledgeSearchToolResult;
      resultContent = <KnowledgeSearchResult result={typedResult} />;
      const docCount = typedResult.documents?.length ?? 0;
      const strategyLabel = formatRetrievalStrategy(t, typedResult.strategy);
      const docsSummary = docCount > 0 ? t("referencedDocsCount", { count: docCount }) : t("noDocumentsFound");
      resultSummary = strategyLabel ? `${strategyLabel} · ${docsSummary}` : docsSummary;
    } else if (toolName === "document_read") {
      const typedResult = result as unknown as { document?: { id: string; title: string } };
      resultContent = <DocumentReadResult result={typedResult} />;
      resultSummary = typedResult.document?.title ?? null;
    } else if (toolName === "document_write" || toolName === "document_update") {
      const typedResult = result as unknown as DocumentWriteToolResult;
      resultContent = (
        <DocumentWriteResult
          result={typedResult}
          toolCallId={toolResult.id}
          messageId={messageId}
        />
      );
      resultSummary = typedResult.documentWriteStatus === "cancelled"
        ? t("documentWriteCancelled")
        : typedResult.documentWriteStatus === "applied" || !typedResult.dryRun
          ? t("documentWriteApplied")
          : toolName === "document_update"
            ? t("documentUpdatePreview")
            : t("documentWritePreview");
    } else if (toolName === "web_search") {
      const typedResult = result as unknown as { query?: string; results?: { title: string; link: string; snippet: string }[]; error?: string };
      resultContent = <WebSearchResult result={typedResult} />;
      resultSummary = typedResult.query ?? null;
    } else if (toolName === "web_extract") {
      const typedResult = result as unknown as WebExtractToolResult;
      resultContent = <WebExtractResult result={typedResult} />;
      resultSummary = typedResult.title ?? typedResult.finalUrl ?? typedResult.url ?? null;
    } else if (toolName === "document_search") {
      const typedResult = result as unknown as DocumentSearchToolResult;
      resultContent = <DocumentSearchResult result={typedResult} />;
      const count = typedResult.documents?.length ?? 0;
      resultSummary = count > 0 ? t("referencedDocsCount", { count }) : t("noDocumentsFound");
    } else if (toolName === "memory_read") {
      const typedResult = result as unknown as MemoryReadToolResult;
      resultContent = <MemoryReadResult result={typedResult} />;
      const count = typedResult.memories?.length ?? 0;
      resultSummary = count > 0 ? t("memoriesFoundCount", { count }) : t("noMemoriesFound");
    } else if (toolName === "memory_write") {
      const typedResult = result as unknown as MemoryWriteToolResult;
      resultContent = (
        <MemoryWriteResult
          result={typedResult}
          toolCallId={toolResult.id}
          messageId={messageId}
        />
      );
      resultSummary = typedResult.memoryWriteStatus === "cancelled"
        ? t("memoryCancelled")
        : typedResult.memoryWriteStatus === "saved" || !typedResult.dryRun
          ? t("memorySaved")
          : t("memoryWritePreview");
    } else if (toolName === "task_plan") {
      const typedResult = result as unknown as TaskPlanToolResult;
      resultContent = <TaskPlanResult result={typedResult} onExecutePlan={onExecutePlan} />;
      resultSummary = typedResult.summary ?? typedResult.objective ?? null;
    }
  }

  const hasDetails = resultContent !== null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      <button
        type="button"
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-xs w-full text-left",
          hasDetails && "cursor-pointer hover:bg-muted/50 transition-colors",
        )}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        <ToolIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium text-foreground">{displayName}</span>
        {(toolResult.duplicateCount ?? 1) > 1 && (
          <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {t("toolRepeated", { count: toolResult.duplicateCount ?? 1 })}
          </span>
        )}
        {isRunning && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        {isCompleted && <Check className="h-3 w-3 text-green-600 dark:text-green-400 ml-1" />}
        {resultSummary && !expanded && (
          <span className="text-muted-foreground truncate ml-1">{resultSummary}</span>
        )}
        {hasDetails && (
          expanded
            ? <ChevronUp className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
            : <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
        )}
      </button>
      {expanded && resultContent && (
        <div className="border-t border-border px-2 py-1.5">
          {resultContent}
        </div>
      )}
    </div>
  );
}
