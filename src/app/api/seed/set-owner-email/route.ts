import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Nastaví ownerEmail (notifikace o nových rezervacích) a replyToEmail
 * (kam chodí odpovědi klientů) pro daný tenant.
 *
 * GET /api/seed/set-owner-email?secret=<SEED_SECRET>&tenant=rezervace&email=petr.zach@qara.cz
 * Volitelně &replyTo=jina@adresa.cz (jinak = email)
 */
export async function GET(req: NextRequest) {
  const seedSecret = process.env.SEED_SECRET;
  if (!seedSecret) {
    return NextResponse.json({ error: "SEED_SECRET není nastaven" }, { status: 503 });
  }
  const { searchParams } = new URL(req.url);
  if (searchParams.get("secret") !== seedSecret) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const tenantSlug = searchParams.get("tenant") ?? "rezervace";
  const email = searchParams.get("email");
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Chybí platný ?email=" }, { status: 400 });
  }
  const replyTo = searchParams.get("replyTo") || email;

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    return NextResponse.json({ error: `Tenant ${tenantSlug} nenalezen` }, { status: 404 });
  }

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { ownerEmail: email, replyToEmail: replyTo },
  });

  return NextResponse.json({
    ok: true,
    tenant: tenant.slug,
    ownerEmail: email,
    replyToEmail: replyTo,
  });
}
