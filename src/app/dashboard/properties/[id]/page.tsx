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

  // === Přehled (statistiky) — počítáno z existujících dat ===
  const allBookings = await prisma.booking.findMany({
    where: { listingId: listing.id },
    select: {
      id: true,
      status: true,
      confirmedByClientAt: true,
      startsAt: true,
      endsAt: true,
      clientResponse: true,
      clientId: true,
    },
  });
  const now = new Date();
  const active = allBookings.filter((b) => b.status !== "cancelled");
  const bookingIds = allBookings.map((b) => b.id);
  const emailsSent = bookingIds.length
    ? await prisma.notificationLog.count({
        where: { bookingId: { in: bookingIds }, channel: "email", status: "sent" },
      })
    : 0;
  const stats = {
    slotsTotal: listing.slots.length,
    slotsFree: listing.slots.filter(
      (s) => !s.booking && s.startsAt.getTime() > now.getTime(),
    ).length,
    registrations: allBookings.length,
    upcoming: active.filter((b) => b.endsAt.getTime() >= now.getTime()).length,
    completed: active.filter((b) => b.endsAt.getTime() < now.getTime()).length,
    confirmed: active.filter((b) => b.confirmedByClientAt).length,
    cancelled: allBookings.filter((b) => b.status === "cancelled").length,
    declined: allBookings.filter((b) => b.clientResponse === "decline").length,
    rescheduled: allBookings.filter((b) => b.clientResponse === "reschedule").length,
    emailsSent,
    uniqueClients: new Set(allBookings.map((b) => b.clientId)).size,
  };

  // formQuestions je JSON; přetypujeme
  type QType =
    | "text"
    | "textarea"
    | "yesno"
    | "select"
    | "number"
    | "rating"
    | "date"
    | "phone";
  const ALLOWED_TYPES: QType[] = [
    "text",
    "textarea",
    "yesno",
    "select",
    "number",
    "rating",
    "date",
    "phone",
  ];
  type Q = {
    id: string;
    label: string;
    type: QType;
    required?: boolean;
    options?: string[];
  };
  const formQuestions: Q[] = Array.isArray(listing.formQuestions)
    ? (listing.formQuestions as unknown as Q[]).map((q) => ({
        id: String(q.id),
        label: String(q.label),
        type: (ALLOWED_TYPES as string[]).includes(q.type as string)
          ? (q.type as QType)
          : "text",
        required: !!q.required,
        options: Array.isArray(q.options) ? q.options : undefined,
      }))
    : [];

  return (
    <PropertyEditor
      tenantSlug={tenant?.slug ?? ""}
      stats={stats}
      initial={{
        id: listing.id,
        slug: listing.slug,
        title: listing.title,
        description: listing.description ?? "",
        address: listing.address ?? "",
        imageUrl: listing.imageUrl ?? "",
        documentsUrl: listing.documentsUrl ?? "",
        virtualTourUrl: listing.virtualTourUrl ?? "",
        propertyWebUrl: listing.propertyWebUrl ?? "",
        offerFormUrl: listing.offerFormUrl ?? "",
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
