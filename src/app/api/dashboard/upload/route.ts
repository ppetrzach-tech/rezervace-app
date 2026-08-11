import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManage } from "@/lib/perms";

export const runtime = "nodejs";

/**
 * Serverové nahrání fotky do Vercel Blob.
 * Prohlížeč pošle už ZMENŠENÝ obrázek (FormData) — díky tomu se vejde pod limit
 * serverless funkce a nahrání je rychlé a spolehlivé (bez křehkého client-upload
 * flow). Vrátí veřejnou URL, kterou uložíme do imageUrl nemovitosti.
 *
 * Vyžaduje úložiště Vercel Blob (BLOB_READ_WRITE_TOKEN). Bez něj vrací 503.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId || !canManage(session.user)) {
    return NextResponse.json({ error: "Bez oprávnění" }, { status: 403 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Úložiště fotek zatím není nastavené (Vercel Blob)." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Neplatný požadavek" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Chybí soubor" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Nahrajte prosím obrázek (JPG, PNG…)." },
      { status: 400 },
    );
  }
  // Po zmenšení v prohlížeči by fotka měla mít < 2 MB; strop je pojistka.
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Fotka je i po zmenšení moc velká. Zkuste jinou." },
      { status: 413 },
    );
  }

  const ext = (file.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "") || "jpg";
  const key = `listings/${session.user.tenantId}/${Date.now()}.${ext}`;

  try {
    const blob = await put(key, file, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: file.type,
      addRandomSuffix: true,
    });
    return NextResponse.json({ ok: true, url: blob.url });
  } catch (err) {
    return NextResponse.json(
      { error: "Nahrání selhalo: " + ((err as Error).message || "chyba úložiště") },
      { status: 500 },
    );
  }
}
