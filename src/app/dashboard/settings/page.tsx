import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/login");
  if (session.user.role !== "owner") redirect("/dashboard");

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
  });
  if (!tenant) redirect("/login");

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-3xl font-bold">Nastavení firmy</h1>
      <SettingsForm
        initial={{
          slug: tenant.slug,
          name: tenant.name,
          tagline: tenant.tagline ?? "",
          primaryColor: tenant.primaryColor,
        }}
      />
    </div>
  );
}
