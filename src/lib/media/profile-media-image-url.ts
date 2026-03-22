/**
 * Same-origin optimized image URLs (see GET .../media/[id]/image).
 * Use small presets in lists; use preview/lightbox for modals.
 */
export type ProfileMediaImagePreset =
  | "thumb"
  | "grid"
  | "chatChip"
  | "tryOn"
  | "preview"
  | "lightbox";

const WIDTH: Record<ProfileMediaImagePreset, number> = {
  thumb: 200,
  grid: 340,
  chatChip: 280,
  tryOn: 520,
  preview: 1280,
  lightbox: 1680,
};

const QUALITY: Record<ProfileMediaImagePreset, number> = {
  thumb: 76,
  grid: 78,
  chatChip: 78,
  tryOn: 80,
  preview: 84,
  lightbox: 86,
};

export function profileMediaImageUrl(
  mediaId: string,
  preset: ProfileMediaImagePreset,
): string {
  const w = WIDTH[preset];
  const q = QUALITY[preset];
  return `/api/profile/media/${mediaId}/image?w=${w}&q=${q}`;
}
