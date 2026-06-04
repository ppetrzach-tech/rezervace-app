import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManage } from "@/lib/perms";

/**
 * Duplikuje nemovitost — vytvoří kopii se VŠEMI otázkami, odkazy a nastavením.
 * Nekopíruje termíny (sloty) ani rezervace — ty jsou pro každou nemovitost vlastní.
 *
 * POST /api/dashboard/properties/[id]/duplicate
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || !canManage(session.user)) {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }
  const tenantId = session.user.tenantId;

  const src = await prisma.eventListing.findFirst({
    where: { id: params.id, tenantId },
  });
  if (!src) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });

  // Vygenerovat unikátní slug: <slug>-kopie, případně -kopie-2, -3 …
  const baseSlug = `${src.slug}-kopie`.slice(0, 55);
  let slug = baseSlug;
  let n = 2;
  // Najdeme volný slug
  while (
    await prisma.eventListing.findFirst({ where: { tenantId, slug } })
  ) {
    slug = `${baseSlug}-${n}`;
    n++;
    if (n > 50) {
      slug = `${baseSlug}-${Date.now().toString().slice(-5)}`;
      break;
    }
  }

  const copy = await prisma.eventListing.create({
    data: {
      tenantId,
      slug,
      title: `${src.title} (kopie)`,
      description: src.description,
      address: src.address,
      imageUrl: src.imageUrl,
      documentsUrl: src.documentsUrl,
      virtualTourUrl: src.virtualTourUrl,
      propertyWebUrl: src.propertyWebUrl,
      offerFormUrl: src.offerFormUrl,
      durationMinutes: src.durationMinutes,
      providerId: src.providerId,
      formQuestions: src.formQuestions ?? [],
      // Kopie je rovnou aktivní — ale bez termínů, takže se klient zatím neobjedná
      active: src.active,
    },
  });

  return NextResponse.json({ ok: true, id: copy.id });
}
