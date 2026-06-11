import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PUBLIC_BASE_URL } from "@/lib/base-url";
import {
  sendOwnerNewOfferEmail,
  sendOfferConfirmationToClient,
  type OfferEmailData,
} from "@/lib/offer-email";

const schema = z.object({
  tenantSlug: z.string().min(1),
  listingSlug: z.string().optional(),
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(5).max(40),
  amountCzk: z.number().int().positive().max(9_999_999_999),
  financing: z.string().trim().max(100).optional(),
  message: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatné JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Zkontrolujte prosím vyplněná pole — jméno, e-mail, telefon a nabízenou cenu." },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const tenant = await prisma.tenant.findUnique({
    where: { slug: d.tenantSlug },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Stránka nenalezena" }, { status: 404 });
  }

  const listing = d.listingSlug
    ? await prisma.eventListing.findFirst({
        where: { tenantId: tenant.id, slug: d.listingSlug },
      })
    : null;

  const offer = await prisma.offer.create({
    data: {
      tenantId: tenant.id,
      listingId: listing?.id ?? null,
      name: d.name,
      email: d.email.toLowerCase(),
      phone: d.phone,
      amountCzk: d.amountCzk ?? null,
      financing: d.financing || null,
      message: d.message || null,
    },
  });

  const emailData: OfferEmailData = {
    tenantName: tenant.name,
    ownerEmail: tenant.ownerEmail,
    ownerPhone: tenant.ownerPhone,
    replyToEmail: tenant.replyToEmail,
    // V e-mailech používáme ADRESU jako čistý identifikátor nemovitosti
    // (název události může být dlouhý/nehodící se). Fallback na název / firmu.
    listingTitle: listing?.address || listing?.title || tenant.name,
    client: { name: d.name, email: d.email, phone: d.phone },
    amountCzk: d.amountCzk ?? null,
    financing: d.financing || null,
    message: d.message || null,
    dashboardUrl: listing
      ? `${PUBLIC_BASE_URL}/dashboard/properties/${listing.id}`
      : `${PUBLIC_BASE_URL}/dashboard`,
  };

  // E-mail vlastníkovi + potvrzení klientovi (neblokující chyby)
  await Promise.allSettled([
    sendOwnerNewOfferEmail(emailData),
    sendOfferConfirmationToClient(emailData),
  ]);

  return NextResponse.json({ ok: true, offerId: offer.id });
}
