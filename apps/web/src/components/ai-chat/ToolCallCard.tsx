"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { BookOpen, FileText, Globe, Loader2, Check } from "lucide-react";
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

function WebSearchResult({ result }: { result: { query?: string; strategy?: string; content?: string; error?: string } }) {
  const t = useTranslations("AI");

  if (result.error) {
    return <span className="text-destructive text-xs">{result.error}</span>;
  }

  return (
    <span className="text-muted-foreground text-xs">
      {t("searchedFor")}: {result.query}
    </span>
  );
}

export function ToolCallCard({ toolResult }: ToolCallCardProps) {
  const t = useTranslations("AI");
  const isCompleted = toolResult.status === "completed";
  const isRunning = toolResult.status === "calling" || toolResult.status === "executing";

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
  if (isCompleted && toolResult.result) {
    const result = toolResult.result as Record<string, unknown>;
    if (toolName === "knowledge_search") {
      resultContent = <KnowledgeSearchResult result={result as unknown as { query?: string; documents?: KnowledgeSearchDoc[]; error?: string }} />;
    } else if (toolName === "document_read") {
      resultContent = <DocumentReadResult result={result as unknown as { document?: { id: string; title: string } }} />;
    } else if (toolName === "web_search") {
      resultContent = <WebSearchResult result={result as unknown as { query?: string; strategy?: string; content?: string; error?: string }} />;
    }
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 text-xs">
        <ToolIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium text-foreground">{displayName}</span>
        {isRunning && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
        {isCompleted && <Check className="h-3 w-3 text-green-600 dark:text-green-400 ml-auto" />}
      </div>
      {resultContent && (
        <div className="border-t border-border px-2 py-1.5">
          {resultContent}
        </div>
      )}
    </div>
  );
}
