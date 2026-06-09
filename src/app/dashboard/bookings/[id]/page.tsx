import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { czDateTimeLong, czDayMonthTime } from "@/lib/datetime";
import { CancelButton } from "../../CancelButton";
import { EmailingToggle } from "./EmailingToggle";

export const dynamic = "force-dynamic";

export default async function BookingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/login");

  const booking = await prisma.booking.findFirst({
    where: { id: params.id, tenantId: session.user.tenantId },
    include: {
      client: true,
      service: true,
      provider: true,
      listing: true,
      notifications: { orderBy: { sentAt: "asc" } },
    },
  });
  if (!booking) notFound();

  // Oprávnění — staff vidí jen své
  if (
    session.user.role !== "owner" &&
    booking.providerId !== session.user.providerId
  ) {
    redirect("/dashboard/bookings");
  }

  // Pravidla pro hezké názvy logů
  const rules = await prisma.notificationRule.findMany({
    where: { tenantId: session.user.tenantId },
    select: { id: true, name: true },
  });
  const ruleName = (id: string | null) =>
    id === null
      ? "Potvrzení rezervace (ihned)"
      : rules.find((r) => r.id === id)?.name ?? "Notifikace";

  const answers = Array.isArray(booking.customAnswers)
    ? (booking.customAnswers as unknown as Array<{ label: string; value: string }>)
    : [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/dashboard/bookings"
          className="text-sm text-slate-500 hover:text-brand-700"
        >
          ← Zpět na rezervace
        </Link>
        <h1 className="text-3xl font-bold mt-1">
          {booking.listing?.title || booking.service.name}
        </h1>
        <p className="text-slate-600 mt-1">
          {czDateTimeLong(booking.startsAt)}
          {" · "}
          {booking.service.durationMinutes} min
        </p>
        <div className="mt-2">
          {booking.status === "cancelled" ? (
            <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-700">
              zrušeno
            </span>
          ) : booking.confirmedByClientAt ? (
            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
              ✓ potvrzeno klientem{" "}
              {czDayMonthTime(booking.confirmedByClientAt)}
            </span>
          ) : (
            <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500">
              čeká na potvrzení klientem
            </span>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Klient */}
        <div className="card">
          <h2 className="font-semibold mb-3">👤 Klient</h2>
          <dl className="text-sm space-y-1">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Jméno</dt>
              <dd className="font-medium text-right">{booking.client.name}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Email</dt>
              <dd className="text-right">
                <a href={`mailto:${booking.client.email}`} className="text-brand-700">
                  {booking.client.email}
                </a>
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Telefon</dt>
              <dd className="text-right">
                <a href={`tel:${booking.client.phone}`} className="text-brand-700">
                  {booking.client.phone}
                </a>
              </dd>
            </div>
          </dl>
          {booking.note && (
            <p className="text-sm text-slate-600 mt-3 pt-3 border-t border-slate-100">
              <span className="text-slate-500">Poznámka:</span> {booking.note}
            </p>
          )}
        </div>

        {/* Schůzka */}
        <div className="card">
          <h2 className="font-semibold mb-3">📋 Detaily</h2>
          <dl className="text-sm space-y-1">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Osoba</dt>
              <dd className="text-right">{booking.provider.name}</dd>
            </div>
            {booking.listing?.address && (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Adresa</dt>
                <dd className="text-right">{booking.listing.address}</dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Vytvořeno</dt>
              <dd className="text-right">
                {czDateTimeLong(booking.createdAt)}
              </dd>
            </div>
            {booking.clientResponse && (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">Reakce klienta</dt>
                <dd className="text-right font-medium">
                  {booking.clientResponse === "reschedule"
                    ? "🔄 chce přeplánovat"
                    : booking.clientResponse === "cancel"
                      ? "❌ zrušil termín"
                      : booking.clientResponse === "decline"
                        ? "🚫 nemá zájem"
                        : booking.clientResponse}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Automatické emaily</dt>
              <dd className="text-right font-medium">
                {booking.emailingStopped ? (
                  <span className="text-orange-700">⏸ zastaveny</span>
                ) : (
                  <span className="text-green-700">▶ aktivní</span>
                )}
              </dd>
            </div>
          </dl>
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2 items-center">
            <EmailingToggle
              bookingId={booking.id}
              stopped={booking.emailingStopped}
            />
            {booking.status !== "cancelled" && (
              <CancelButton bookingId={booking.id} />
            )}
          </div>
        </div>
      </div>

      {/* Odpovědi z formuláře */}
      {answers.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-3">📝 Odpovědi z formuláře</h2>
          <dl className="text-sm space-y-2">
            {answers
              .filter((a) => a.value)
              .map((a, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <dt className="text-slate-500">{a.label}</dt>
                  <dd className="font-medium text-right">{a.value}</dd>
                </div>
              ))}
          </dl>
        </div>
      )}

      {/* Notifikační log */}
      <div className="card">
        <h2 className="font-semibold mb-1">📨 Historie notifikací</h2>
        <p className="text-xs text-slate-500 mb-4">
          Záznam o tom, co aplikace odeslala. „Odesláno" = úspěšně předáno
          poskytovateli (Ecomail/GoSMS). Skutečné doručení do schránky ověříte
          v Ecomailu.
        </p>

        {booking.notifications.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-6 bg-slate-50 rounded-lg">
            Zatím nebyly odeslány žádné notifikace.
          </div>
        ) : (
          <ol className="space-y-2">
            {booking.notifications.map((n) => (
              <li
                key={n.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-slate-100"
              >
                <span className="text-xl shrink-0">
                  {n.channel === "email" ? "📧" : "📱"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{ruleName(n.ruleId)}</div>
                  <div className="text-xs text-slate-500">
                    {czDateTimeLong(n.sentAt)}
                    {" · "}
                    {n.channel === "email" ? "Email" : "SMS"}
                  </div>
                  {n.error && (
                    <div className="text-xs text-red-600 mt-1">{n.error}</div>
                  )}
                </div>
                <StatusBadge status={n.status} />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "sent") {
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 shrink-0">
        ✓ odesláno
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-red-50 text-red-700 shrink-0">
        ✗ selhalo
      </span>
    );
  }
  return (
    <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-500 shrink-0">
      {status}
    </span>
  );
}
