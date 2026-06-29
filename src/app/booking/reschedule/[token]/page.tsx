import { prisma } from "@/lib/db";
import { brandCssVariablesForColor } from "@/lib/colors";
import { getBusyIntervals, isCalendarConfigured } from "@/lib/google-calendar";
import { RescheduleFlow } from "./RescheduleFlow";

export const dynamic = "force-dynamic";

export default async function ReschedulePage({
  params,
}: {
  params: { token: string };
}) {
  const booking = await prisma.booking.findUnique({
    where: { confirmationToken: params.token },
    include: { listing: true, tenant: true, client: true },
  });

  if (!booking || !booking.listing) {
    return (
      <Shell color="2563eb">
        <div className="text-4xl mb-3">❓</div>
        <h1 className="text-2xl font-bold mb-2">Odkaz nenalezen</h1>
        <p className="text-slate-600">Tento odkaz neexistuje nebo už vypršel.</p>
      </Shell>
    );
  }

  const tenant = booking.tenant;
  const listing = booking.listing;

  // Volné budoucí termíny (min. 5 h předem), bez kolize s Google kalendářem
  const minStart = new Date(Date.now() + 5 * 60 * 60 * 1000);
  let slots = await prisma.eventSlot.findMany({
    where: { listingId: listing.id, startsAt: { gte: minStart }, booking: null },
    orderBy: { startsAt: "asc" },
  });
  if (tenant.googleCalendarId && isCalendarConfigured() && slots.length > 0) {
    try {
      const busy = await getBusyIntervals(
        tenant.googleCalendarId,
        slots[0].startsAt,
        slots[slots.length - 1].endsAt,
      );
      if (busy.length > 0) {
        slots = slots.filter(
          (s) => !busy.some((b) => s.startsAt < b.end && s.endsAt > b.start),
        );
      }
    } catch {
      /* při chybě kalendáře ukážeme všechny */
    }
  }

  return (
    <Shell color={tenant.primaryColor}>
      <RescheduleFlow
        token={params.token}
        tenantName={tenant.name}
        listingTitle={listing.title}
        address={listing.address}
        clientName={booking.client.name}
        slots={slots.map((s) => ({
          id: s.id,
          startsAt: s.startsAt.toISOString(),
          endsAt: s.endsAt.toISOString(),
        }))}
      />
    </Shell>
  );
}

function Shell({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <style
        dangerouslySetInnerHTML={{ __html: brandCssVariablesForColor(color) }}
      />
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 max-w-md w-full p-6">
        {children}
      </div>
    </main>
  );
}
