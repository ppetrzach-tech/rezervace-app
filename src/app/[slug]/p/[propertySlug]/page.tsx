import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { brandCssVariablesForColor } from "@/lib/colors";
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
      provider: { select: { name: true, bio: true } },
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

  const totalSlots = listing.slots.length;

  return (
    <main className="min-h-screen bg-slate-50">
      <style
        dangerouslySetInnerHTML={{
          __html: brandCssVariablesForColor(tenant.primaryColor),
        }}
      />

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link
            href={`/${tenant.slug}`}
            className="flex items-center gap-2 font-semibold text-brand-700"
          >
            <span className="text-lg">📅</span>
            <span>{tenant.name}</span>
          </Link>
          <span className="text-xs text-slate-400">Rezervace online</span>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 text-white">
        <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
          <div className="flex items-start gap-4">
            <div className="text-6xl shrink-0 hidden sm:block">🏠</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider opacity-80 mb-1">
                Rezervace prohlídky
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-2 leading-tight">
                {listing.title}
              </h1>
              {listing.address && (
                <p className="text-white/90 flex items-center gap-2">
                  <span>📍</span>
                  <span>{listing.address}</span>
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-sm">
                  ⏱ {listing.durationMinutes} min
                </span>
                <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-sm">
                  📅 {totalSlots} volných termínů
                </span>
                {listing.provider && (
                  <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-sm">
                    👤 {listing.provider.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-8 grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Main flow */}
        <div className="order-2 lg:order-1">
          <PropertyBookingFlow
            tenantSlug={tenant.slug}
            tenantName={tenant.name}
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
        </div>

        {/* Sidebar */}
        <aside className="order-1 lg:order-2 space-y-4">
          {listing.description && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <span>ℹ️</span>
                <span>O nemovitosti</span>
              </h3>
              <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                {listing.description}
              </p>
            </div>
          )}

          {listing.provider && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span>👤</span>
                <span>Prohlídku vede</span>
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white flex items-center justify-center font-bold text-lg shrink-0">
                  {listing.provider.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </div>
                <div className="min-w-0">
                  <div className="font-medium">{listing.provider.name}</div>
                  {listing.provider.bio && (
                    <div className="text-xs text-slate-500 line-clamp-2">
                      {listing.provider.bio}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-5">
            <div className="flex items-start gap-2">
              <span className="text-2xl">🔒</span>
              <div>
                <h3 className="font-semibold text-green-900 text-sm">
                  Bezpečná rezervace
                </h3>
                <p className="text-xs text-green-800 mt-1">
                  Vaše údaje slouží jen k organizaci prohlídky. Žádné spamy ani
                  marketing.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-4 text-center text-xs text-slate-500">
          {tenant.name} · Online rezervace
        </div>
      </footer>
    </main>
  );
}
