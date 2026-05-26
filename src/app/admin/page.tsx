import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { format, isAfter, isBefore, startOfDay, addDays } from "date-fns";
import { cs } from "date-fns/locale";
import { CancelButton } from "./CancelButton";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/admin/login");
  }

  const role = session.user.role;
  const providerId = session.user.providerId;

  const where =
    role === "admin"
      ? {}
      : providerId
        ? { providerId }
        : { id: "__nothing__" };

  const upcoming = await prisma.booking.findMany({
    where: {
      ...where,
      startsAt: { gte: new Date() },
      status: { not: "cancelled" },
    },
    include: { client: true, service: true, provider: true },
    orderBy: { startsAt: "asc" },
    take: 50,
  });

  const today = await prisma.booking.findMany({
    where: {
      ...where,
      startsAt: { gte: startOfDay(new Date()), lt: addDays(startOfDay(new Date()), 1) },
    },
    include: { client: true, service: true, provider: true },
    orderBy: { startsAt: "asc" },
  });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold mb-1">Vítejte, {session.user.name}</h1>
        <p className="text-slate-600">
          {role === "admin"
            ? "Vidíte rezervace všech poskytovatelů."
            : "Vidíte rezervace přiřazené k vašemu účtu."}
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Dnes ({today.length})</h2>
        <BookingList items={today} role={role} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">Nadcházející ({upcoming.length})</h2>
        <BookingList items={upcoming} role={role} />
      </section>
    </div>
  );
}

function BookingList({
  items,
  role,
}: {
  items: Array<{
    id: string;
    startsAt: Date;
    endsAt: Date;
    note: string | null;
    status: string;
    client: { name: string; email: string; phone: string };
    service: { name: string; durationMinutes: number; priceCzk: number };
    provider: { name: string };
  }>;
  role?: string;
}) {
  if (items.length === 0) {
    return <div className="card text-slate-500 text-center">Žádné rezervace.</div>;
  }
  return (
    <div className="card p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="text-left p-3">Čas</th>
            <th className="text-left p-3">Klient</th>
            <th className="text-left p-3">Služba</th>
            {role === "admin" && <th className="text-left p-3">Poskytovatel</th>}
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((b) => (
            <tr key={b.id} className="border-t border-slate-100">
              <td className="p-3">
                <div className="font-medium">
                  {format(b.startsAt, "d. M. HH:mm", { locale: cs })}
                </div>
                <div className="text-xs text-slate-500">
                  {b.service.durationMinutes} min
                </div>
              </td>
              <td className="p-3">
                <div>{b.client.name}</div>
                <div className="text-xs text-slate-500">{b.client.phone}</div>
                <div className="text-xs text-slate-500">{b.client.email}</div>
              </td>
              <td className="p-3">
                <div>{b.service.name}</div>
                <div className="text-xs text-slate-500">{b.service.priceCzk} Kč</div>
              </td>
              {role === "admin" && <td className="p-3">{b.provider.name}</td>}
              <td className="p-3 text-right">
                <CancelButton bookingId={b.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
