import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";

export type InlineImageUploadErrorCode =
  | "permission_denied"
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
  return Constants.expoConfig?.extra?.webUrl ?? "https://notion-j9zj.vercel.app";
}

export interface UploadResult {
  url: string;
}

export async function uploadFileToEdgeStore(
  uri: string,
  mimeType: string,
  fileName: string,
): Promise<UploadResult> {
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
  let response: Response;
  try {
    response = await fetch(uploadUrl, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    throw new InlineImageUploadError(
      "upload_failed",
      error instanceof Error ? error.message : "Upload request failed",
    );
  }

  if (!response.ok) {
    throw new InlineImageUploadError(
      "upload_failed",
      `Upload failed: ${response.status}`,
    );
  }

  const { url } = await response.json();
  if (!url) {
    throw new InlineImageUploadError(
      "invalid_response",
      "Missing url in upload response",
    );
  }

  return { url };
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
