import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";
import NetInfo from "@react-native-community/netinfo";

export type InlineImageUploadErrorCode =
  | "permission_denied"
  | "network_unavailable"
  | "timeout"
  | "upload_failed"
  | "invalid_response";

export class InlineImageUploadError extends Error {
  code: InlineImageUploadErrorCode;

  constructor(code: InlineImageUploadErrorCode, message: string) {
    super(message);
    this.name = "InlineImageUploadError";
    this.code = code;
  }
}

function getWebOrigin(): string {
  return (
    process.env.EXPO_PUBLIC_WEB_URL ||
    Constants.expoConfig?.extra?.webUrl ||
    "https://notion-j9zj.vercel.app"
  );
}

const UPLOAD_TIMEOUT_MS = 30_000;

export interface UploadResult {
  url: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function assertNetworkAvailable() {
  const state = await NetInfo.fetch();
  if (state.isConnected === false || state.isInternetReachable === false) {
    throw new InlineImageUploadError(
      "network_unavailable",
      "Network is unavailable",
    );
  }
}

export async function uploadFileToEdgeStore(
  uri: string,
  mimeType: string,
  fileName: string,
  authToken?: string | null,
): Promise<UploadResult> {
  await assertNetworkAvailable();

  const extension = mimeType.split("/")[1] || "bin";

  const formData = new FormData();
  formData.append("file", {
    uri,
    type: mimeType,
    name: fileName,
  } as unknown as Blob);
  formData.append("extension", extension);
  formData.append("name", fileName);

  const uploadUrl = `${getWebOrigin()}/api/upload-image`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(uploadUrl, {
      method: "POST",
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      body: formData,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new InlineImageUploadError(
        "timeout",
        "Upload request timed out",
      );
    }
    throw new InlineImageUploadError(
      "upload_failed",
      error instanceof Error ? error.message : "Upload request failed",
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new InlineImageUploadError(
      "upload_failed",
      `Upload failed: ${response.status}`,
    );
  }

  const body: unknown = await response.json().catch(() => null);
  if (!isRecord(body) || typeof body.url !== "string" || body.url.length === 0) {
    throw new InlineImageUploadError(
      "invalid_response",
      "Missing url in upload response",
    );
  }

  return { url: body.url };
}

export async function pickInlineImage(): Promise<{
  uri: string;
  mimeType: string;
  name: string;
  size: number | undefined;
} | null> {
  const permissionResult =
    await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permissionResult.granted) {
    throw new InlineImageUploadError(
      "permission_denied",
      "Media library permission denied",
    );
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: 0.85,
  });

  if (result.canceled || !result.assets?.[0]) {
    return null;
  }

  const asset = result.assets[0];
  const mimeType = asset.mimeType || "image/jpeg";
  const extension = mimeType.split("/")[1] || "jpg";

  return {
    uri: asset.uri,
    mimeType,
    name: `inline-${Date.now()}.${extension}`,
    size: asset.fileSize,
  };
}
