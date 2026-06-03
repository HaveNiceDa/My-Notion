export type OutputFormat = "json" | "pretty" | "table" | "ndjson" | "markdown";

export type CliConfigV1 = {
  apiUrl?: string;
  token?: string;
};

export type AuthMethod = "legacy-token" | "device";

export type CliProfileConfig = {
  apiUrl?: string;
  webUrl?: string;
  token?: string;
  tokenPrefix?: string;
  scopes?: string[];
  expiresAt?: number | null;
  authMethod?: AuthMethod;
  updatedAt?: number;
};

export type CliConfigV2 = {
  version: 2;
  activeProfile?: string;
  profiles: Record<string, CliProfileConfig>;
};

export type CliConfig = CliConfigV1 | CliConfigV2;

export type ResolvedProfile = {
  name: string;
  apiUrl: string;
  webUrl: string;
  token?: string;
  tokenPrefix?: string;
  scopes?: string[];
  expiresAt?: number | null;
  authMethod?: AuthMethod;
};

export type ParsedArgs = {
  positionals: string[];
  options: Record<string, string | boolean>;
};

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

export type WhiteboardResult = {
  id: string;
  title: string;
  documentId?: string;
  engine: "excalidraw";
  sceneJson: string;
  thumbnailDataUrl?: string;
  sourceDsl?: string;
  sourceDslVersion?: "mwb-dsl-v1";
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
};

export type WhiteboardExportResult = {
  id: string;
  title: string;
  format: "json" | "svg";
  content: string;
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

export type DeviceAuthorizationStartResult = {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresAt: number;
  intervalSeconds: number;
};

export type DeviceAuthorizationPollResult =
  | {
      status: "pending";
      intervalSeconds?: number;
      expiresAt?: number;
    }
  | {
      status: "approved";
      token: string;
      tokenPrefix: string;
      scopes: string[];
      expiresAt: number | null;
    };
