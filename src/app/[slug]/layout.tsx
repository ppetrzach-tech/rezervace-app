import { notFound } from "next/navigation";
import { getTenantBySlug } from "@/lib/tenant";
import { brandCssVariablesForColor } from "@/lib/colors";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) return { title: "Stránka nenalezena" };
  return {
    title: `${tenant.name} — rezervace`,
    description: tenant.tagline ?? undefined,
  };
}

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant || !tenant.active) notFound();
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: brandCssVariablesForColor(tenant.primaryColor),
        }}
      />
      {children}
    </>
  );
}
