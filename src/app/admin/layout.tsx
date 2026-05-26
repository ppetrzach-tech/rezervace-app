import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { branding } from "@/lib/branding";
import { SignOutButton } from "./SignOutButton";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-lg font-semibold text-brand-700">
              Admin · {branding.businessName}
            </Link>
            {session?.user && (
              <nav className="flex gap-4 text-sm text-slate-600">
                <Link href="/admin" className="hover:text-brand-700">Rezervace</Link>
                <Link href="/admin/services" className="hover:text-brand-700">Typy schůzek</Link>
                <Link href="/admin/providers" className="hover:text-brand-700">Osoby</Link>
              </nav>
            )}
          </div>
          {session?.user && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-600">{session.user.email}</span>
              <SignOutButton />
            </div>
          )}
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
