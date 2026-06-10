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
    <main className="min-h-screen bg-slate-50 py-8 px-4">
      <style
        dangerouslySetInnerHTML={{
          __html: brandCssVariablesForColor(tenant.primaryColor),
        }}
      />
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-6">
          <div className="text-sm text-slate-500">{tenant.name}</div>
          <h1 className="text-2xl font-bold mt-1">Cenová nabídka</h1>
          <p className="text-slate-600 mt-1">{listing.title}</p>
          {listing.address && (
            <p className="text-sm text-slate-500">📍 {listing.address}</p>
          )}
        </div>

        {listing.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.imageUrl}
            alt={listing.title}
            className="w-full h-44 object-cover rounded-xl mb-6 border border-slate-200"
          />
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <OfferForm
            tenantSlug={tenant.slug}
            listingSlug={listing.slug}
            listingTitle={listing.title}
          />
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
