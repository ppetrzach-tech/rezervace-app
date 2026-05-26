import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TeamManager } from "./TeamManager";

export const dynamic = "force-dynamic";

export default async function TeamAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/login");
  if (session.user.role !== "owner") redirect("/dashboard");

  const providers = await prisma.provider.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Tým</h1>
      <p className="text-slate-600 text-sm">
        Osoby, ke kterým se klienti můžou objednat. Můžete být sám (jen vy) nebo
        mít víc členů týmu.
      </p>
      <TeamManager
        initialProviders={providers.map((p) => ({
          id: p.id,
          name: p.name,
          email: p.email ?? "",
          phone: p.phone ?? "",
          bio: p.bio ?? "",
          active: p.active,
        }))}
      />
    </div>
  );
}
