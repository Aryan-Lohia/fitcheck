import { prisma } from "@/lib/prisma/client";
import { sendEmail } from "@/lib/email/sender";
import { bookingReminder } from "@/lib/email/templates/bookingReminder";

export async function run() {
  const now = new Date();
  const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

  const upcoming = await prisma.bookingRequest.findMany({
    where: {
      status: "meeting_link_sent",
      preferredTime: { lte: oneHourFromNow, gte: now },
    },
    include: { user: true },
  });

  for (const b of upcoming) {
    const tmpl = bookingReminder({
      name: b.user.name,
      topic: b.topic,
      meetingLink: b.meetingLink || "",
      time: b.preferredTime?.toISOString() || "",
    });

    await sendEmail(b.user.email, tmpl.subject, tmpl.html, tmpl.text);
  }

  console.log(`sendBookingReminders: sent ${upcoming.length} reminders`);
}
