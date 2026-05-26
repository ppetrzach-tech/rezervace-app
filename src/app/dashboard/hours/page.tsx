import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { HoursManager } from "./HoursManager";

export const dynamic = "force-dynamic";

export default async function HoursPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/login");

  const providers = await prisma.provider.findMany({
    where: { tenantId: session.user.tenantId, active: true },
    include: { workingHours: { orderBy: [{ weekday: "asc" }, { startMin: "asc" }] } },
    orderBy: { name: "asc" },
  });

  const data = providers.map((p) => ({
    id: p.id,
    name: p.name,
    hours: p.workingHours.map((h) => ({
      id: h.id,
      weekday: h.weekday,
      startMin: h.startMin,
      endMin: h.endMin,
    })),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Pracovní doba</h1>
      <p className="text-slate-600 text-sm">
        Kdy mají jednotliví členové týmu být k dispozici. Klient uvidí jen volné
        sloty v rámci pracovní doby.
      </p>
      <HoursManager initialProviders={data} />
    </div>
  );
}
