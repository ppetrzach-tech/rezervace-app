/**
 * České skloňování křestních jmen do 5. pádu (oslovení / vokativ)
 * a formální oslovení pro emaily. Vždy VYKÁNÍ.
 *
 * Pravidla jsou heuristická — pokryjí běžná česká jména. Pokud si nejsme
 * jistí, vrátíme jméno beze změny (raději bez chyby).
 */

// Akademické a profesní tituly (před i za jménem) — normalizováno (bez teček, lowercase).
const TITLES = new Set([
  "bc", "bca", "ing", "mudr", "mddr", "mvdr", "judr", "phdr", "rndr",
  "pharmdr", "thlic", "thdr", "mgr", "mga", "paeddr", "dr", "prof",
  "doc", "phd", "csc", "drsc", "dis", "mba", "llm", "dipl", "arch",
]);

function normToken(t: string): string {
  return t.replace(/[.,]/g, "").toLowerCase();
}

/**
 * Odstraní akademické/profesní tituly před i za jménem.
 * "Mgr. Jan Novák" → "Jan Novák", "Jan Novák, Ph.D." → "Jan Novák".
 */
export function stripTitles(fullName: string): string {
  let tokens = fullName.trim().split(/\s+/).filter(Boolean);
  // tituly na začátku
  while (tokens.length > 1 && TITLES.has(normToken(tokens[0]))) tokens.shift();
  // tituly na konci
  while (
    tokens.length > 1 &&
    TITLES.has(normToken(tokens[tokens.length - 1]))
  )
    tokens.pop();
  return tokens.join(" ").replace(/[,\s]+$/, "").trim();
}

/** Křestní jméno (první slovo po odstranění titulů). */
export function firstName(fullName: string): string {
  const clean = stripTitles(fullName);
  return clean.split(/\s+/)[0] || clean;
}

/** Detekce ženského jména/příjmení (česká příjmení -ová/-á jsou spolehlivá). */
export function isFemaleName(fullName: string): boolean {
  const parts = stripTitles(fullName).split(/\s+/);
  const first = (parts[0] || "").toLowerCase();
  const last = (parts[parts.length - 1] || "").toLowerCase();

  // Příjmení -ová / -á → žena (velmi spolehlivé)
  if (/ová$|á$/.test(last)) return true;

  // Křestní jméno končící na -a (kromě výjimek jako "Honza", "Saša" = muž)
  const maleAExceptions = ["honza", "saša", "sasa", "nikita", "kuba", "ilja", "nikola"];
  if (/a$/.test(first) && !maleAExceptions.includes(first)) return true;

  // Křestní jméno končící na -e bývá ženské (Marie, Lucie, Alice)
  if (/ie$/.test(first)) return true;

  return false;
}

/**
 * Vokativ (5. pád) křestního jména. "Petr" → "Petře", "Jana" → "Jano".
 * Heuristika; při nejistotě vrací beze změny.
 */
export function vocativeFirstName(fullName: string): string {
  const first = firstName(fullName).trim();
  if (!first) return "";
  const lower = first.toLowerCase();
  const female = isFemaleName(fullName);

  if (female) {
    // -a → -o (Jana→Jano, Petra→Petro, Eva→Evo, Tereza→Terezo)
    if (/a$/.test(first)) return first.slice(0, -1) + "o";
    // -ie / -e → beze změny (Marie, Lucie, Alice)
    return first;
  }

  // Mužská jména
  // končící na samohlásku (Honza→Honzo, Saša→Sašo)
  if (/a$/i.test(first)) return first.slice(0, -1) + "o";
  if (/[eiouyé]$/i.test(first)) return first; // Jiří, Tonda? většinou beze změny

  // -ek → -ku (Marek→Marku, Radek→Radku)
  if (/ek$/i.test(first)) return first.slice(0, -2) + "ku";
  // -el → -le (Karel→Karle, Pavel→Pavle)
  if (/el$/i.test(first)) return first.slice(0, -2) + "le";
  // -r → -ře (Petr→Petře, Otakar→Otakare? bereme -ře pro běžné)
  if (/r$/i.test(lower)) return first.slice(0, -1) + "ře";
  // měkké/sykavky -š -č -ž -c -j -ř -ď -ť -ň → -i (Tomáš→Tomáši, Ondřej→Ondřeji)
  if (/[šžčřcjďťň]$/i.test(first)) return first + "i";
  // tvrdé -k -g -h -ch → -u (Dominik→Dominiku, Mark→Marku)
  if (/[kgh]$/i.test(first)) return first + "u";
  // ostatní souhlásky → -e (Jan→Jane, Martin→Martine, David→Davide, Adam→Adame)
  if (/[bdflmnpstvz]$/i.test(first)) return first + "e";

  return first;
}

/**
 * Formální oslovení do emailu. VŽDY vykání.
 * Vrací např. "Dobrý den, Petře" / "Dobrý den, Jano".
 * Pokud jméno chybí, jen "Dobrý den".
 */
export function formalGreeting(fullName: string): string {
  const voc = vocativeFirstName(fullName);
  return voc ? `Dobrý den, ${voc}` : "Dobrý den";
}
