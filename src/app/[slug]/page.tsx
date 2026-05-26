import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { locationEmoji, locationLabel } from "@/lib/branding";

export const dynamic = "force-dynamic";

export default async function TenantHome({
  params,
}: {
  params: { slug: string };
}) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) notFound();

  const services = await prisma.service.findMany({
    where: { tenantId: tenant.id, active: true },
    include: { providers: { include: { provider: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-5 flex justify-between items-center">
          <Link href={`/${tenant.slug}`} className="text-xl font-semibold text-brand-700">
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
        <p className="text-lg text-slate-600 mb-10">
          Vyberte typ schůzky a najděte volný termín.
        </p>

        <h2 className="text-2xl font-semibold mb-4">Typy schůzek</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {services.map((service) => (
            <Link
              key={service.id}
              href={`/${tenant.slug}/book?service=${service.id}`}
              className="card hover:shadow-md hover:border-brand-500 transition"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{service.name}</h3>
                  {service.description && (
                    <p className="text-sm text-slate-600 mt-1">{service.description}</p>
                  )}
                </div>
                <div className="text-right ml-4 shrink-0">
                  {service.showPrice && service.priceCzk > 0 ? (
                    <div className="font-semibold">{service.priceCzk} Kč</div>
                  ) : null}
                  <div className="text-xs text-slate-500">{service.durationMinutes} min</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>
                  {locationEmoji(service.locationType)} {locationLabel(service.locationType)}
                </span>
                <span>
                  {service.providers.length}{" "}
                  {service.providers.length === 1 ? "osoba" : "osoby"}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {services.length === 0 && (
          <div className="card text-center text-slate-500">
            Tato firma zatím nemá nakonfigurované žádné typy schůzek.
          </div>
        )}
      </section>
    </main>
  );
}
