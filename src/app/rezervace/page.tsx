import Link from "next/link";
import { prisma } from "@/lib/db";
import { branding } from "@/lib/branding";
import { BookingFlow } from "./BookingFlow";

export const dynamic = "force-dynamic";

export default async function RezervacePage({
  searchParams,
}: {
  searchParams: { service?: string };
}) {
  const services = await prisma.service.findMany({
    where: { active: true },
    include: {
      providers: {
        include: {
          provider: {
            select: { id: true, name: true, bio: true, active: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const initialServiceId = searchParams.service;

  return (
    <main className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 py-5 flex justify-between items-center">
          <Link href="/" className="text-xl font-semibold text-brand-700">
            {branding.businessName}
          </Link>
          <Link href="/" className="text-sm text-slate-600 hover:text-brand-700">
            ← Zpět
          </Link>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-8">Rezervace termínu</h1>
        <BookingFlow
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
          initialServiceId={initialServiceId}
        />
      </section>
    </main>
  );
}
