import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Starý rezervační flow přes obecné „Typy schůzek" (Service + pracovní doba)
 * byl vyřazen. Prohlídky mají vlastní stránky (/[slug]/p/…) a konzultace také.
 * Případné staré odkazy sem přesměrujeme na úvodní stránku firmy.
 */
export default function BookPage({ params }: { params: { slug: string } }) {
  redirect(`/${params.slug}`);
}
