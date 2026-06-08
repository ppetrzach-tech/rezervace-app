import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SettingsForm } from "./SettingsForm";
import { isOwner } from "@/lib/perms";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/login");
  // Manažer nemá přístup k Firmě → pošli ho na první dostupnou záložku (Notifikace)
  if (!isOwner(session.user)) redirect("/dashboard/settings/notifications");

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
  });
  if (!tenant) redirect("/login");

  return (
    <div className="max-w-xl">
      <h2 className="text-2xl font-semibold mb-1">Firma a branding</h2>
      <p className="text-sm text-slate-600 mb-6">
        Název, URL adresa a vzhled stránky, kterou vidí klienti.
      </p>
      <SettingsForm
        initial={{
          slug: tenant.slug,
          name: tenant.name,
          tagline: tenant.tagline ?? "",
          primaryColor: tenant.primaryColor,
          ownerPhone: tenant.ownerPhone ?? "",
        }}
      />
    </div>
  );
}
