// Browser-side image preparation before upload.
//
// Why: production serverless requests cap at ~4.5 MB, and the server's sharp
// build cannot decode HEIC (iPhone default). Re-encoding in the browser to a
// bounded JPEG solves both: Safari decodes HEIC natively, and a 2000px JPEG
// is well under the body limit. If the browser can't decode the file, we
// send the original and let the server report a per-file error.

const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 0.85;
// Below this size, re-encoding buys nothing.
const SKIP_UNDER_BYTES = 1.5 * 1024 * 1024;

export async function prepareImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  const isHeic = /heic|heif/i.test(file.type) || /\.heic$|\.heif$/i.test(file.name);

  if (file.size < SKIP_UNDER_BYTES && !isHeic) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );

    if (!blob || blob.size === 0) {
      return file;
    }

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}
