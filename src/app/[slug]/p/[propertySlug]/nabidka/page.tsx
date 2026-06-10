import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenantBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { brandCssVariablesForColor } from "@/lib/colors";
import { OfferForm } from "./OfferForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string; propertySlug: string };
}) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) return { title: "Nenalezeno" };
  const listing = await prisma.eventListing.findFirst({
    where: { tenantId: tenant.id, slug: params.propertySlug },
  });
  return { title: `Cenová nabídka — ${listing?.title ?? tenant.name}` };
}

export default async function OfferPage({
  params,
}: {
  params: { slug: string; propertySlug: string };
}) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) notFound();

  const listing = await prisma.eventListing.findFirst({
    where: { tenantId: tenant.id, slug: params.propertySlug },
  });
  if (!listing) notFound();

  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-50 via-slate-50 to-slate-50 py-8 px-4">
      <style
        dangerouslySetInnerHTML={{
          __html: brandCssVariablesForColor(tenant.primaryColor),
        }}
      />
      <div className="max-w-lg mx-auto">
        <div className="rounded-3xl overflow-hidden shadow-lg border border-slate-200 bg-white">
          {/* Barevný hero */}
          <div className="relative">
            {listing.imageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={listing.imageUrl}
                  alt={listing.title}
                  className="w-full h-48 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
              </>
            ) : (
              <div className="h-40 bg-gradient-to-br from-brand-500 to-brand-700" />
            )}
            <div
              className={`${listing.imageUrl ? "absolute bottom-0 left-0 right-0 text-white" : "absolute inset-0 flex flex-col justify-center text-white"} p-5`}
            >
              <div className="text-xs uppercase tracking-wide opacity-90">
                {tenant.name}
              </div>
              <div className="inline-flex items-center gap-2 text-2xl font-bold mt-1">
                <span>💰</span>
                <span>Cenová nabídka</span>
              </div>
              <div className="text-sm opacity-95 mt-1">
                {listing.address ? `📍 ${listing.address}` : listing.title}
              </div>
            </div>
          </div>

          {/* Formulář */}
          <div className="p-6">
            <OfferForm
              tenantSlug={tenant.slug}
              listingSlug={listing.slug}
              listingTitle={listing.title}
            />
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          <Link
            href={`/${tenant.slug}/p/${listing.slug}`}
            className="hover:text-slate-600"
          >
            ← Zpět na nemovitost
          </Link>
        </p>
      </div>
    </main>
  );
}
