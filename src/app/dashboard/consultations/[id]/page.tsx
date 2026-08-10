import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ConsultationEditor } from "./ConsultationEditor";

export const dynamic = "force-dynamic";

type FormQuestion = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
};

export default async function ConsultationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/login");

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { slug: true },
  });
  if (!tenant) redirect("/login");

  const listing = await prisma.eventListing.findFirst({
    where: { id: params.id, tenantId: session.user.tenantId },
    include: {
      slots: {
        orderBy: { startsAt: "asc" },
        include: { booking: { include: { client: true } } },
      },
    },
  });
  if (!listing) notFound();
  // Konzultace se edituje jen tady; nemovitost patří do sekce Nemovitosti.
  if (listing.kind !== "consultation") {
    redirect(`/dashboard/properties/${listing.id}`);
  }

  const providers = await prisma.provider.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  const formQuestions: FormQuestion[] = Array.isArray(listing.formQuestions)
    ? (listing.formQuestions as unknown as FormQuestion[])
    : [];

  return (
    <ConsultationEditor
      tenantSlug={tenant.slug}
      providers={providers}
      initial={{
        id: listing.id,
        slug: listing.slug,
        title: listing.title,
        emailName: listing.emailName ?? "",
        description: listing.description ?? "",
        address: listing.address ?? "",
        durationMinutes: listing.durationMinutes,
        providerId: listing.providerId,
        active: listing.active,
        formQuestions,
        slots: listing.slots.map((s) => ({
          id: s.id,
          startsAt: s.startsAt.toISOString(),
          endsAt: s.endsAt.toISOString(),
          bookedBy: s.booking ? s.booking.client.name : null,
        })),
      }}
    />
  );
}
