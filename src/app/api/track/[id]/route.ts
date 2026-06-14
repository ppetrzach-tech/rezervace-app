import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// 1×1 průhledný GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

/**
 * Tracking pixel — když klient otevře e-mail, načte se tento obrázek a my
 * zapíšeme čas otevření do NotificationLog. Selhání nikdy neovlivní obrázek.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  prisma.notificationLog
    .updateMany({
      where: { id: params.id, openedAt: null },
      data: { openedAt: new Date() },
    })
    .catch(() => {});

  return new NextResponse(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
