import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAvailableSlots } from "@/lib/slots";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const serviceId = searchParams.get("serviceId");
  const providerId = searchParams.get("providerId");
  const dateStr = searchParams.get("date");

  if (!serviceId || !providerId || !dateStr) {
    return NextResponse.json(
      { error: "serviceId, providerId, date jsou povinné" },
      { status: 400 },
    );
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) {
    return NextResponse.json({ error: "Služba nenalezena" }, { status: 404 });
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
