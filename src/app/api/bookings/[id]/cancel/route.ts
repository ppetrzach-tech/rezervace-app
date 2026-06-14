import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteCalendarEvent } from "@/lib/google-calendar";
import { canManage } from "@/lib/perms";
import { sendBookingChangeEmailToClient } from "@/lib/booking-client-email";

const schema = z.object({ action: z.enum(["cancel", "reschedule"]).optional() });

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }

  let parsedBody: unknown = {};
  try {
    parsedBody = await req.json();
  } catch {
    /* prázdné tělo = výchozí "cancel" */
  }
  const p = schema.safeParse(parsedBody);
  const action = (p.success && p.data.action) || "cancel";

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      service: true,
      provider: true,
      listing: true,
      tenant: true,
    },
  });
  if (!booking) {
    return NextResponse.json({ error: "Rezervace neexistuje" }, { status: 404 });
  }
  if (booking.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }

  // Owner i manažer (staff bez providerId) smí rušit vše;
  // staff vázaný na providera jen své rezervace.
  const providerId = session.user.providerId;
  if (!canManage(session.user) && booking.providerId !== providerId) {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }

  // Zrušíme rezervaci, uvolníme slot (může se znovu rezervovat) a zastavíme
  // další automatické emaily k této rezervaci.
  await prisma.booking.update({
    where: { id: params.id },
    data: { status: "cancelled", eventSlotId: null, emailingStopped: true },
  });

  // Smažeme i událost v Google Calendar (pokud byla vytvořena)
  if (booking.googleEventId && booking.tenant.googleCalendarId) {
    const res = await deleteCalendarEvent(
      booking.tenant.googleCalendarId,
      booking.googleEventId,
    );
    if (!res.ok) {
      console.warn("[cancel] Google Calendar delete failed:", res.error);
    }
  }

  // E-mail klientovi (zrušení / výzva k přeplánování)
  let clientEmailed = false;
  try {
    const logId = randomUUID();
    const r = await sendBookingChangeEmailToClient(booking, action, logId);
    clientEmailed = r.ok;
    await prisma.notificationLog
      .create({
        data: {
          id: logId,
          bookingId: booking.id,
          ruleId: null,
          channel: "email",
          label:
            action === "reschedule"
              ? "🔄 Přeplánování — e-mail klientovi"
              : "❌ Zrušení — e-mail klientovi",
          status: r.ok ? "sent" : "failed",
          error: r.error ?? null,
        },
      })
      .catch(() => {});
  } catch (e) {
    console.warn("[cancel] client email failed:", e);
  }

  return NextResponse.json({ ok: true, action, clientEmailed });
}
