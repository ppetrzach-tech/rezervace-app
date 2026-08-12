import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function TenantHome({
  params,
}: {
  params: { slug: string };
}) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) notFound();

  // Na veřejné úvodní stránce nabízíme KONZULTACE (obecné schůzky).
  // Prohlídky nemovitostí se sdílí přes vlastní odkaz, ne zde v katalogu.
  const consultations = await prisma.eventListing.findMany({
    where: { tenantId: tenant.id, kind: "consultation", active: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      address: true,
      durationMinutes: true,
    },
  });

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

      <section className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-3">
          {tenant.tagline ?? "Rezervujte si termín online"}
        </h1>

        {consultations.length > 0 ? (
          <>
            <p className="text-lg text-slate-600 mb-8">
              Vyberte konzultaci a zarezervujte si termín.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {consultations.map((c) => (
                <Link
                  key={c.id}
                  href={`/${tenant.slug}/p/${c.slug}`}
                  className="card hover:shadow-md hover:border-brand-500 transition"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0">💬</span>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-lg">{c.title}</h3>
                      {c.description && (
                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                          {c.description}
                        </p>
                      )}
                      <div className="mt-2 text-xs text-slate-500">
                        ⏱ {c.durationMinutes} min
                        {c.address ? ` · ${c.address}` : ""}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-lg text-slate-600 mb-8">
              Pro rezervaci použijte konkrétní odkaz, který jste od nás dostali.
            </p>
            <div className="card text-slate-600 max-w-xl">
              Rezervace probíhá přes odkaz na konkrétní termín (prohlídka nebo
              konzultace), který vám pošleme e‑mailem nebo najdete v inzerátu.
            </div>
          </>
        )}
      </section>
    </main>
  );
}
