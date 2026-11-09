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

/**
 * Načte tělo požadavku jako JSON NEBO formulář (application/x-www-form-urlencoded).
 * Formulář je „plochý" (snadné v Make bez escapování JSONu): clientName, clientEmail,
 * clientPhone se poskládají do `client`, prázdná pole se vynechají,
 * sendConfirmation "false"/"0" → false.
 */
export async function readIntegrationBody(req: NextRequest): Promise<unknown> {
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  let flatSource: Iterable<[string, string]> | null = null;

  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const pairs: [string, string][] = [];
    form.forEach((v, k) => {
      if (typeof v === "string") pairs.push([k, v]);
    });
    flatSource = pairs;
  } else {
    // Čteme jako text a rozhodneme podle obsahu — Make někdy nepošle správnou
    // hlavičku Content-Type, proto se na ni nespoléháme.
    const text = (await req.text()).trim();
    if (!text) return {};
    if (text.startsWith("{") || text.startsWith("[")) {
      try {
        return JSON.parse(text);
      } catch {
        return undefined;
      }
    }
    flatSource = new URLSearchParams(text).entries();
  }

  const out: Record<string, unknown> = {};
  const client: Record<string, string> = {};
  for (const [k, raw] of flatSource) {
    const v = raw.trim();
    if (v === "") continue;
    if (k === "clientName") client.name = v;
    else if (k === "clientEmail") client.email = v;
    else if (k === "clientPhone") client.phone = v;
    else if (k === "sendConfirmation")
      out.sendConfirmation = !["false", "0", "ne", "no"].includes(v.toLowerCase());
    else out[k] = v;
  }
  if (Object.keys(client).length) out.client = client;
  return out;
}
