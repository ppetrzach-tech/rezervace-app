import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { PropertyBookingFlow } from "./PropertyBookingFlow";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string; propertySlug: string };
}) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) return { title: "Nenalezeno" };
  const listing = await prisma.eventListing.findFirst({
    where: { tenantId: tenant.id, slug: params.propertySlug, active: true },
  });
  if (!listing) return { title: "Nenalezeno" };
  return {
    title: `${listing.title} — rezervace prohlídky`,
    description: listing.description ?? undefined,
  };
}

export default async function PropertyPage({
  params,
}: {
  params: { slug: string; propertySlug: string };
}) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) notFound();

  const listing = await prisma.eventListing.findFirst({
    where: { tenantId: tenant.id, slug: params.propertySlug, active: true },
    include: {
      provider: { select: { name: true } },
      slots: {
        where: {
          startsAt: { gte: new Date() },
          booking: null,
        },
        orderBy: { startsAt: "asc" },
      },
    },
  });
  if (!listing) notFound();

  const formQuestions = Array.isArray(listing.formQuestions)
    ? (listing.formQuestions as unknown as Array<{
        id: string;
        label: string;
        type: string;
        required?: boolean;
        options?: string[];
      }>)
    : [];

  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-5 flex justify-between items-center">
          <Link href={`/${tenant.slug}`} className="text-xl font-semibold text-brand-700">
            {tenant.name}
          </Link>
          <Link href="/" className="text-xs text-slate-400 hover:text-slate-600">
            Powered by Rezervace
          </Link>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-2">{listing.title}</h1>
        {listing.address && (
          <p className="text-slate-600 mb-3">📍 {listing.address}</p>
        )}
        {listing.description && (
          <div className="text-slate-700 mb-6 whitespace-pre-line">
            {listing.description}
          </div>
        )}
        {listing.provider && (
          <p className="text-sm text-slate-500 mb-6">
            Prohlídku vede: <strong>{listing.provider.name}</strong>
          </p>
        )}

        <PropertyBookingFlow
          tenantSlug={tenant.slug}
          listing={{
            id: listing.id,
            title: listing.title,
            address: listing.address,
            durationMinutes: listing.durationMinutes,
            formQuestions,
          }}
          slots={listing.slots.map((s) => ({
            id: s.id,
            startsAt: s.startsAt.toISOString(),
            endsAt: s.endsAt.toISOString(),
          }))}
        />
      </section>
    </main>
  );
}
