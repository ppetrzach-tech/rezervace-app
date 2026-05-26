import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { BookingFlow } from "./BookingFlow";

export const dynamic = "force-dynamic";

export default async function BookPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { service?: string };
}) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) notFound();

  const services = await prisma.service.findMany({
    where: { tenantId: tenant.id, active: true },
    include: {
      providers: {
        include: {
          provider: { select: { id: true, name: true, bio: true, active: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-5 flex justify-between items-center">
          <Link href={`/${tenant.slug}`} className="text-xl font-semibold text-brand-700">
            {tenant.name}
          </Link>
          <Link
            href={`/${tenant.slug}`}
            className="text-sm text-slate-600 hover:text-brand-700"
          >
            ← Zpět
          </Link>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-8">Rezervace termínu</h1>
        <BookingFlow
          tenantSlug={tenant.slug}
          services={services.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            durationMinutes: s.durationMinutes,
            priceCzk: s.priceCzk,
            showPrice: s.showPrice,
            locationType: s.locationType,
            locationDetail: s.locationDetail,
            providers: s.providers
              .filter((sp) => sp.provider.active)
              .map((sp) => ({
                id: sp.provider.id,
                name: sp.provider.name,
                bio: sp.provider.bio,
              })),
          }))}
          initialServiceId={searchParams.service}
        />
      </section>
    </main>
  );
}
