import { createHash, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "./db";

/**
 * Ověření integrační hlavičky `x-integration-secret` proti env INTEGRATION_SECRET.
 * Porovnává se v konstantním čase (přes SHA-256, aby nevadila různá délka).
 * Vrací NextResponse 401, když ověření selže; jinak null.
 */
export function requireIntegrationSecret(req: NextRequest): NextResponse | null {
  const expected = process.env.INTEGRATION_SECRET;
  const given = req.headers.get("x-integration-secret") ?? "";
  if (!expected || expected.length < 16) {
    // Bez nastaveného (dostatečně dlouhého) secretu je integrace vypnutá.
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  return null;
}

/**
 * Tenant pro integraci: explicitní `tenantSlug` → env INTEGRATION_TENANT_SLUG →
 * jediný tenant v systému. Jinak null (volající vrátí 400).
 */
export async function resolveIntegrationTenant(tenantSlug?: string) {
  const slug = tenantSlug || process.env.INTEGRATION_TENANT_SLUG;
  if (slug) return prisma.tenant.findUnique({ where: { slug } });
  const tenants = await prisma.tenant.findMany({ take: 2 });
  return tenants.length === 1 ? tenants[0] : null;
}

export const INTEGRATION_SOURCE = "tabidoo";
