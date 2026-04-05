export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export type AllowedImageType = typeof ALLOWED_IMAGE_TYPES[number];

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export const validateImageFile = (
  file: File,
  errorMessage: string,
): FileValidationResult => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as AllowedImageType)) {
    return {
      valid: false,
      error: errorMessage,
    };
  }
  return { valid: true };
};

export const validateFiles = (
  files: File[],
  errorMessage: string,
): { validFiles: File[]; invalidFiles: string[] } => {
  const validFiles: File[] = [];
  const invalidFiles: string[] = [];

  for (const file of files) {
    const validation = validateImageFile(file, errorMessage);
    if (validation.valid) {
      validFiles.push(file);
    } else {
      invalidFiles.push(file.name);
    }
  }

  return { validFiles, invalidFiles };
};
