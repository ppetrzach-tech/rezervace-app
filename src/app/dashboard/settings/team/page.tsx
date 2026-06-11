import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TeamManager } from "./TeamManager";
import { TeamLogins } from "./TeamLogins";

export const dynamic = "force-dynamic";

export default async function TeamAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/login");
  if (session.user.role !== "owner") redirect("/dashboard");

  const [providers, users] = await Promise.all([
    prisma.provider.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { tenantId: session.user.tenantId },
      select: { id: true, name: true, email: true, role: true, providerId: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-4">
          <h2 className="text-2xl font-semibold">Přihlášení do systému</h2>
          <p className="text-slate-600 text-sm">
            Vytvořte vlastní login pro asistentku nebo kolegu — nemusíte sdílet své
            heslo. Spolupracovník uvidí rezervace a nemovitosti, ale nedostane se k
            nastavení (API klíče, branding).
          </p>
        </div>
        <TeamLogins
          currentUserEmail={session.user.email ?? ""}
          initialUsers={users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            providerId: u.providerId,
          }))}
          providers={providers.map((p) => ({ id: p.id, name: p.name }))}
        />
      </div>

      <div className="border-t border-slate-200 pt-6">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold">Osoby (poskytovatelé)</h2>
          <p className="text-slate-600 text-sm">
            Lidé, ke kterým se klienti můžou objednat. Nemusí mít login —
            stačí, když u nich vedete prohlídky.
          </p>
        </div>
        <TeamManager
          initialProviders={providers.map((p) => ({
            id: p.id,
            name: p.name,
            email: p.email ?? "",
            phone: p.phone ?? "",
            bio: p.bio ?? "",
            photoUrl: p.photoUrl ?? "",
            active: p.active,
          }))}
        />
      </div>
    </div>
  );
}
