import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/http";
import { run as sendReminders } from "../../../../../jobs/sendBookingReminders";
import { run as retryEmails } from "../../../../../jobs/retryFailedEmails";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return fail("Unauthorized", 401);
  }

  await sendReminders();
  await retryEmails();

  return ok({ success: true });
}
