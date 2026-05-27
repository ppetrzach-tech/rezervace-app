import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || session.user.role !== "owner") {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }
  const tenantId = session.user.tenantId;
  const listing = await prisma.eventListing.findFirst({
    where: { id: params.id, tenantId },
  });
  if (!listing) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatné JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Neplatná data" }, { status: 400 });

  const slot = await prisma.eventSlot.create({
    data: {
      listingId: listing.id,
      startsAt: new Date(parsed.data.startsAt),
      endsAt: new Date(parsed.data.endsAt),
    },
  });
  return NextResponse.json({ ok: true, id: slot.id });
}
