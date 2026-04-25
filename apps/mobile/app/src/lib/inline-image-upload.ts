import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";

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
  } as any);
  formData.append("extension", extension);
  formData.append("name", fileName);

  const uploadUrl = `${getWebOrigin()}/api/upload-image`;
  const response = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }

  const { url } = await response.json();
  if (!url) {
    throw new Error("Missing url in upload response");
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
    return null;
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
