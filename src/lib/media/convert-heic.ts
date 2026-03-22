import convert from "heic-convert";

function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  ) as ArrayBuffer;
}

export async function convertHeicBufferToJpeg(
  input: Buffer,
  quality = 0.92,
): Promise<Buffer> {
  const out = await convert({
    buffer: bufferToArrayBuffer(input),
    format: "JPEG",
    quality,
  });
  if (Buffer.isBuffer(out)) return out;
  const ab = out instanceof ArrayBuffer ? out : bufferToArrayBuffer(out as Buffer);
  return Buffer.from(new Uint8Array(ab));
}
