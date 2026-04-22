/** 允许上传的图片 MIME 类型 */
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

/** 允许的图片类型联合 */
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/** 文件校验结果 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/** 平台无关的文件接口，兼容浏览器 File 和 RN 文件对象 */
export interface FileLike {
  type: string;
  name: string;
}

/** 校验单个文件是否为允许的图片类型 */
export const validateImageFile = (
  file: FileLike,
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

/** 批量校验文件列表，返回合法文件和非法文件名 */
export function validateFiles<T extends FileLike>(
  files: T[],
  errorMessage: string,
): { validFiles: T[]; invalidFiles: string[] } {
  const validFiles: T[] = [];
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
}
