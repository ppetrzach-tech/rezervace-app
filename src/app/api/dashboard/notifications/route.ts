import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManage } from "@/lib/perms";

const schema = z.object({
  name: z.string().min(1).max(120),
  channel: z.enum(["email", "sms"]),
  offsetMinutes: z.number().int().min(-7 * 24 * 60).max(7 * 24 * 60),
  subject: z.string().max(200).optional().default(""),
  body: z.string().min(1).max(4000),
  includeIcs: z.boolean().default(false),
  includeConfirmButton: z.boolean().default(false),
  onlyIfNotConfirmed: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || !canManage(session.user)) {
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
  const data = parsed.data;
  await prisma.notificationRule.create({
    data: {
      tenantId: session.user.tenantId,
      name: data.name,
      channel: data.channel,
      offsetMinutes: data.offsetMinutes,
      subject: data.subject || null,
      body: data.body,
      includeIcs: data.includeIcs,
      includeConfirmButton: data.includeConfirmButton,
      onlyIfNotConfirmed: data.onlyIfNotConfirmed,
      enabled: data.enabled,
    },
  });
  return NextResponse.json({ ok: true });
}
