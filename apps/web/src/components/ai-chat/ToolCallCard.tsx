"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { BookOpen, FileText, Globe, Loader2, Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@notion/business/utils";
import type { ToolCallResult, KnowledgeSearchDoc } from "./types";

interface ToolCallCardProps {
  toolResult: ToolCallResult;
}

function getDocumentUrl(documentId: string): string {
  if (typeof window !== "undefined") {
    const locale = window.location.pathname.split("/")[1] || "zh-CN";
    return `/${locale}/documents/${documentId}`;
  }
  return `/documents/${documentId}`;
}

function KnowledgeSearchResult({ result }: { result: { query?: string; documents?: KnowledgeSearchDoc[]; error?: string } }) {
  const t = useTranslations("AI");
  const docs = result.documents ?? [];

  if (result.error) {
    return <span className="text-destructive text-xs">{result.error}</span>;
  }

  if (docs.length === 0) {
    return <span className="text-muted-foreground text-xs">{t("noDocumentsFound")}</span>;
  }

  return (
    <div className="space-y-1">
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

export function ToolCallCard({ toolResult }: ToolCallCardProps) {
  const t = useTranslations("AI");
  const isCompleted = toolResult.status === "completed";
  const isRunning = toolResult.status === "calling" || toolResult.status === "executing";
  const [expanded, setExpanded] = useState(false);

  const toolName = toolResult.name;
  const displayName =
    toolName === "knowledge_search"
      ? t("knowledgeSearchTool")
      : toolName === "document_read"
        ? t("documentReadTool")
        : toolName === "web_search"
          ? t("webSearchTool")
          : toolName;

  const ToolIcon =
    toolName === "knowledge_search"
      ? BookOpen
      : toolName === "document_read"
        ? FileText
        : Globe;

  let resultContent: React.ReactNode = null;
  let resultSummary: string | null = null;
  if (isCompleted && toolResult.result) {
    const result = toolResult.result as Record<string, unknown>;
    if (toolName === "knowledge_search") {
      const typedResult = result as unknown as { query?: string; documents?: KnowledgeSearchDoc[]; error?: string };
      resultContent = <KnowledgeSearchResult result={typedResult} />;
      const docCount = typedResult.documents?.length ?? 0;
      resultSummary = docCount > 0 ? t("referencedDocsCount", { count: docCount }) : t("noDocumentsFound");
    } else if (toolName === "document_read") {
      const typedResult = result as unknown as { document?: { id: string; title: string } };
      resultContent = <DocumentReadResult result={typedResult} />;
      resultSummary = typedResult.document?.title ?? null;
    } else if (toolName === "web_search") {
      const typedResult = result as unknown as { query?: string; results?: { title: string; link: string; snippet: string }[]; error?: string };
      resultContent = <WebSearchResult result={typedResult} />;
      resultSummary = typedResult.query ?? null;
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
