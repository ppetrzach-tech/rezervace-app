import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManage } from "@/lib/perms";

/**
 * Nahrání fotky přímo z prohlížeče do Vercel Blob (client upload).
 * Prohlížeč posílá soubor rovnou do úložiště — tenhle route jen vystaví
 * krátkodobý token po ověření přihlášení (obchází 4,5 MB limit serverless
 * funkce, takže projdou i velké fotky z mobilu).
 *
 * Vyžaduje úložiště Vercel Blob (env BLOB_READ_WRITE_TOKEN). Když chybí,
 * vrátí srozumitelnou chybu a nic jiného v aplikaci to neovlivní.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Úložiště fotek zatím není nastavené (Vercel Blob). Vytvořte ho v nastavení projektu.",
      },
      { status: 503 },
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Neplatný požadavek" }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        // Nahrávat smí jen přihlášený správce daného účtu.
        const session = await getServerSession(authOptions);
        if (!session?.user?.tenantId || !canManage(session.user)) {
          throw new Error("Bez oprávnění");
        }
        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
          ],
          maximumSizeInBytes: 15 * 1024 * 1024,
          tokenPayload: JSON.stringify({ tenantId: session.user.tenantId }),
        };
      },
      // URL si klient vezme přímo z výsledku upload() — tady nic dělat nemusíme.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Nahrání selhalo" },
      { status: 400 },
    );
  }
}
