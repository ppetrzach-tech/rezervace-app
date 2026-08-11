import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function TenantHome({
  params,
}: {
  params: { slug: string };
}) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) notFound();

  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-5 flex justify-between items-center">
          <Link
            href={`/${tenant.slug}`}
            className="text-xl font-semibold text-brand-700"
          >
            {tenant.name}
          </Link>
          <Link href="/" className="text-xs text-slate-400 hover:text-slate-600">
            Powered by Rezervace
          </Link>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-3">
          {tenant.tagline ?? "Rezervujte si termín online"}
        </h1>
        <p className="text-lg text-slate-600 mb-8">
          Pro rezervaci použijte konkrétní odkaz, který jste od nás dostali.
        </p>
        <div className="card text-slate-600 max-w-xl">
          Rezervace probíhá přes odkaz na konkrétní termín (prohlídka nebo
          konzultace), který vám pošleme e‑mailem nebo najdete v inzerátu.
        </div>
      </section>
    </main>
  );
}
