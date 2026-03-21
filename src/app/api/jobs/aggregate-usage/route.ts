import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { run as aggregateApi } from "../../../../../jobs/aggregateDailyApiUsage";
import { run as aggregateStorage } from "../../../../../jobs/aggregateDailyStorageUsage";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return fail("Unauthorized", 401);
  }

  await aggregateApi();
  await aggregateStorage();

  return ok({ success: true });
}
