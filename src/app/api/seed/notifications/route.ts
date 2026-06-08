import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Jednorázové nahrání předpřipravených šablon pro makléře.
 * GET /api/seed/notifications?secret=<SEED_SECRET>&tenant=<slug>
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

  // Vymažeme stávající pravidla (idempotentní reset)
  await prisma.notificationRule.deleteMany({ where: { tenantId: tenant.id } });

  // 1) 24h před prohlídkou — potvrzení s odkazy na složku a inzerát
  const before24 = `{{client_greeting}},

tímto potvrzuji prohlídku **{{service_name}}** zítra v {{time}} na adrese **{{location}}**.

Prosím Vás také o potvrzení prohlídky tlačítkem níže.

Prohlídka bude probíhat 20–30 min, abyste měli dostatek času se s nemovitostí seznámit.

Pod tímto odkazem najdete kompletní fotodokumentaci, která se do inzerce nevešla, videoprohlídku nemovitosti, půdorysy, mapy a dokumenty ke stažení (LV, výše záloh): [📂 Otevřít složku s dokumenty]({{documents_url}})

Inzerát na webu: [🌐 Zobrazit nabídku]({{property_web_url}})

Pokud Vás bude cokoliv zajímat, klidně mi napište nebo zavolejte.

Přeji hezký den.

S pozdravem
{{provider_name}}
Tel.: {{business_phone}}`;

  // 2) +10 min po prohlídce — krátké poděkování
  const after10 = `{{client_greeting}},

děkuji Vám za prohlídku **{{service_name}}** na adrese **{{location}}**.

Pokud budete mít jakékoli dotazy nebo zpětnou vazbu, napište mi prosím nebo zavolejte.

Děkuji a přeji hezký den,
{{provider_name}}
Tel.: {{business_phone}}`;

  // 3) +24h po prohlídce — odkaz na nabídkový formulář
  const after24 = `{{client_greeting}},

ještě jednou Vám děkuji za prohlídku **{{service_name}}** na adrese **{{location}}**.

Pokud byste měli o tuto nemovitost zájem, můžete na následujícím odkazu odeslat svou nabídku:

[📝 Otevřít nabídkový formulář]({{offer_form_url}})

Přeji Vám pěkný den,
{{provider_name}}
Tel.: {{business_phone}}`;

  // 4) +48h po prohlídce — připomenutí + virtuální prohlídka
  const after48 = `{{client_greeting}},

předevčírem jsem Vám zasílal e-mail s nabídkovým formulářem. Pokud byste si chtěli nemovitost prohlédnout ještě jednou, napište mi prosím.

Můžete také využít naši virtuální prohlídku na následujícím odkazu, kde si nemovitost projdete znovu odkudkoliv:

- [🎥 Otevřít virtuální prohlídku]({{virtual_tour_url}})

Děkuji a přeji pěkný den,
{{provider_name}}
Tel.: {{business_phone}}`;

  const rules = [
    {
      name: "📧 24 h před prohlídkou (potvrzení)",
      channel: "email",
      offsetMinutes: -24 * 60,
      subject: "Potvrzení prohlídky bytu {{service_name}} zítra v {{time}}",
      body: before24,
      includeIcs: true,
      includeConfirmButton: true,
      onlyIfNotConfirmed: false,
      enabled: true,
    },
    {
      name: "🙏 10 min po prohlídce (poděkování)",
      channel: "email",
      offsetMinutes: 10,
      subject: "Děkuji za Váš čas.",
      body: after10,
      includeIcs: false,
      includeConfirmButton: false,
      onlyIfNotConfirmed: false,
      enabled: true,
    },
    {
      name: "📝 24 h po prohlídce (nabídkový formulář)",
      channel: "email",
      offsetMinutes: 24 * 60,
      subject: "Dejte mi vědět, jak prohlídka {{service_name}} proběhla!",
      body: after24,
      includeIcs: false,
      includeConfirmButton: false,
      onlyIfNotConfirmed: false,
      enabled: true,
    },
    {
      name: "🎥 48 h po prohlídce (virtuální prohlídka)",
      channel: "email",
      offsetMinutes: 48 * 60,
      subject: "Dejte mi vědět, jak prohlídka {{service_name}} proběhla!",
      body: after48,
      includeIcs: false,
      includeConfirmButton: false,
      onlyIfNotConfirmed: false,
      enabled: true,
    },
  ];

  for (const r of rules) {
    await prisma.notificationRule.create({
      data: {
        tenantId: tenant.id,
        ...r,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    tenant: { slug: tenant.slug, name: tenant.name },
    created: rules.length,
    rules: rules.map((r) => ({ name: r.name, offsetMinutes: r.offsetMinutes })),
  });
}
