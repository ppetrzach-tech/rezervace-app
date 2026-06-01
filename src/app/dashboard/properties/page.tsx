import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { CopyButton } from "../CopyButton";
import { ShareButton } from "../ShareModal";

export const dynamic = "force-dynamic";

// Generuj barvu z hashe stringu (pro hezké rozlišení karet)
function hashColor(str: string): { from: string; to: string; emoji: string } {
  const palettes = [
    { from: "from-blue-500", to: "to-indigo-600", emoji: "🏠" },
    { from: "from-purple-500", to: "to-pink-600", emoji: "🏘" },
    { from: "from-emerald-500", to: "to-teal-600", emoji: "🌳" },
    { from: "from-orange-500", to: "to-red-600", emoji: "🏢" },
    { from: "from-cyan-500", to: "to-blue-600", emoji: "🏖" },
    { from: "from-fuchsia-500", to: "to-purple-600", emoji: "🏰" },
    { from: "from-amber-500", to: "to-orange-600", emoji: "🌇" },
    { from: "from-slate-500", to: "to-slate-700", emoji: "🏚" },
  ];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return palettes[h % palettes.length];
}

export default async function PropertiesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/login");

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
  });
  if (!tenant) redirect("/login");

  const listings = await prisma.eventListing.findMany({
    where: { tenantId: tenant.id },
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

  const baseUrl = process.env.NEXTAUTH_URL || "https://rezervace-app.vercel.app";
  const activeCount = listings.filter((l) => l.active).length;

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold">Nemovitosti</h1>
          <p className="text-slate-600 text-sm mt-1">
            {activeCount} {pluralize(activeCount, ["aktivní", "aktivní", "aktivních"])}
            {" · "}
            celkem {listings.length}
          </p>
        </div>
        <Link href="/dashboard/properties/new" className="btn-primary">
          + Nová nemovitost
        </Link>
      </header>

      {listings.length === 0 ? (
        <div className="bg-gradient-to-br from-brand-50 to-white rounded-2xl border-2 border-dashed border-brand-200 text-center py-16 px-6">
          <div className="text-6xl mb-4">🏠</div>
          <h3 className="text-2xl font-semibold mb-2">
            Začněte svou první nemovitostí
          </h3>
          <p className="text-slate-600 mb-6 max-w-md mx-auto">
            Vytvořte stránku pro byt/dům, přidejte termíny prohlídek a vlastní otázky.
            Pak pošlete odkaz klientům.
          </p>
          <Link href="/dashboard/properties/new" className="btn-primary inline-block">
            + Vytvořit první nemovitost
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {listings.map((l) => {
            const url = `${baseUrl}/${tenant.slug}/p/${l.slug}`;
            const nextSlot = l.slots[0];
            const c = hashColor(l.id);
            return (
              <div
                key={l.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-lg transition group"
              >
                {/* Hlavička — foto nebo gradient */}
                <Link
                  href={`/dashboard/properties/${l.id}`}
                  className={`block relative overflow-hidden ${l.imageUrl ? "" : `bg-gradient-to-br ${c.from} ${c.to}`} text-white`}
                >
                  {l.imageUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={l.imageUrl}
                        alt=""
                        className="w-full h-40 object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute inset-0 p-5 flex flex-col justify-end">
                        {!l.active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 backdrop-blur mb-2 inline-block w-fit">
                            neaktivní
                          </span>
                        )}
                        <h3 className="font-bold text-lg leading-tight">
                          {l.title}
                        </h3>
                        {l.address && (
                          <p className="text-sm opacity-90 mt-0.5 truncate">
                            📍 {l.address}
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="p-5">
                      <div className="absolute -right-4 -top-4 text-8xl opacity-20 group-hover:scale-110 transition-transform">
                        {c.emoji}
                      </div>
                      <div className="relative">
                        {!l.active && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 backdrop-blur mb-2 inline-block">
                            neaktivní
                          </span>
                        )}
                        <h3 className="font-bold text-lg leading-tight pr-12">
                          {l.title}
                        </h3>
                        {l.address && (
                          <p className="text-sm opacity-90 mt-0.5 truncate">
                            📍 {l.address}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </Link>

                {/* Body */}
                <div className="p-4 space-y-3">
                  <div className="flex gap-3 text-xs text-slate-600">
                    <span className="bg-slate-50 px-2 py-1 rounded-full">
                      ⏱ {l.durationMinutes} min
                    </span>
                    <span className="bg-slate-50 px-2 py-1 rounded-full">
                      📅 {l._count.bookings}
                    </span>
                    {nextSlot ? (
                      <span className="bg-green-50 text-green-700 px-2 py-1 rounded-full">
                        ✓{" "}
                        {format(nextSlot.startsAt, "d. M. HH:mm", { locale: cs })}
                      </span>
                    ) : (
                      <span className="bg-orange-50 text-orange-700 px-2 py-1 rounded-full">
                        ⚠ bez slotů
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Link
                      href={`/dashboard/properties/${l.id}`}
                      className="btn-secondary text-xs flex-1 justify-center"
                    >
                      Upravit
                    </Link>
                    <CopyButton text={url} label="📋" />
                    <ShareButton url={url} label="📱 QR" title={l.title} />
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

function pluralize(n: number, [a, b, c]: [string, string, string]): string {
  if (n === 1) return a;
  if (n >= 2 && n <= 4) return b;
  return c;
}
