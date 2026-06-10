import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Jednorázová úprava: doplní odkaz na nabídkový formulář do po-prohlídkových
 * e-mailových šablon (offset > 0), kde zatím chybí. NEMaže — jen vloží blok
 * před podpis (nebo na konec, když podpis nenajde). Idempotentní.
 *
 * GET /api/seed/add-offer-link?secret=<SEED_SECRET>&tenant=<slug>
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
  const tenantSlug = searchParams.get("tenant") ?? "salon-krasy";
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    return NextResponse.json({ error: `Tenant ${tenantSlug} nenalezen` }, { status: 404 });
  }

  const offerBlock =
    "A pokud jste se rozhodli, můžete rovnou poslat svou cenovou nabídku:\n\n[📝 Otevřít nabídkový formulář]({{offer_form_url}})\n\n";

  const rules = await prisma.notificationRule.findMany({
    where: { tenantId: tenant.id, channel: "email", offsetMinutes: { gt: 0 } },
  });

  const changed: string[] = [];
  for (const r of rules) {
    if (r.body.includes("offer_form_url") || r.body.includes("nabídkový formulář")) {
      continue; // už tam je
    }
    let newBody: string;
    const sigMatch = r.body.match(/\n(Děkuji[^\n]*|Přeji[^\n]*|S pozdravem[^\n]*)\n/);
    if (sigMatch && sigMatch.index !== undefined) {
      const at = sigMatch.index + 1; // za prvním \n
      newBody = r.body.slice(0, at) + offerBlock + r.body.slice(at);
    } else {
      newBody = r.body.trimEnd() + "\n\n" + offerBlock.trimEnd();
    }
    await prisma.notificationRule.update({
      where: { id: r.id },
      data: { body: newBody },
    });
    changed.push(r.name);
  }

  return NextResponse.json({
    ok: true,
    tenant: { slug: tenant.slug, name: tenant.name },
    updated: changed.length,
    changed,
  });
}
