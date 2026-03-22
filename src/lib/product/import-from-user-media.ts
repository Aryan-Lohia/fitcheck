import { prisma } from "@/lib/prisma/client";
import { PARSER_VERSION } from "@/lib/scraper/parser-version";

const PLACEHOLDER_IMAGE_URL = "https://local.invalid/fitcheck-user-product";

/** Minimal normalized product for fit engine when only an image is available. */
const EMPTY_NORMALIZED = {
  title: "Uploaded product",
  brand: "",
  measurements: {} as Record<string, number | undefined>,
  variants: { size: [] as string[], color: [] as string[] },
  sizeChart: [] as { size: string; measurements: Record<string, number> }[],
  images: [] as string[],
};

/**
 * Creates a ProductImport backed by the user's vault image (S3) for try-on / weak fit check.
 */
export async function createProductImportFromUserMedia(params: {
  userId: string;
  mediaId: string;
  titleHint?: string;
}): Promise<{ productImportId: string }> {
  const media = await prisma.userMedia.findFirst({
    where: {
      id: params.mediaId,
      userId: params.userId,
      isDeleted: false,
      mimeType: { startsWith: "image/" },
    },
  });
  if (!media) {
    throw new Error("Product image not found or not an image");
  }

  const title =
    params.titleHint?.trim() ||
    media.fileName.replace(/\.[^.]+$/, "") ||
    "Uploaded product";

  const normalized = {
    ...EMPTY_NORMALIZED,
    title,
    images: [PLACEHOLDER_IMAGE_URL],
  };

  const record = await prisma.productImport.create({
    data: {
      userId: params.userId,
      sourceUrl: `upload://${media.id}`,
      domainType: "upload",
      title,
      brand: null,
      price: null,
      rawHtmlHash: null,
      normalizedJson: JSON.parse(JSON.stringify(normalized)),
      parserVersion: PARSER_VERSION,
      images: {
        create: {
          imageUrl: PLACEHOLDER_IMAGE_URL,
          sourceType: "upload",
          s3Key: media.s3Key,
        },
      },
    },
  });

  return { productImportId: record.id };
}
