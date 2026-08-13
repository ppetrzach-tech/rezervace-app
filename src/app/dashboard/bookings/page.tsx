import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { startOfDay, addDays } from "date-fns";
import { czTime, czWeekdayDayMonth } from "@/lib/datetime";
import { CancelButton } from "../CancelButton";

export const dynamic = "force-dynamic";

// Kolik rezervací ukázat rovnou; zbytek se schová do rozbalovacího seznamu.
const VISIBLE_COUNT = 3;

type BookingRow = {
  id: string;
  startsAt: Date;
  status: string;
  confirmedByClientAt: Date | null;
  client: { name: string; phone: string; email: string };
  service: { name: string; durationMinutes: number };
  provider: { name: string };
  listing: { title: string; address: string | null } | null;
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/login");

  const tenantId = session.user.tenantId;
  const filter = searchParams.filter ?? "upcoming";
  const isOwner = session.user.role === "owner";

  // owner i asistent (staff bez providerId) vidí vše; staff napojený na providera jen své
  const baseFilter = session.user.providerId
    ? { tenantId, providerId: session.user.providerId }
    : { tenantId };

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
    // Nejaktuálnější první: u nadcházejících nejbližší termín, u minulých nejnovější.
    orderBy: { startsAt: filter === "past" ? "desc" : "asc" },
    take: 100,
  });

  const visible = bookings.slice(0, VISIBLE_COUNT);
  const rest = bookings.slice(VISIBLE_COUNT);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Rezervace</h1>
        <p className="text-slate-600 text-sm mt-1">
          Nejaktuálnější nahoře. Zbytek najdete v rozbalovacím seznamu.
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
        <>
          {/* MOBIL — karty */}
          <div className="space-y-3 sm:hidden">
            {visible.map((b) => (
              <BookingCard key={b.id} b={b} isOwner={isOwner} />
            ))}
            {rest.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer select-none text-sm text-slate-600 bg-white border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between hover:border-brand-500">
                  <span className="font-medium">
                    Zobrazit dalších {rest.length}
                  </span>
                  <span className="text-slate-400 group-open:rotate-180 transition-transform">
                    ▾
                  </span>
                </summary>
                <div className="space-y-3 mt-3">
                  {rest.map((b) => (
                    <BookingCard key={b.id} b={b} isOwner={isOwner} />
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* DESKTOP — tabulka */}
          <div className="hidden sm:block space-y-3">
            <div className="card p-0 overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <BookingTableHead isOwner={isOwner} />
                <tbody>
                  {visible.map((b) => (
                    <BookingTableRow key={b.id} b={b} isOwner={isOwner} />
                  ))}
                </tbody>
              </table>
            </div>
            {rest.length > 0 && (
              <details className="bg-white rounded-xl border border-slate-200 overflow-hidden group">
                <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between hover:bg-slate-50">
                  <span className="font-medium text-slate-700">
                    Zobrazit dalších {rest.length} rezervací
                  </span>
                  <span className="text-slate-400 group-open:rotate-180 transition-transform">
                    ▾
                  </span>
                </summary>
                <div className="overflow-x-auto border-t border-slate-100">
                  <table className="w-full text-sm min-w-[640px]">
                    <BookingTableHead isOwner={isOwner} />
                    <tbody>
                      {rest.map((b) => (
                        <BookingTableRow key={b.id} b={b} isOwner={isOwner} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function BookingCard({ b, isOwner }: { b: BookingRow; isOwner: boolean }) {
  return (
    <div className="card p-4">
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="font-semibold">
            {czWeekdayDayMonth(b.startsAt)} · {czTime(b.startsAt)}
          </div>
          <div className="text-xs text-slate-500">
            {b.service.durationMinutes} min
          </div>
        </div>
        <StatusBadge status={b.status} confirmed={!!b.confirmedByClientAt} />
      </div>

      <div className="mt-3">
        <div className="font-medium">{b.listing?.title || b.service.name}</div>
        {b.listing?.address && (
          <div className="text-xs text-slate-500">{b.listing.address}</div>
        )}
      </div>

      <div className="mt-2 text-sm">
        <div>{b.client.name}</div>
        <div className="text-xs text-slate-500">
          <a href={`tel:${b.client.phone}`} className="text-brand-700">
            {b.client.phone}
          </a>{" "}
          ·{" "}
          <a href={`mailto:${b.client.email}`} className="text-brand-700">
            {b.client.email}
          </a>
        </div>
        {isOwner && (
          <div className="text-xs text-slate-500 mt-0.5">
            Osoba: {b.provider.name}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-slate-100 pt-3">
        <Link
          href={`/dashboard/bookings/${b.id}`}
          className="text-sm text-brand-700 font-medium"
        >
          Detail →
        </Link>
        {b.status !== "cancelled" && <CancelButton bookingId={b.id} />}
      </div>
    </div>
  );
}

function BookingTableHead({ isOwner }: { isOwner: boolean }) {
  return (
    <thead className="bg-slate-50 text-slate-600">
      <tr>
        <th className="text-left p-3">Termín</th>
        <th className="text-left p-3">Klient</th>
        <th className="text-left p-3">Schůzka</th>
        <th className="text-left p-3">Stav</th>
        {isOwner && <th className="text-left p-3">Osoba</th>}
        <th className="p-3"></th>
      </tr>
    </thead>
  );
}

function BookingTableRow({ b, isOwner }: { b: BookingRow; isOwner: boolean }) {
  return (
    <tr className="border-t border-slate-100">
      <td className="p-3">
        <div className="font-medium">{czWeekdayDayMonth(b.startsAt)}</div>
        <div className="text-xs text-slate-500">
          {czTime(b.startsAt)} · {b.service.durationMinutes} min
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
        <StatusBadge status={b.status} confirmed={!!b.confirmedByClientAt} />
      </td>
      {isOwner && <td className="p-3">{b.provider.name}</td>}
      <td className="p-3 text-right whitespace-nowrap">
        <Link
          href={`/dashboard/bookings/${b.id}`}
          className="text-sm text-brand-700 hover:underline mr-3"
        >
          Detail
        </Link>
        {b.status !== "cancelled" && <CancelButton bookingId={b.id} />}
      </td>
    </tr>
  );
}

function StatusBadge({
  status,
  confirmed,
}: {
  status: string;
  confirmed: boolean;
}) {
  if (status === "cancelled") {
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-700 shrink-0">
        zrušeno
      </span>
    );
  }
  if (confirmed) {
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 shrink-0">
        ✓ potvrzeno
      </span>
    );
  }
  return (
    <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500 shrink-0">
      čeká
    </span>
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
