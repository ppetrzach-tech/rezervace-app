import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ServicesManager } from "./ServicesManager";

export const dynamic = "force-dynamic";

export default async function ServicesAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/login");

  const tenantId = session.user.tenantId;
  const [services, providers] = await Promise.all([
    prisma.service.findMany({
      where: { tenantId },
      include: { providers: { select: { providerId: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.provider.findMany({
      where: { tenantId, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Typy schůzek</h1>
      <p className="text-slate-600 text-sm">
        Definujte, na co se k vám klienti můžou objednat. Každý typ má svoje trvání,
        cenu, místo a osoby, které ho nabízejí.
      </p>
      <ServicesManager
        initialServices={services.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description ?? "",
          durationMinutes: s.durationMinutes,
          priceCzk: s.priceCzk,
          showPrice: s.showPrice,
          locationType: s.locationType,
          locationDetail: s.locationDetail ?? "",
          bufferBeforeMin: s.bufferBeforeMin,
          bufferAfterMin: s.bufferAfterMin,
          active: s.active,
          providerIds: s.providers.map((p) => p.providerId),
        }))}
        providers={providers.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}
