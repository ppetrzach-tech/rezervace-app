/**
 * Jednoduchý i18n systém pro klientské stránky.
 * Podporuje CS / EN / SK. Výchozí podle cookie nebo Accept-Language hlavičky.
 *
 * Použití na serveru:
 *   const locale = getLocaleFromCookies();
 *   const t = translate(locale);
 *   t("booking.title")
 */

export type Locale = "cs" | "en" | "sk";

export const LOCALES: Locale[] = ["cs", "en", "sk"];

export const LOCALE_NAMES: Record<Locale, { native: string; flag: string }> = {
  cs: { native: "Čeština", flag: "🇨🇿" },
  en: { native: "English", flag: "🇬🇧" },
  sk: { native: "Slovenčina", flag: "🇸🇰" },
};

type Dict = Record<string, string>;

const cs: Dict = {
  "booking.online": "Rezervace online",
  "booking.viewing_title": "Rezervace prohlídky",
  "booking.duration_min": "min",
  "booking.free_terms": "volných termínů",
  "booking.viewed_by": "Prohlídku vede",
  "booking.about": "O nemovitosti",
  "booking.location": "Poloha",
  "booking.safe": "Bezpečná rezervace",
  "booking.safe_desc":
    "Vaše údaje slouží jen k organizaci prohlídky. Žádné spamy ani marketing.",

  "step.date": "Termín",
  "step.form": "Údaje",
  "step.done": "Hotovo",

  "calendar.title": "Vyberte termín prohlídky",
  "calendar.prev": "Předchozí měsíc",
  "calendar.next": "Další měsíc",
  "calendar.pick_day": "Vyberte den s tečkou ⏺",
  "calendar.no_times": "V tento den nejsou volné časy. Vyberte jiný den.",
  "calendar.free_times": "Volné časy",

  "form.title": "Vaše údaje",
  "form.selected_term": "Vybraný termín",
  "form.change": "Změnit",
  "form.name": "Jméno a příjmení",
  "form.name_ph": "Jan Novák",
  "form.email": "Email",
  "form.email_ph": "jan@email.cz",
  "form.phone": "Telefon",
  "form.phone_ph": "+420 ___ ___ ___",
  "form.note": "Poznámka (volitelná)",
  "form.note_ph": "Cokoliv, co bychom měli vědět…",
  "form.extra_info": "Doplňující informace",
  "form.back": "← Zpět",
  "form.submit": "🎯 Potvrdit rezervaci",
  "form.submitting": "Odesílám…",
  "form.gdpr":
    "Odesláním souhlasíte se zpracováním vašich údajů pro účely prohlídky.",

  "done.title": "Rezervace potvrzena!",
  "done.subtitle": "Těšíme se na vás",
  "done.your_viewing": "Vaše prohlídka",
  "done.email_sent": "Potvrzovací email odeslán na",
  "done.email_no": "Rezervace byla zaznamenána",
  "done.ics": "V emailu najdete kalendářovou událost (.ics)",
  "done.aware": "o vás ví a očekává vás",
  "done.tip":
    "Tip: Pokud nemůžete přijít, dejte nám prosím včas vědět odpovědí na email s potvrzením.",
  "done.booking_nr": "Číslo:",

  "noslots.title": "Momentálně nejsou volné termíny",
  "noslots.body": "Zkuste to později nebo nás kontaktujte přímo.",
};

const en: Dict = {
  "booking.online": "Online booking",
  "booking.viewing_title": "Book a viewing",
  "booking.duration_min": "min",
  "booking.free_terms": "available times",
  "booking.viewed_by": "Viewing led by",
  "booking.about": "About the property",
  "booking.location": "Location",
  "booking.safe": "Safe booking",
  "booking.safe_desc":
    "Your data is only used to organize the viewing. No spam or marketing.",

  "step.date": "Date",
  "step.form": "Details",
  "step.done": "Done",

  "calendar.title": "Choose a viewing date",
  "calendar.prev": "Previous month",
  "calendar.next": "Next month",
  "calendar.pick_day": "Pick a day with a dot ⏺",
  "calendar.no_times": "No times on this day. Try another.",
  "calendar.free_times": "Available times",

  "form.title": "Your details",
  "form.selected_term": "Selected time",
  "form.change": "Change",
  "form.name": "Full name",
  "form.name_ph": "John Smith",
  "form.email": "Email",
  "form.email_ph": "john@email.com",
  "form.phone": "Phone",
  "form.phone_ph": "+1 ___ ___ ___",
  "form.note": "Note (optional)",
  "form.note_ph": "Anything we should know…",
  "form.extra_info": "Additional info",
  "form.back": "← Back",
  "form.submit": "🎯 Confirm booking",
  "form.submitting": "Sending…",
  "form.gdpr":
    "By submitting, you agree to our processing of your data for the purpose of the viewing.",

  "done.title": "Booking confirmed!",
  "done.subtitle": "We're looking forward to seeing you",
  "done.your_viewing": "Your viewing",
  "done.email_sent": "Confirmation email sent to",
  "done.email_no": "Your booking has been recorded",
  "done.ics": "You'll find a calendar event (.ics) attached to the email",
  "done.aware": "knows and expects you",
  "done.tip":
    "Tip: If you can't make it, please let us know by replying to the confirmation email.",
  "done.booking_nr": "Number:",

  "noslots.title": "No times available right now",
  "noslots.body": "Try again later or contact us directly.",
};

const sk: Dict = {
  "booking.online": "Rezervácia online",
  "booking.viewing_title": "Rezervácia obhliadky",
  "booking.duration_min": "min",
  "booking.free_terms": "voľných termínov",
  "booking.viewed_by": "Obhliadku vedie",
  "booking.about": "O nehnuteľnosti",
  "booking.location": "Poloha",
  "booking.safe": "Bezpečná rezervácia",
  "booking.safe_desc":
    "Vaše údaje slúžia len na organizáciu obhliadky. Žiadny spam ani marketing.",

  "step.date": "Termín",
  "step.form": "Údaje",
  "step.done": "Hotovo",

  "calendar.title": "Vyberte termín obhliadky",
  "calendar.prev": "Predchádzajúci mesiac",
  "calendar.next": "Ďalší mesiac",
  "calendar.pick_day": "Vyberte deň s bodkou ⏺",
  "calendar.no_times": "V tento deň nie sú voľné časy. Vyberte iný deň.",
  "calendar.free_times": "Voľné časy",

  "form.title": "Vaše údaje",
  "form.selected_term": "Vybraný termín",
  "form.change": "Zmeniť",
  "form.name": "Meno a priezvisko",
  "form.name_ph": "Ján Nový",
  "form.email": "Email",
  "form.email_ph": "jan@email.sk",
  "form.phone": "Telefón",
  "form.phone_ph": "+421 ___ ___ ___",
  "form.note": "Poznámka (voliteľná)",
  "form.note_ph": "Čokoľvek, čo by sme mali vedieť…",
  "form.extra_info": "Doplňujúce informácie",
  "form.back": "← Späť",
  "form.submit": "🎯 Potvrdiť rezerváciu",
  "form.submitting": "Odosielam…",
  "form.gdpr":
    "Odoslaním súhlasíte so spracovaním vašich údajov pre účely obhliadky.",

  "done.title": "Rezervácia potvrdená!",
  "done.subtitle": "Tešíme sa na vás",
  "done.your_viewing": "Vaša obhliadka",
  "done.email_sent": "Potvrdzovací email odoslaný na",
  "done.email_no": "Rezervácia bola zaznamenaná",
  "done.ics": "V emaile nájdete kalendárovú udalosť (.ics)",
  "done.aware": "o vás vie a očakáva vás",
  "done.tip":
    "Tip: Ak nemôžete prísť, dajte nám prosím včas vedieť odpoveďou na email s potvrdením.",
  "done.booking_nr": "Číslo:",

  "noslots.title": "Momentálne nie sú voľné termíny",
  "noslots.body": "Skúste to neskôr alebo nás kontaktujte priamo.",
};

const DICT: Record<Locale, Dict> = { cs, en, sk };

export function getLocaleFromString(s: string | null | undefined): Locale {
  if (!s) return "cs";
  const lower = s.toLowerCase();
  if (lower.startsWith("en")) return "en";
  if (lower.startsWith("sk")) return "sk";
  return "cs";
}

export function getDictionary(locale: Locale): Dict {
  return DICT[locale] ?? DICT.cs;
}

/**
 * Vrátí překládací funkci pro daný jazyk.
 */
export function t(locale: Locale): (key: string) => string {
  const dict = getDictionary(locale);
  return (key: string) => dict[key] ?? key;
}
