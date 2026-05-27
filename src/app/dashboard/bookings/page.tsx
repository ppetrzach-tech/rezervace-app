import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { format, startOfDay, addDays } from "date-fns";
import { cs } from "date-fns/locale";
import { CancelButton } from "../CancelButton";

export const dynamic = "force-dynamic";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/login");

  const tenantId = session.user.tenantId;
  const filter = searchParams.filter ?? "upcoming";

  const baseFilter =
    session.user.role === "owner"
      ? { tenantId }
      : session.user.providerId
        ? { tenantId, providerId: session.user.providerId }
        : { id: "__nothing__" };

  const now = new Date();
  const today = startOfDay(now);

  let where: Record<string, unknown> = baseFilter;
  if (filter === "today") {
    where = {
      ...baseFilter,
      startsAt: { gte: today, lt: addDays(today, 1) },
      status: { not: "cancelled" },
    };
  } else if (filter === "upcoming") {
    where = {
      ...baseFilter,
      startsAt: { gte: now },
      status: { not: "cancelled" },
    };
  } else if (filter === "past") {
    where = {
      ...baseFilter,
      startsAt: { lt: now },
      status: { not: "cancelled" },
    };
  } else if (filter === "cancelled") {
    where = { ...baseFilter, status: "cancelled" };
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: { client: true, service: true, provider: true, listing: true },
    orderBy: { startsAt: filter === "past" ? "desc" : "asc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Rezervace</h1>
        <p className="text-slate-600 text-sm mt-1">
          Všechny prohlídky a schůzky chronologicky.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <FilterTab href="?filter=today" label="Dnes" active={filter === "today"} />
        <FilterTab
          href="?filter=upcoming"
          label="Nadcházející"
          active={filter === "upcoming"}
        />
        <FilterTab href="?filter=past" label="Minulé" active={filter === "past"} />
        <FilterTab
          href="?filter=cancelled"
          label="Zrušené"
          active={filter === "cancelled"}
        />
      </div>

      {bookings.length === 0 ? (
        <div className="card text-center text-slate-500">Žádné rezervace.</div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left p-3">Termín</th>
                <th className="text-left p-3">Klient</th>
                <th className="text-left p-3">Schůzka</th>
                <th className="text-left p-3">Stav</th>
                {session.user.role === "owner" && (
                  <th className="text-left p-3">Osoba</th>
                )}
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-t border-slate-100">
                  <td className="p-3">
                    <div className="font-medium">
                      {format(b.startsAt, "EEE d. M.", { locale: cs })}
                    </div>
                    <div className="text-xs text-slate-500">
                      {format(b.startsAt, "HH:mm")} ·{" "}
                      {b.service.durationMinutes} min
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{b.client.name}</div>
                    <div className="text-xs text-slate-500">{b.client.phone}</div>
                    <div className="text-xs text-slate-500">{b.client.email}</div>
                  </td>
                  <td className="p-3">
                    <div>{b.listing?.title || b.service.name}</div>
                    {b.listing?.address && (
                      <div className="text-xs text-slate-500">{b.listing.address}</div>
                    )}
                  </td>
                  <td className="p-3">
                    {b.status === "cancelled" ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-700">
                        zrušeno
                      </span>
                    ) : b.confirmedByClientAt ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                        ✓ potvrzeno klientem
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                        čeká
                      </span>
                    )}
                  </td>
                  {session.user.role === "owner" && (
                    <td className="p-3">{b.provider.name}</td>
                  )}
                  <td className="p-3 text-right">
                    {b.status !== "cancelled" && <CancelButton bookingId={b.id} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterTab({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-md text-sm ${
        active
          ? "bg-brand-600 text-white"
          : "bg-white border border-slate-200 text-slate-600 hover:border-brand-500"
      }`}
    >
      {label}
    </Link>
  );
}
