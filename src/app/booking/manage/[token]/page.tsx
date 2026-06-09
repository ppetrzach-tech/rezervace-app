import { prisma } from "@/lib/db";
import { czDateTimeLong } from "@/lib/datetime";
import { brandCssVariablesForColor } from "@/lib/colors";
import { ManageActions } from "./ManageActions";

export const dynamic = "force-dynamic";

export default async function ManageBookingPage({
  params,
}: {
  params: { token: string };
}) {
  // Ukázkový odkaz z testovacího emailu
  if (params.token === "UKAZKA-TOKEN") {
    return (
      <Shell color="2563eb">
        <div className="text-4xl mb-3">🧪</div>
        <h1 className="text-2xl font-bold mb-2">Testovací odkaz</h1>
        <p className="text-slate-600">
          Tohle byl testovací email s ukázkovými daty. U skutečné rezervace zde
          klient může termín přeplánovat, zrušit nebo říct, že nemá zájem.
        </p>
      </Shell>
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { confirmationToken: params.token },
    include: { service: true, provider: true, listing: true, tenant: true },
  });

  if (!booking) {
    return (
      <Shell color="2563eb">
        <div className="text-4xl mb-3">❓</div>
        <h1 className="text-2xl font-bold mb-2">Odkaz nenalezen</h1>
        <p className="text-slate-600">
          Tento odkaz neexistuje nebo už vypršel.
        </p>
      </Shell>
    );
  }

  const title = booking.listing?.title || booking.service.name;
  const dateStr = czDateTimeLong(booking.startsAt);
  const isFuture = booking.startsAt.getTime() > Date.now();
  const alreadyHandled =
    booking.status === "cancelled" || !!booking.clientResponse;

  return (
    <Shell color={booking.tenant.primaryColor}>
      <h1 className="text-2xl font-bold mb-1">{booking.tenant.name}</h1>
      <p className="text-slate-500 text-sm mb-6">Správa vašeho termínu</p>

      <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 text-left mb-6">
        <div className="font-semibold">{title}</div>
        <div className="text-slate-600 text-sm mt-1">📅 {dateStr}</div>
        {booking.listing?.address && (
          <div className="text-slate-600 text-sm">📍 {booking.listing.address}</div>
        )}
      </div>

      {alreadyHandled ? (
        <div className="text-slate-600">
          <div className="text-3xl mb-2">✓</div>
          Tuto rezervaci jsme už zpracovali. Pokud potřebujete cokoliv dalšího,
          kontaktujte nás prosím e-mailem.
        </div>
      ) : (
        <ManageActions token={params.token} isFuture={isFuture} />
      )}
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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 max-w-md w-full p-8 text-center">
        {children}
      </div>
    </main>
  );
}
