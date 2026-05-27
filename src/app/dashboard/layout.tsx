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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-14 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-brand-700">
            <span className="text-lg">📅</span>
            <span>{tenant.name}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <NavItem href="/dashboard" label="Dashboard" />
            <NavItem href="/dashboard/properties" label="Nemovitosti" />
            <NavItem href="/dashboard/bookings" label="Rezervace" />
            <NavItem href="/dashboard/settings" label="Nastavení" />
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href={`/${tenant.slug}`}
              target="_blank"
              className="hidden sm:inline text-slate-500 hover:text-brand-700"
              title="Otevřít vaši veřejnou stránku"
            >
              ↗ Veřejná stránka
            </Link>
            <SignOutButton />
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="md:hidden flex border-t border-slate-200 text-xs overflow-x-auto">
          <MobileNavItem href="/dashboard" label="Dashboard" />
          <MobileNavItem href="/dashboard/properties" label="Nemovitosti" />
          <MobileNavItem href="/dashboard/bookings" label="Rezervace" />
          <MobileNavItem href="/dashboard/settings" label="Nastavení" />
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
    >
      {label}
    </Link>
  );
}

function MobileNavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex-1 text-center py-2.5 text-slate-600 hover:bg-slate-50 whitespace-nowrap"
    >
      {label}
    </Link>
  );
}
