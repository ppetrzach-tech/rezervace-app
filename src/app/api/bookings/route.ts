import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addMinutes } from "date-fns";
import { prisma } from "@/lib/db";
import { isSlotStillFree } from "@/lib/slots";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { sendBookingConfirmationSms } from "@/lib/sms";
import { getTenantBySlug } from "@/lib/tenant";

const bodySchema = z.object({
  tenantSlug: z.string().min(1),
  serviceId: z.string().min(1),
  providerId: z.string().min(1),
  startsAt: z.string().datetime(),
  client: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    phone: z.string().min(6).max(30),
    note: z.string().max(500).optional(),
  }),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatné JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Neplatná data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { tenantSlug, serviceId, providerId, startsAt, client } = parsed.data;

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return NextResponse.json({ error: "Tenant nenalezen" }, { status: 404 });

  const service = await prisma.service.findFirst({
    where: { id: serviceId, tenantId: tenant.id, active: true },
  });
  if (!service) {
    return NextResponse.json({ error: "Služba není dostupná" }, { status: 404 });
  }

  const provider = await prisma.provider.findFirst({
    where: { id: providerId, tenantId: tenant.id, active: true },
  });
  if (!provider) {
    return NextResponse.json({ error: "Osoba není dostupná" }, { status: 404 });
  }

  const link = await prisma.serviceProvider.findUnique({
    where: { serviceId_providerId: { serviceId, providerId } },
  });
  if (!link) {
    return NextResponse.json(
      { error: "Tato osoba tuto službu nenabízí" },
      { status: 400 },
    );
  }

  const startsAtDate = new Date(startsAt);
  const endsAtDate = addMinutes(startsAtDate, service.durationMinutes);

  if (startsAtDate.getTime() < Date.now()) {
    return NextResponse.json({ error: "Termín už je v minulosti" }, { status: 400 });
  }

  const free = await isSlotStillFree(providerId, startsAtDate, endsAtDate);
  if (!free) {
    return NextResponse.json(
      { error: "Vybraný termín už není volný. Vyberte prosím jiný." },
      { status: 409 },
    );
  }

  const clientEmail = client.email.toLowerCase().trim();
  const clientPhone = client.phone.replace(/\s+/g, "");

  const clientRecord = await prisma.client.upsert({
    where: {
      tenantId_email_phone: {
        tenantId: tenant.id,
        email: clientEmail,
        phone: clientPhone,
      },
    },
    update: { name: client.name },
    create: {
      tenantId: tenant.id,
      name: client.name,
      email: clientEmail,
      phone: clientPhone,
    },
  });

  const booking = await prisma.booking.create({
    data: {
      tenantId: tenant.id,
      clientId: clientRecord.id,
      serviceId,
      providerId,
      startsAt: startsAtDate,
      endsAt: endsAtDate,
      note: client.note || null,
    },
  });

  const emailRes = await sendBookingConfirmationEmail({
    clientName: clientRecord.name,
    clientEmail: clientRecord.email,
    serviceName: service.name,
    providerName: provider.name,
    startsAt: startsAtDate,
    durationMinutes: service.durationMinutes,
    priceCzk: service.priceCzk,
    showPrice: service.showPrice,
    locationType: service.locationType,
    locationDetail: service.locationDetail,
    note: booking.note,
    bookingId: booking.id,
    businessName: tenant.name,
  });

  const smsRes = await sendBookingConfirmationSms({
    clientName: clientRecord.name,
    clientPhone: clientRecord.phone,
    serviceName: service.name,
    providerName: provider.name,
    startsAt: startsAtDate,
  });

  return NextResponse.json({
    bookingId: booking.id,
    emailSent: emailRes.ok,
    smsSent: smsRes.ok,
  });
}
