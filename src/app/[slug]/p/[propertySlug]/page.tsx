import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getTenantBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { brandCssVariablesForColor } from "@/lib/colors";
import { getLocaleFromString, t, LOCALES, type Locale } from "@/lib/i18n";
import { LanguageSwitcher } from "../../LanguageSwitcher";
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

  // Locale: cookie → Accept-Language → cs
  const cookieLocale = cookies().get("locale")?.value;
  const acceptLang = headers().get("accept-language");
  let locale: Locale = "cs";
  if (cookieLocale && (LOCALES as string[]).includes(cookieLocale)) {
    locale = cookieLocale as Locale;
  } else if (acceptLang) {
    locale = getLocaleFromString(acceptLang.split(",")[0]);
  }
  const tr = t(locale);

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
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:inline">
              {tr("booking.online")}
            </span>
            <div className="text-slate-700">
              <LanguageSwitcher current={locale} />
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-brand-600 via-brand-500 to-brand-700 text-white overflow-hidden">
        {listing.imageUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={listing.imageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-brand-700/80 via-brand-600/70 to-brand-900/80" />
          </>
        )}
        <div className="relative max-w-5xl mx-auto px-4 py-8 sm:py-12">
          <div className="flex items-start gap-4">
            <div className="text-6xl shrink-0 hidden sm:block drop-shadow">🏠</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider opacity-80 mb-1">
                {tr("booking.viewing_title")}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-2 leading-tight drop-shadow">
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
                  ⏱ {listing.durationMinutes} {tr("booking.duration_min")}
                </span>
                <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-sm">
                  📅 {totalSlots} {tr("booking.free_terms")}
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
            locale={locale}
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
          {listing.imageUrl && (
            <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={listing.imageUrl}
                alt={listing.title}
                className="w-full h-44 object-cover"
              />
            </div>
          )}

          {listing.description && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <span>ℹ️</span>
                <span>{tr("booking.about")}</span>
              </h3>
              <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                {listing.description}
              </p>
            </div>
          )}

          {listing.address && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <span>🗺</span>
                <span>{tr("booking.location")}</span>
              </h3>
              <p className="text-sm text-slate-600 mb-3">{listing.address}</p>
              <div className="flex flex-col gap-2">
                <a
                  href={`https://mapy.cz/?q=${encodeURIComponent(listing.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-sm transition"
                >
                  <span className="flex items-center gap-2">
                    <span>🟦</span>
                    <span className="font-medium">Mapy.cz</span>
                  </span>
                  <span className="text-slate-400">↗</span>
                </a>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-sm transition"
                >
                  <span className="flex items-center gap-2">
                    <span>🟥</span>
                    <span className="font-medium">Google Maps</span>
                  </span>
                  <span className="text-slate-400">↗</span>
                </a>
              </div>
            </div>
          )}

          {listing.provider && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span>👤</span>
                <span>{tr("booking.viewed_by")}</span>
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
                  {tr("booking.safe")}
                </h3>
                <p className="text-xs text-green-800 mt-1">
                  {tr("booking.safe_desc")}
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
