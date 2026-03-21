type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveLevel(): LogLevel {
  const value = (process.env.BACKEND_LOG_LEVEL || "").toLowerCase();
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

const ACTIVE_LEVEL = resolveLevel();

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_RANK[level] >= LOG_LEVEL_RANK[ACTIVE_LEVEL];
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(
      value,
      (_key, val) => (typeof val === "bigint" ? Number(val) : val),
      2,
    );
  } catch {
    return String(value);
  }
}

function write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;
  const ts = new Date().toISOString();
  const payload = meta ? ` ${safeStringify(meta)}` : "";
  const line = `[${ts}] [${level.toUpperCase()}] ${message}${payload}`;
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    write("debug", message, meta);
  },
  info(message: string, meta?: Record<string, unknown>) {
    write("info", message, meta);
  },
  warn(message: string, meta?: Record<string, unknown>) {
    write("warn", message, meta);
  },
  error(message: string, meta?: Record<string, unknown>) {
    write("error", message, meta);
  },
};

