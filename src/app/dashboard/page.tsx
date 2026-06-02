import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { addDays, format, startOfDay, subDays } from "date-fns";
import { cs } from "date-fns/locale";
import { CopyButton } from "./CopyButton";
import { DonutChart, Sparkline, ProgressBar } from "./DashboardWidgets";

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

  // owner i asistent (staff bez providerId) vidí vše; staff napojený na providera jen své
  const baseFilter = session.user.providerId
    ? { tenantId, providerId: session.user.providerId }
    : { tenantId };

  const [
    todayBookings,
    weekBookings,
    propertiesCount,
    totalBookings,
    confirmedCount,
    pendingCount,
    cancelledCount,
    recentActivity,
    last7DaysBookings,
  ] = await Promise.all([
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
    prisma.eventListing.count({ where: { tenantId, active: true } }),
    prisma.booking.count({ where: { ...baseFilter, status: { not: "cancelled" } } }),
    prisma.booking.count({
      where: {
        ...baseFilter,
        status: { not: "cancelled" },
        startsAt: { gte: now },
        confirmedByClientAt: { not: null },
      },
    }),
    prisma.booking.count({
      where: {
        ...baseFilter,
        status: { not: "cancelled" },
        startsAt: { gte: now },
        confirmedByClientAt: null,
      },
    }),
    prisma.booking.count({
      where: { ...baseFilter, status: "cancelled" },
    }),
    prisma.booking.findMany({
      where: baseFilter,
      include: { client: true, listing: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.booking.findMany({
      where: {
        ...baseFilter,
        createdAt: { gte: subDays(today, 7) },
      },
      select: { createdAt: true },
    }),
  ]);

  // Sparkline data: počty rezervací za posledních 7 dní
  const sparklineData: number[] = Array.from({ length: 7 }, (_, i) => {
    const day = subDays(today, 6 - i);
    const nextDay = addDays(day, 1);
    return last7DaysBookings.filter(
      (b) => b.createdAt >= day && b.createdAt < nextDay,
    ).length;
  });

  const publicUrl = `${process.env.NEXTAUTH_URL || "https://rezervace-app.vercel.app"}/${tenant.slug}`;
  const confirmRate = todayBookings.length
    ? Math.round(
        (todayBookings.filter((b) => b.confirmedByClientAt).length /
          todayBookings.length) *
          100,
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* Hlavička */}
      <header className="bg-gradient-to-br from-brand-600 to-brand-700 text-white rounded-2xl p-6 shadow-md">
        <h1 className="text-3xl font-bold">
          Ahoj {session.user.name?.split(" ")[0] ?? ""} 👋
        </h1>
        <p className="opacity-90 mt-1">
          {todayBookings.length > 0
            ? `Dnes vás čeká ${todayBookings.length} ${pluralize(todayBookings.length, ["prohlídka", "prohlídky", "prohlídek"])}.`
            : "Dnes nemáte žádné prohlídky. Užijte si volnější den ☕"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link
            href="/dashboard/properties/new"
            className="bg-white/20 backdrop-blur hover:bg-white/30 px-3 py-1.5 rounded-lg transition"
          >
            + Nová nemovitost
          </Link>
          <Link
            href="/dashboard/bookings"
            className="bg-white/20 backdrop-blur hover:bg-white/30 px-3 py-1.5 rounded-lg transition"
          >
            Všechny rezervace →
          </Link>
        </div>
      </header>

      {/* 4 statistické karty s gradientem */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Dnes"
          value={todayBookings.length}
          icon="📅"
          gradient="from-blue-500 to-blue-600"
        />
        <StatCard
          label="Tento týden"
          value={weekBookings}
          icon="📊"
          gradient="from-purple-500 to-purple-600"
        />
        <StatCard
          label="Potvrzeno"
          value={confirmedCount}
          icon="✓"
          gradient="from-green-500 to-green-600"
          subtitle="klientem"
        />
        <StatCard
          label="Čeká"
          value={pendingCount}
          icon="⏳"
          gradient="from-orange-500 to-orange-600"
          subtitle="na potvrzení"
        />
      </section>

      {/* Hlavní layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Levý sloupec — Dnes + Trend */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dnešní prohlídky */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
              <h2 className="font-semibold flex items-center gap-2">
                <span>🔥</span>
                <span>Dnešní prohlídky</span>
                {todayBookings.length > 0 && (
                  <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
                    {todayBookings.length}
                  </span>
                )}
              </h2>
              {todayBookings.length > 0 && (
                <div className="text-xs text-slate-500">
                  {confirmRate}% potvrzeno
                </div>
              )}
            </div>
            {todayBookings.length > 0 && (
              <div className="px-5 pt-3">
                <ProgressBar percent={confirmRate} color="bg-green-500" />
              </div>
            )}
            {todayBookings.length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                <div className="text-4xl mb-2">☕</div>
                Volný den
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {todayBookings.map((b) => (
                  <li key={b.id} className="px-5 py-3 flex gap-4 items-center hover:bg-slate-50">
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
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                        ✓ potvrzeno
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-orange-50 text-orange-700 font-medium">
                        ⏳ čeká
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Trend posledních 7 dní */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <span>📈</span>
                  <span>Trend rezervací (posledních 7 dní)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kolik rezervací přišlo každý den
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-brand-700">
                  {sparklineData.reduce((a, b) => a + b, 0)}
                </div>
                <div className="text-xs text-slate-500">celkem</div>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Sparkline data={sparklineData} color="#2563eb" height={50} />
              <div className="flex-1 grid grid-cols-7 text-center text-xs text-slate-400 mt-2">
                {Array.from({ length: 7 }, (_, i) => {
                  const d = subDays(today, 6 - i);
                  return (
                    <div key={i}>
                      <div className="font-medium text-slate-600">
                        {sparklineData[i]}
                      </div>
                      <div>{format(d, "EE", { locale: cs }).slice(0, 2)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Recent activity */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <h3 className="font-semibold flex items-center gap-2">
                <span>📰</span>
                <span>Poslední aktivita</span>
              </h3>
            </div>
            {recentActivity.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                Žádné rezervace zatím.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentActivity.map((b) => (
                  <li key={b.id} className="px-5 py-3 flex items-center gap-3">
                    <span className="text-xl">
                      {b.status === "cancelled" ? "❌" : "🆕"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        <strong>{b.client.name}</strong>{" "}
                        {b.status === "cancelled"
                          ? "zrušil rezervaci"
                          : "si rezervoval"}{" "}
                        {b.listing?.title ? (
                          <span className="text-slate-600">
                            „{b.listing.title}"
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-500">
                        {format(b.createdAt, "d. M. yyyy 'v' HH:mm", { locale: cs })}{" "}
                        · termín{" "}
                        {format(b.startsAt, "d. M. HH:mm", { locale: cs })}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Pravý sloupec — Donut + Quick share */}
        <aside className="space-y-6">
          {/* Donut chart */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <span>🍩</span>
              <span>Rozdělení rezervací</span>
            </h3>
            <div className="flex justify-center mb-4">
              <DonutChart
                segments={[
                  { label: "Potvrzeno", value: confirmedCount, color: "#10b981" },
                  { label: "Čeká", value: pendingCount, color: "#f59e0b" },
                  { label: "Zrušeno", value: cancelledCount, color: "#ef4444" },
                ]}
              />
            </div>
            <div className="space-y-1.5 text-sm">
              <LegendRow
                color="#10b981"
                label="Potvrzeno klientem"
                value={confirmedCount}
              />
              <LegendRow
                color="#f59e0b"
                label="Čeká potvrzení"
                value={pendingCount}
              />
              <LegendRow
                color="#ef4444"
                label="Zrušeno"
                value={cancelledCount}
              />
            </div>
          </div>

          {/* Sdílení odkazu */}
          <div className="bg-gradient-to-br from-brand-50 to-white rounded-xl border border-brand-200 p-5">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <span>🔗</span>
              <span>Sdílejte se zákazníky</span>
            </h3>
            <p className="text-xs text-slate-600 mb-3">
              Pošlete tento odkaz klientům, aby si u vás mohli rezervovat.
            </p>
            <div className="bg-white rounded-lg p-2 text-xs font-mono break-all border border-slate-200">
              {publicUrl}
            </div>
            <div className="flex gap-2 mt-3">
              <CopyButton text={publicUrl} label="📋 Kopírovat" />
              <Link
                href={`/${tenant.slug}`}
                target="_blank"
                className="btn-secondary text-xs flex-1 justify-center"
              >
                Otevřít ↗
              </Link>
            </div>
          </div>

          {/* Souhrn */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span>📊</span>
              <span>Souhrn</span>
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Aktivní nemovitosti</span>
                <strong>{propertiesCount}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Všechny rezervace</span>
                <strong>{totalBookings}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Zrušené</span>
                <strong className="text-red-600">{cancelledCount}</strong>
              </div>
            </div>
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
  icon,
  gradient,
}: {
  label: string;
  value: number;
  subtitle?: string;
  icon?: string;
  gradient: string;
}) {
  return (
    <div
      className={`bg-gradient-to-br ${gradient} text-white rounded-xl p-4 shadow-sm relative overflow-hidden`}
    >
      <div className="absolute -right-4 -bottom-4 text-7xl opacity-10">
        {icon}
      </div>
      <div className="relative">
        <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
        <div className="text-3xl font-bold mt-1">{value}</div>
        {subtitle && <div className="text-xs opacity-80 mt-0.5">{subtitle}</div>}
      </div>
    </div>
  );
}

function LegendRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="flex-1 text-slate-700">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function pluralize(n: number, [a, b, c]: [string, string, string]): string {
  if (n === 1) return a;
  if (n >= 2 && n <= 4) return b;
  return c;
}
