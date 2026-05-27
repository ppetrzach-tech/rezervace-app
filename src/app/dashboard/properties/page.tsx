import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { CopyButton } from "../CopyButton";

export const dynamic = "force-dynamic";

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
        <div className="card text-center py-12">
          <div className="text-5xl mb-3">🏠</div>
          <h3 className="text-xl font-semibold mb-2">
            Začněte první nemovitostí
          </h3>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            Vytvořte stránku pro byt/dům, přidejte termíny prohlídek a vlastní otázky.
            Pak pošlete odkaz klientům.
          </p>
          <Link href="/dashboard/properties/new" className="btn-primary inline-block">
            + Nová nemovitost
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {listings.map((l) => {
            const url = `${baseUrl}/${tenant.slug}/p/${l.slug}`;
            const nextSlot = l.slots[0];
            return (
              <div key={l.id} className="card hover:shadow-md transition">
                <div className="flex justify-between items-start mb-2">
                  <Link
                    href={`/dashboard/properties/${l.id}`}
                    className="flex-1 min-w-0"
                  >
                    <h3 className="font-semibold text-lg leading-tight hover:text-brand-700">
                      {l.title}
                    </h3>
                    {l.address && (
                      <p className="text-sm text-slate-500 mt-0.5 truncate">
                        📍 {l.address}
                      </p>
                    )}
                  </Link>
                  {!l.active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 shrink-0">
                      neaktivní
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-500 flex flex-wrap gap-3 mt-3">
                  <span>⏱ {l.durationMinutes} min</span>
                  <span>📅 {l._count.bookings} rezervací</span>
                  {nextSlot ? (
                    <span className="text-brand-700">
                      Nejbližší volný:{" "}
                      {format(nextSlot.startsAt, "d. M. HH:mm", { locale: cs })}
                    </span>
                  ) : (
                    <span className="text-orange-600">⚠ žádné volné sloty</span>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <Link
                    href={`/dashboard/properties/${l.id}`}
                    className="btn-secondary text-xs flex-1 justify-center"
                  >
                    Upravit
                  </Link>
                  <CopyButton text={url} label="📋 Kopírovat odkaz" />
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
