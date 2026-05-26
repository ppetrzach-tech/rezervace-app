import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { locationEmoji, locationLabel } from "@/lib/branding";

export const dynamic = "force-dynamic";

export default async function ServicesAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/admin/login");

  const services = await prisma.service.findMany({
    include: { providers: { include: { provider: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Typy schůzek</h1>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3">Název</th>
              <th className="text-left p-3">Trvání</th>
              <th className="text-left p-3">Cena</th>
              <th className="text-left p-3">Místo</th>
              <th className="text-left p-3">Nabízí</th>
              <th className="text-left p-3">Aktivní</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="p-3">
                  <div className="font-medium">{s.name}</div>
                  {s.description && (
                    <div className="text-xs text-slate-500">{s.description}</div>
                  )}
                </td>
                <td className="p-3">
                  {s.durationMinutes} min
                  {(s.bufferBeforeMin > 0 || s.bufferAfterMin > 0) && (
                    <div className="text-xs text-slate-500">
                      +{s.bufferBeforeMin}/{s.bufferAfterMin} buffer
                    </div>
                  )}
                </td>
                <td className="p-3">
                  {s.showPrice && s.priceCzk > 0 ? `${s.priceCzk} Kč` : "—"}
                </td>
                <td className="p-3">
                  <div>
                    {locationEmoji(s.locationType)} {locationLabel(s.locationType)}
                  </div>
                  {s.locationDetail && (
                    <div className="text-xs text-slate-500 max-w-xs">{s.locationDetail}</div>
                  )}
                </td>
                <td className="p-3 text-slate-600">
                  {s.providers.map((p) => p.provider.name).join(", ") || "—"}
                </td>
                <td className="p-3">{s.active ? "Ano" : "Ne"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate-500">
        Pro editaci typů schůzek a pracovní doby zatím použijte <code>npx prisma studio</code>.
        Plnohodnotný UI editor je další iterací MVP.
      </p>
    </div>
  );
}
