import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

function previewPayload(data: unknown): string {
  try {
    const serialized = JSON.stringify(
      data,
      (_k, v) => (typeof v === "bigint" ? Number(v) : v),
    );
    return serialized.length > 300 ? `${serialized.slice(0, 300)}...` : serialized;
  } catch {
    return "[unserializable]";
  }
}

export function ok(data: unknown, status = 200) {
  logger.debug("API response", {
    status,
    ok: true,
    payloadPreview: previewPayload(data),
  });
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400) {
  logger.warn("API error response", { status, ok: false, message });
  return NextResponse.json({ error: message }, { status });
}
