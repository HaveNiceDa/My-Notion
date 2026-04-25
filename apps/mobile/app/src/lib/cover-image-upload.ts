import * as ImagePicker from "expo-image-picker";

import type {
  CoverImageUploadParams,
} from "@notion/business/validation";

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
