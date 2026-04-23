import * as ImagePicker from "expo-image-picker";

import type {
  CoverImageUploader,
  CoverImageUploadParams,
  CoverImageUploadResult,
} from "@notion/business/validation";

interface ConvexUploadDeps {
  generateUploadUrl: () => Promise<string>;
}

export class ConvexCoverImageUploader implements CoverImageUploader {
  private deps: ConvexUploadDeps;

  constructor(deps: ConvexUploadDeps) {
    this.deps = deps;
  }

  async upload(params: CoverImageUploadParams): Promise<CoverImageUploadResult> {
    const uploadUrl = await this.deps.generateUploadUrl();
    const fileResponse = await fetch(params.uri);
    const fileBlob = await fileResponse.blob();

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": params.type,
      },
      body: fileBlob,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    const { storageId } = await response.json();
    return { storageId };
  }
}

export async function pickCoverImage(): Promise<CoverImageUploadParams | null> {
  const permissionResult =
    await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permissionResult.granted) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [16, 9],
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
    type: mimeType,
    name: `cover-${Date.now()}.${extension}`,
    size: asset.fileSize,
  };
}
