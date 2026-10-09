const ALLOWED_SOURCE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export class MediaPreparationError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function fitDimensions(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  const ratio = Math.min(maxDimension / width, maxDimension / height);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio))
  };
}

function canvasBlob(
  bitmap: ImageBitmap,
  maxDimension: number,
  quality: number
): Promise<Blob> {
  const size = fitDimensions(bitmap.width, bitmap.height, maxDimension);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw new MediaPreparationError("MEDIA_CANVAS_UNAVAILABLE");
  }

  context.drawImage(bitmap, 0, 0, size.width, size.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new MediaPreparationError("MEDIA_ENCODING_FAILED"));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality
    );
  });
}

export async function prepareImageForUpload(file: File): Promise<Blob> {
  if (!ALLOWED_SOURCE_TYPES.has(file.type)) {
    throw new MediaPreparationError("UNSUPPORTED_MEDIA_TYPE");
  }
  if (file.size <= 0 || file.size > MAX_SOURCE_BYTES) {
    throw new MediaPreparationError("MEDIA_SOURCE_TOO_LARGE");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new MediaPreparationError("INVALID_IMAGE");
  }

  try {
    if (
      bitmap.width < 1 ||
      bitmap.height < 1 ||
      bitmap.width > 12000 ||
      bitmap.height > 12000
    ) {
      throw new MediaPreparationError("INVALID_IMAGE_DIMENSIONS");
    }

    const first = await canvasBlob(bitmap, 1600, 0.82);
    if (first.size <= MAX_UPLOAD_BYTES) return first;

    const second = await canvasBlob(bitmap, 1200, 0.72);
    if (second.size <= MAX_UPLOAD_BYTES) return second;

    throw new MediaPreparationError("MEDIA_TOO_LARGE");
  } finally {
    bitmap.close();
  }
}
