import sharp from "sharp";

export type OptimizedImageResult = {
  buffer: Buffer;
  contentType: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Resize and transcode to WebP for fast UI delivery. GIFs must be handled by the caller.
 */
export async function optimizeProfileMediaImage(
  input: Buffer,
  opts: { maxWidth: number; quality: number },
): Promise<OptimizedImageResult> {
  const maxWidth = clamp(Math.round(opts.maxWidth), 32, 2048);
  const quality = clamp(Math.round(opts.quality), 40, 92);

  const buffer = await sharp(input)
    .rotate()
    .resize({
      width: maxWidth,
      height: maxWidth,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality, effort: 4, alphaQuality: quality })
    .toBuffer();

  return { buffer, contentType: "image/webp" };
}
