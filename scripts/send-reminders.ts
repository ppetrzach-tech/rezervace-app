/**
 * Standalone skript pro odesílání připomínek.
 * Spuštění: `npm run reminders`
 * Lze pustit z lokálního crontabu, např.: `0 * * * * cd /cesta/k/app && npm run reminders`
 *
 * Alternativa k HTTP endpointu /api/cron/reminders pro nasazení mimo Vercel.
 */
import { addHours } from "date-fns";
import { PrismaClient } from "@prisma/client";
import { sendReminderEmail } from "../src/lib/email";
import { sendReminderSms } from "../src/lib/sms";

const prisma = new PrismaClient();

async function main() {
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

  console.log(`Připomínek ke zpracování: ${bookings.length}`);

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
    const smsRes = await sendReminderSms({
      clientName: b.client.name,
      clientPhone: b.client.phone,
      serviceName: b.service.name,
      providerName: b.provider.name,
      startsAt: b.startsAt,
    });
    await prisma.booking.update({
      where: { id: b.id },
      data: { reminderSentAt: new Date() },
    });
    console.log(
      `→ ${b.id}: email=${emailRes.ok ? "✓" : "✗"} sms=${smsRes.ok ? "✓" : "✗"}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
