import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { addDays, format, startOfDay } from "date-fns";
import { cs } from "date-fns/locale";
import { CopyButton } from "./CopyButton";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/login");

  const tenantId = session.user.tenantId;
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) redirect("/login");

  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const weekStart = today;
  const weekEnd = addDays(today, 7);

  const baseFilter =
    session.user.role === "owner"
      ? { tenantId }
      : session.user.providerId
        ? { tenantId, providerId: session.user.providerId }
        : { id: "__nothing__" };

  const [todayBookings, weekBookings, propertiesCount, totalBookings] =
    await Promise.all([
      prisma.booking.findMany({
        where: {
          ...baseFilter,
          status: { not: "cancelled" },
          startsAt: { gte: today, lt: tomorrow },
        },
        include: { client: true, service: true, listing: true, provider: true },
        orderBy: { startsAt: "asc" },
      }),
      prisma.booking.count({
        where: {
          ...baseFilter,
          status: { not: "cancelled" },
          startsAt: { gte: weekStart, lt: weekEnd },
        },
      }),
      prisma.eventListing.count({
        where: { tenantId, active: true },
      }),
      prisma.booking.count({
        where: { ...baseFilter, status: { not: "cancelled" } },
      }),
    ]);

  const confirmedCount = await prisma.booking.count({
    where: {
      ...baseFilter,
      status: { not: "cancelled" },
      startsAt: { gte: now },
      confirmedByClientAt: { not: null },
    },
  });
  const pendingCount = await prisma.booking.count({
    where: {
      ...baseFilter,
      status: { not: "cancelled" },
      startsAt: { gte: now },
      confirmedByClientAt: null,
    },
  });

  const publicUrl = `${process.env.NEXTAUTH_URL || "https://rezervace-app.vercel.app"}/${tenant.slug}`;

  return (
    <div className="space-y-8">
      {/* Hlavička */}
      <header>
        <h1 className="text-3xl font-bold">
          Dobrý {greetingTime()}, {session.user.name?.split(" ")[0] ?? ""} 👋
        </h1>
        <p className="text-slate-600 mt-1">
          {todayBookings.length > 0
            ? `Dnes vás čeká ${todayBookings.length} ${pluralize(todayBookings.length, ["prohlídka", "prohlídky", "prohlídek"])}.`
            : "Dnes nemáte žádné prohlídky."}
        </p>
      </header>

      {/* Statistiky */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Dnes" value={todayBookings.length} accent />
        <StatCard label="Tento týden" value={weekBookings} />
        <StatCard label="Potvrzeno" value={confirmedCount} subtitle="klientem" />
        <StatCard label="Čeká potvrzení" value={pendingCount} subtitle="od klientů" />
      </section>

      {/* Hlavní 2-sloupcový layout */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Dnes — velká karta */}
        <section className="md:col-span-2 card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
            <h2 className="font-semibold">Dnešní prohlídky</h2>
            <Link
              href="/dashboard/bookings"
              className="text-sm text-brand-700 hover:underline"
            >
              Všechny rezervace →
            </Link>
          </div>
          {todayBookings.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              Dnes nic, užijte si volný den ☕
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {todayBookings.map((b) => (
                <li key={b.id} className="px-5 py-3 flex gap-4 items-center">
                  <div className="text-center min-w-[60px]">
                    <div className="font-semibold text-lg leading-tight">
                      {format(b.startsAt, "HH:mm")}
                    </div>
                    <div className="text-xs text-slate-400">
                      {b.service.durationMinutes} min
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {b.listing?.title || b.service.name}
                    </div>
                    <div className="text-sm text-slate-500 truncate">
                      {b.client.name} · {b.client.phone}
                    </div>
                  </div>
                  {b.confirmedByClientAt ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                      ✓ potvrzeno
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">
                      čeká
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Postranní karty */}
        <aside className="space-y-4">
          <div className="card">
            <h3 className="font-semibold mb-2">⚡ Rychlé akce</h3>
            <div className="space-y-2">
              <Link
                href="/dashboard/properties/new"
                className="btn-primary w-full justify-start"
              >
                + Nová nemovitost
              </Link>
              <Link
                href="/dashboard/bookings"
                className="btn-secondary w-full justify-start"
              >
                Zobrazit rezervace
              </Link>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-2">🔗 Váš veřejný odkaz</h3>
            <p className="text-xs text-slate-500 mb-2">
              Sdílejte se zákazníky, aby si rezervovali termín.
            </p>
            <div className="bg-slate-50 rounded-lg p-2 text-xs font-mono break-all border border-slate-200">
              {publicUrl}
            </div>
            <div className="flex gap-2 mt-3">
              <CopyButton text={publicUrl} label="Kopírovat" />
              <Link
                href={`/${tenant.slug}`}
                target="_blank"
                className="btn-secondary text-xs flex-1 justify-center"
              >
                Otevřít ↗
              </Link>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-2">📊 Souhrn</h3>
            <ul className="text-sm space-y-1 text-slate-600">
              <li>
                Aktivních nemovitostí:{" "}
                <strong className="text-slate-900">{propertiesCount}</strong>
              </li>
              <li>
                Celkem rezervací:{" "}
                <strong className="text-slate-900">{totalBookings}</strong>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string;
  value: number;
  subtitle?: string;
  accent?: boolean;
}) {
  return (
    <div className={`card ${accent ? "border-brand-500 bg-brand-50" : ""}`}>
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
    </div>
  );
}

function greetingTime(): string {
  const h = new Date().getHours();
  if (h < 11) return "den";
  if (h < 17) return "den";
  return "večer";
}

function pluralize(n: number, [a, b, c]: [string, string, string]): string {
  if (n === 1) return a;
  if (n >= 2 && n <= 4) return b;
  return c;
}
