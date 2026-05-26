export type OutputFormat = "json" | "pretty" | "table" | "ndjson" | "markdown";

export type CliConfig = {
  apiUrl?: string;
  token?: string;
};

export type ParsedArgs = {
  positionals: string[];
  options: Record<string, string | boolean>;
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
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
  scopes: string[];
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number | null;
  revokedAt: number | null;
};
