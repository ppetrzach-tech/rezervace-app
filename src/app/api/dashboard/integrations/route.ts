import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  ownerEmail: z.string().email().or(z.literal("")),
  replyToEmail: z.string().email().or(z.literal("")).optional().default(""),
  googleCalendarId: z.string().max(200).default(""),
  googleTimezone: z.string().max(60).default("Europe/Prague"),
});

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || session.user.role !== "owner") {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatné JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
  }
  await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: {
      ownerEmail: parsed.data.ownerEmail || null,
      replyToEmail: parsed.data.replyToEmail || null,
      googleCalendarId: parsed.data.googleCalendarId || null,
      googleTimezone: parsed.data.googleTimezone || "Europe/Prague",
    },
  });
  return NextResponse.json({ ok: true });
}
