import { NextRequest, NextResponse } from "next/server";
import { addHours } from "date-fns";
import { prisma } from "@/lib/db";
import { sendReminderEmail } from "@/lib/email";
import { sendReminderSms } from "@/lib/sms";

/**
 * Odešle připomínky všem rezervacím začínajícím za 22–26 hodin,
 * kterým ještě nebyla připomínka odeslána.
 *
 * Doporučené spouštění:
 *   - Vercel Cron: 1× za hodinu (`* * * * *` v 0. minutě)
 *   - Nebo lokálně: `npm run reminders` v cronu serveru
 *
 * Pro ochranu před zneužitím vyžaduje header `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
    }
  }

  const now = new Date();
  const windowStart = addHours(now, 22);
  const windowEnd = addHours(now, 26);

  const bookings = await prisma.booking.findMany({
    where: {
      status: "confirmed",
      reminderSentAt: null,
      startsAt: { gte: windowStart, lte: windowEnd },
    },
    include: { client: true, service: true, provider: true },
  });

  let emails = 0;
  let smses = 0;
  for (const b of bookings) {
    const emailRes = await sendReminderEmail({
      clientName: b.client.name,
      clientEmail: b.client.email,
      serviceName: b.service.name,
      providerName: b.provider.name,
      startsAt: b.startsAt,
      durationMinutes: b.service.durationMinutes,
      priceCzk: b.service.priceCzk,
      note: b.note,
      bookingId: b.id,
    });
    if (emailRes.ok) emails++;
    const smsRes = await sendReminderSms({
      clientName: b.client.name,
      clientPhone: b.client.phone,
      serviceName: b.service.name,
      providerName: b.provider.name,
      startsAt: b.startsAt,
    });
    if (smsRes.ok) smses++;
    await prisma.booking.update({
      where: { id: b.id },
      data: { reminderSentAt: new Date() },
    });
  }

  return NextResponse.json({
    processed: bookings.length,
    emailsSent: emails,
    smsSent: smses,
  });
}
