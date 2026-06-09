/**
 * Veřejná (kanonická) adresa systému.
 *
 * Používá se pro generování odkazů, které vidí klient nebo se posílají ven:
 *  • odkazy v emailech (potvrdit / přeplánovat / přidat do kalendáře / .ics)
 *  • QR kódy a sdílecí odkazy v dashboardu
 *  • veřejné rezervační stránky
 *
 * Záměrně NEčte NEXTAUTH_URL (ta může na Vercelu zůstat na *.vercel.app kvůli
 * přihlašování). Pro přepnutí domény stačí změnit jen tuto hodnotu v kódu,
 * případně přebít proměnnou NEXT_PUBLIC_SITE_URL.
 */
export const PUBLIC_BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://rezervace.zach-petr.cz"
).replace(/\/+$/, "");
