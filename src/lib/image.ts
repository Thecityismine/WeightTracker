"use client";

/**
 * Downscale a photo before sending it to the label scanner.
 *
 * A modern phone camera produces 3–8 MB JPEGs. Base64 inflates that by a
 * third, which blows past the serverless request body limit and wastes vision
 * tokens on detail no label needs. 1600px on the long edge keeps small print
 * readable at a fraction of the size.
 */
export async function downscaleImage(
  file: File,
  maxEdge = 1600,
  quality = 0.85,
): Promise<{ base64: string; mediaType: "image/jpeg" }> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process that photo.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const base64 = dataUrl.split(",")[1] ?? "";
  if (!base64) throw new Error("Could not process that photo.");

  return { base64, mediaType: "image/jpeg" };
}
