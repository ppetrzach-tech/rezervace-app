/**
 * Branding aplikace načítaný z env proměnných.
 * Změnou .env upravíte název, tagline i barvy bez zásahu do kódu.
 *
 * NEXT_PUBLIC_* proměnné jsou dostupné i v prohlížeči.
 */
export const branding = {
  businessName:
    process.env.NEXT_PUBLIC_BUSINESS_NAME || "Vaše firma",
  tagline:
    process.env.NEXT_PUBLIC_BUSINESS_TAGLINE ||
    "Rezervujte si termín online.",
  // Hex barva bez #
  primaryColor: process.env.NEXT_PUBLIC_PRIMARY_COLOR || "2563eb",
};

/**
 * Hezký label pro typ lokace.
 */
export function locationLabel(type: string): string {
  switch (type) {
    case "in_person":
      return "Osobně";
    case "online":
      return "Online";
    case "phone":
      return "Telefonicky";
    case "custom":
    default:
      return "Místo upřesní poskytovatel";
  }
}

/**
 * Hezký emoji pro typ lokace.
 */
export function locationEmoji(type: string): string {
  switch (type) {
    case "in_person":
      return "📍";
    case "online":
      return "💻";
    case "phone":
      return "📞";
    case "custom":
    default:
      return "📌";
  }
}
