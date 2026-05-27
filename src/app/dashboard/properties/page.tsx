import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/login");

  const tenant = await prisma.tenant.findUnique({ where: { id: session.user.tenantId } });
  if (!tenant) redirect("/login");

  const listings = await prisma.eventListing.findMany({
    where: { tenantId: tenant.id },
    include: {
      _count: { select: { slots: true, bookings: true } },
      slots: {
        where: { startsAt: { gte: new Date() } },
        orderBy: { startsAt: "asc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Nemovitosti / události</h1>
          <p className="text-slate-600 text-sm mt-1">
            Vytvořte si stránku pro každou nemovitost (nebo událost) s vlastními
            termíny a otázkami. Pak pošlete klientovi link.
          </p>
        </div>
        <Link href="/dashboard/properties/new" className="btn-primary">
          + Nová nemovitost
        </Link>
      </div>

      <div className="grid gap-3">
        {listings.map((l) => (
          <div key={l.id} className="card">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg">
                  {l.title}{" "}
                  {!l.active && (
                    <span className="text-xs text-slate-400">(neaktivní)</span>
                  )}
                </h3>
                {l.address && (
                  <p className="text-sm text-slate-600 mt-1">📍 {l.address}</p>
                )}
                {l.description && (
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                    {l.description}
                  </p>
                )}
                <div className="text-xs text-slate-500 mt-2 flex flex-wrap gap-3">
                  <span>⏱ {l.durationMinutes} min</span>
                  <span>📅 {l._count.slots} slotů</span>
                  <span>✅ {l._count.bookings} rezervací</span>
                  {l.slots[0] && (
                    <span>
                      Nejbližší:{" "}
                      {format(l.slots[0].startsAt, "d. M. HH:mm", { locale: cs })}
                    </span>
                  )}
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  Veřejný odkaz:{" "}
                  <Link
                    href={`/${tenant.slug}/p/${l.slug}`}
                    target="_blank"
                    className="text-brand-700 font-mono"
                  >
                    /{tenant.slug}/p/{l.slug}
                  </Link>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link
                  href={`/dashboard/properties/${l.id}`}
                  className="text-sm text-brand-700 hover:underline"
                >
                  Upravit
                </Link>
              </div>
            </div>
          </div>
        ))}
        {listings.length === 0 && (
          <div className="card text-center text-slate-500">
            Žádné nemovitosti. Klikněte „+ Nová nemovitost" výše.
          </div>
        )}
      </div>
    </div>
  );
}
