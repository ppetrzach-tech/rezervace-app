import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwner } from "@/lib/perms";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/login");

  const owner = isOwner(session.user);

  // ownerOnly = tab vidí jen vlastník (citlivá nastavení)
  const allTabs: {
    href: string;
    label: string;
    icon: string;
    ownerOnly: boolean;
  }[] = [
    { href: "/dashboard/settings", label: "Firma", icon: "🏢", ownerOnly: true },
    { href: "/dashboard/settings/notifications", label: "Notifikace", icon: "🔔", ownerOnly: false },
    { href: "/dashboard/settings/team", label: "Tým", icon: "👥", ownerOnly: true },
    { href: "/dashboard/settings/hours", label: "Pracovní doba", icon: "🕐", ownerOnly: false },
    { href: "/dashboard/settings/services", label: "Typy schůzek", icon: "🛍", ownerOnly: false },
    { href: "/dashboard/settings/integrations", label: "Integrace", icon: "🔌", ownerOnly: true },
    { href: "/dashboard/settings/account", label: "Účet", icon: "🔑", ownerOnly: false },
  ];
  const tabs = allTabs.filter((t) => owner || !t.ownerOnly);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Nastavení</h1>
        <p className="text-slate-600 text-sm mt-1">
          Spravujte vše, co týká vaší firmy.
        </p>
      </div>

      <div className="grid md:grid-cols-[200px_1fr] gap-6">
        <aside>
          <nav className="bg-white border border-slate-200 rounded-lg p-2 sticky top-20">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="block px-3 py-2 rounded-md text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
              >
                <span className="mr-2">{t.icon}</span>
                {t.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
