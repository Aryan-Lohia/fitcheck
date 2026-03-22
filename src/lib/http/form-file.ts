/**
 * Next.js `request.formData()` may yield `File` or `Blob` depending on runtime.
 */
export function getBlobAndNameFromFormData(
  form: FormData,
  fieldName: string,
): { blob: Blob; fileName: string } | null {
  const entry = form.get(fieldName);
  if (!entry || typeof entry === "string") return null;
  if (entry instanceof Blob) {
    const fileName =
      entry instanceof File && entry.name.trim() ? entry.name : "upload.jpg";
    return { blob: entry, fileName };
  }
  return null;
}
