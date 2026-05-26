import { prisma } from "./db";

export async function getTenantBySlug(slug: string) {
  return prisma.tenant.findUnique({
    where: { slug },
  });
}

/**
 * Sluggify text — z "Salon Krásy" udělá "salon-krasy".
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // odstranění diakritiky
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/**
 * Validuje, jestli je slug rezervovaný (kolize s routami).
 */
const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "dashboard",
  "login",
  "signup",
  "logout",
  "settings",
  "about",
  "pricing",
  "terms",
  "privacy",
  "help",
  "support",
  "_next",
  "static",
  "public",
]);

export function isSlugReserved(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}
