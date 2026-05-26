import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAvailableSlots } from "@/lib/slots";
import { getTenantBySlug } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantSlug = searchParams.get("tenantSlug");
  const serviceId = searchParams.get("serviceId");
  const providerId = searchParams.get("providerId");
  const dateStr = searchParams.get("date");

  if (!tenantSlug || !serviceId || !providerId || !dateStr) {
    return NextResponse.json(
      { error: "tenantSlug, serviceId, providerId, date jsou povinné" },
      { status: 400 },
    );
  }

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return NextResponse.json({ error: "Tenant nenalezen" }, { status: 404 });

  const service = await prisma.service.findFirst({
    where: { id: serviceId, tenantId: tenant.id },
  });
  if (!service) {
    return NextResponse.json({ error: "Služba nenalezena" }, { status: 404 });
  }

  const provider = await prisma.provider.findFirst({
    where: { id: providerId, tenantId: tenant.id },
  });
  if (!provider) {
    return NextResponse.json({ error: "Osoba nenalezena" }, { status: 404 });
  }

  const date = new Date(`${dateStr}T00:00:00`);
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "Neplatné datum" }, { status: 400 });
  }

  const slots = await getAvailableSlots(
    providerId,
    service.durationMinutes,
    date,
    service.bufferBeforeMin,
    service.bufferAfterMin,
  );
  return NextResponse.json({
    slots: slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() })),
  });
}
