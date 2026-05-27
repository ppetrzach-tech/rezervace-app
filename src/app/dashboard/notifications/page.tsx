import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NotificationsManager } from "./NotificationsManager";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/login");
  if (session.user.role !== "owner") redirect("/dashboard");

  const rules = await prisma.notificationRule.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: [{ offsetMinutes: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notifikace</h1>
        <p className="text-slate-600 text-sm mt-1">
          Nastavte si, jaké emaily a SMS se mají automaticky odesílat klientům před
          schůzkou a po ní. Pravidlo platí pro celou firmu (všechny rezervace).
        </p>
      </div>
      <NotificationsManager
        initialRules={rules.map((r) => ({
          id: r.id,
          name: r.name,
          channel: r.channel as "email" | "sms",
          offsetMinutes: r.offsetMinutes,
          subject: r.subject ?? "",
          body: r.body,
          includeIcs: r.includeIcs,
          includeConfirmButton: r.includeConfirmButton,
          onlyIfNotConfirmed: r.onlyIfNotConfirmed,
          enabled: r.enabled,
        }))}
      />
    </div>
  );
}
