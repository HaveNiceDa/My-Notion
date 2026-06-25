export type ApiSuccess<T> = {
  success: true;
  data: T;
  requestId?: string;
};

export type ApiFailure = {
  success: false;
  requestId?: string;
  error?: {
    code?: string;
    message?: string;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type DocumentResult = {
  id: string;
  title: string;
  content: string;
  contentMarkdown: string;
  contentFormat: string;
  isArchived: boolean;
  isPublished: boolean;
  isInKnowledgeBase: boolean;
  lastEditedTime: number | null;
};

export type ApiTokenResult = {
  id: string;
  name: string;
  tokenPrefix: string;
  token?: string | null;
  scopes: string[];
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number | null;
  revokedAt: number | null;
};

export type ToolTextContent = {
  type: "text";
  text: string;
};

export type AgentToolResult = {
  content: ToolTextContent[];
  structuredContent: Record<string, unknown>;
  isError?: boolean;
};

export type AgentToolContext = {
  client: {
    searchDocuments(input: { query?: string; limit?: number }): Promise<{ documents: DocumentResult[] }>;
    fetchDocument(documentId: string): Promise<DocumentResult>;
    createDocument(input: { title: string; contentMarkdown?: string }): Promise<DocumentResult>;
    updateDocument(input: {
      id: string;
      title?: string;
      contentMarkdown?: string;
      mode?: "overwrite" | "append";
    }): Promise<DocumentResult>;
  };
};

export type ToolSafety = "read_only" | "dry_run_default";

export type ToolManifestEntry = {
  name: string;
  title: string;
  description: string;
  safety: ToolSafety;
  inputSchema: Record<string, unknown>;
  example: Record<string, unknown>;
};
