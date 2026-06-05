import { prisma } from "@/lib/db";
import { czDateTimeLong } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function ConfirmBookingPage({
  params,
}: {
  params: { token: string };
}) {
  const booking = await prisma.booking.findUnique({
    where: { confirmationToken: params.token },
    include: { service: true, provider: true, listing: true, tenant: true },
  });

  if (!booking) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="card max-w-md text-center">
          <div className="text-4xl mb-3">❓</div>
          <h1 className="text-2xl font-bold mb-2">Odkaz nenalezen</h1>
          <p className="text-slate-600">
            Tento potvrzovací odkaz neexistuje nebo už vypršel.
          </p>
        </div>
      </main>
    );
  }

  if (booking.status === "cancelled") {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="card max-w-md text-center">
          <div className="text-4xl mb-3">🚫</div>
          <h1 className="text-2xl font-bold mb-2">Rezervace zrušena</h1>
          <p className="text-slate-600">
            Tato rezervace byla zrušena. Pokud jde o nedorozumění, kontaktujte
            prosím poskytovatele.
          </p>
        </div>
      </main>
    );
  }

  // Pokud ještě nebyla potvrzena, potvrď.
  if (!booking.confirmedByClientAt) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { confirmedByClientAt: new Date() },
    });
  }

  const dateStr = czDateTimeLong(booking.startsAt);
  const title = booking.listing?.title || booking.service.name;

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card max-w-md text-center">
        <div className="text-4xl mb-3">✅</div>
        <h1 className="text-2xl font-bold mb-2">Termín potvrzen — děkujeme!</h1>
        <p className="text-slate-600 mb-1">
          <strong>{title}</strong>
        </p>
        <p className="text-slate-600 mb-4">{dateStr}</p>
        <p className="text-sm text-slate-500">
          {booking.tenant.name} byl informován o vašem potvrzení.
        </p>
      </div>
    </main>
  );
}
