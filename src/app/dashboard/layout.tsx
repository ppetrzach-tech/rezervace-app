import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SignOutButton } from "./SignOutButton";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
  });
  if (!tenant) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-lg font-semibold text-brand-700">
              📅 {tenant.name}
            </Link>
            <nav className="flex gap-4 text-sm text-slate-600">
              <Link href="/dashboard" className="hover:text-brand-700">
                Rezervace
              </Link>
              <Link href="/dashboard/properties" className="hover:text-brand-700">
                Nemovitosti
              </Link>
              <Link href="/dashboard/services" className="hover:text-brand-700">
                Typy schůzek
              </Link>
              <Link href="/dashboard/team" className="hover:text-brand-700">
                Tým
              </Link>
              <Link href="/dashboard/hours" className="hover:text-brand-700">
                Pracovní doba
              </Link>
              <Link href="/dashboard/notifications" className="hover:text-brand-700">
                Notifikace
              </Link>
              <Link href="/dashboard/settings" className="hover:text-brand-700">
                Nastavení
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href={`/${tenant.slug}`}
              target="_blank"
              className="text-slate-600 hover:text-brand-700"
            >
              Veřejná stránka ↗
            </Link>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600">{session.user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
