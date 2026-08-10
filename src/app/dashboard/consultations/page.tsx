import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { czDayMonthTime } from "@/lib/datetime";
import { PUBLIC_BASE_URL } from "@/lib/base-url";
import { CopyButton } from "../CopyButton";

export const dynamic = "force-dynamic";

/**
 * Sekce Konzultace — obecné typy schůzek (kind="consultation").
 * Oddělené od Nemovitostí: vlastní termíny, vlastní e-maily (viz appliesToKind).
 * Na property flow se nesahá.
 */
export default async function ConsultationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/login");

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
  });
  if (!tenant) redirect("/login");

  const listings = await prisma.eventListing.findMany({
    where: { tenantId: tenant.id, kind: "consultation" },
    include: {
      _count: { select: { bookings: true } },
      slots: {
        where: { startsAt: { gte: new Date() }, booking: null },
        orderBy: { startsAt: "asc" },
        take: 1,
      },
    },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
  });

  const baseUrl = PUBLIC_BASE_URL;

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold">Konzultace</h1>
          <p className="text-slate-600 text-sm mt-1">
            Obecné schůzky (úvodní konzultace, ocenění…) s vlastními termíny.
            Oddělené od prohlídek nemovitostí.
          </p>
        </div>
        <Link href="/dashboard/consultations/new" className="btn-primary shrink-0">
          + Nová konzultace
        </Link>
      </header>

      {listings.length === 0 ? (
        <div className="bg-gradient-to-br from-brand-50 to-white rounded-2xl border-2 border-dashed border-brand-200 text-center py-16 px-6">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-2xl font-semibold mb-2">Zatím žádná konzultace</h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            Vytvořte typ schůzky (např. „Úvodní konzultace"), přidejte konkrétní
            termíny a pošlete klientům odkaz.
          </p>
          <Link
            href="/dashboard/consultations/new"
            className="btn-primary inline-block"
          >
            + Vytvořit první konzultaci
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {listings.map((l) => {
            const url = `${baseUrl}/${tenant.slug}/p/${l.slug}`;
            const nextSlot = l.slots[0];
            return (
              <div
                key={l.id}
                className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition ${
                  l.active ? "" : "opacity-75"
                }`}
              >
                <Link
                  href={`/dashboard/consultations/${l.id}`}
                  className="block p-5 bg-gradient-to-br from-indigo-500 to-blue-600 text-white"
                >
                  {!l.active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 mb-2 inline-block">
                      neaktivní
                    </span>
                  )}
                  <h3 className="font-bold text-lg leading-tight">{l.title}</h3>
                  {l.address && (
                    <p className="text-sm opacity-90 mt-0.5 truncate">
                      📍 {l.address}
                    </p>
                  )}
                </Link>
                <div className="p-4 space-y-3">
                  <div className="flex gap-3 text-xs text-slate-600 flex-wrap">
                    <span className="bg-slate-50 px-2 py-1 rounded-full">
                      ⏱ {l.durationMinutes} min
                    </span>
                    <span className="bg-slate-50 px-2 py-1 rounded-full">
                      📅 {l._count.bookings}
                    </span>
                    {nextSlot ? (
                      <span className="bg-green-50 text-green-700 px-2 py-1 rounded-full">
                        ✓ {czDayMonthTime(nextSlot.startsAt)}
                      </span>
                    ) : (
                      <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded-full">
                        ⚠ bez termínů
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <Link
                      href={`/dashboard/consultations/${l.id}`}
                      className="btn-secondary text-xs flex-1 justify-center"
                    >
                      Upravit
                    </Link>
                    <CopyButton text={url} label="📋 Odkaz" />
                    <Link
                      href={`/${tenant.slug}/p/${l.slug}`}
                      target="_blank"
                      className="btn-secondary text-xs justify-center"
                      title="Otevřít veřejnou stránku"
                    >
                      ↗
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
