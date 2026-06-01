import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { testCalendarAccess } from "@/lib/google-calendar";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || session.user.role !== "owner") {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
  });
  if (!tenant?.googleCalendarId) {
    return NextResponse.json({ ok: false, error: "Calendar ID není vyplněn" });
  }
  const result = await testCalendarAccess(tenant.googleCalendarId);
  return NextResponse.json(result);
}
