import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PropertyEditor } from "./PropertyEditor";

export const dynamic = "force-dynamic";

export default async function PropertyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.tenantId) redirect("/login");

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

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
  });

  const providers = await prisma.provider.findMany({
    where: { tenantId: session.user.tenantId, active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // formQuestions je JSON; přetypujeme
  type Q = {
    id: string;
    label: string;
    type: "text" | "textarea" | "yesno" | "select" | "number";
    required?: boolean;
    options?: string[];
  };
  const formQuestions: Q[] = Array.isArray(listing.formQuestions)
    ? (listing.formQuestions as unknown as Q[]).map((q) => ({
        id: String(q.id),
        label: String(q.label),
        type:
          q.type === "textarea" || q.type === "yesno" || q.type === "select" || q.type === "number"
            ? q.type
            : "text",
        required: !!q.required,
        options: Array.isArray(q.options) ? q.options : undefined,
      }))
    : [];

  return (
    <PropertyEditor
      tenantSlug={tenant?.slug ?? ""}
      initial={{
        id: listing.id,
        slug: listing.slug,
        title: listing.title,
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
          bookedBy: s.booking
            ? `${s.booking.client.name} (${s.booking.client.email})`
            : null,
        })),
      }}
      providers={providers}
    />
  );
}
