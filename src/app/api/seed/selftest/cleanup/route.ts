import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Smaže testovací tenant 'selftest'. GET /api/seed/selftest/cleanup?secret=... */
export async function GET(req: NextRequest) {
  const seedSecret = process.env.SEED_SECRET;
  if (!seedSecret) {
    return NextResponse.json({ error: "SEED_SECRET není nastaven" }, { status: 503 });
  }
  if (new URL(req.url).searchParams.get("secret") !== seedSecret) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const res = await prisma.tenant.deleteMany({ where: { slug: "selftest" } });
  return NextResponse.json({ ok: true, deleted: res.count });
}
