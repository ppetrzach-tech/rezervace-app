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

/**
 * Vrátí mužský nebo ženský tvar slova podle pohlaví klienta.
 * Např. gendered(jmeno, "chtěl", "chtěla") nebo gendered(jmeno, "vítán", "vítána").
 */
export function gendered(
  fullName: string,
  masculine: string,
  feminine: string,
): string {
  return isFemaleName(fullName) ? feminine : masculine;
}

/**
 * Převede formální (vykací) text do rodu podle pohlaví klienta.
 *
 * Cílí jen na jednoznačné oslovení adresáta — spojení typu „byste měli",
 * „byste si chtěli", „jste vítáni" a lomítkové tvary „chtěl/a". Plurálové
 * tvary se převedou na mužský/ženský singulár. Vodicí slovo (byste/abyste/
 * jste) se zachová včetně velikosti písmen díky zpětnému odkazu.
 *
 * Bezpečné pro běžné e-maily o prohlídce; neřeší zcela libovolný text.
 */
export function genderizeFormalText(text: string, fullName: string): string {
  if (!text) return text;
  const female = isFemaleName(fullName);
  const rules: Array<[RegExp, string, string]> = [
    [/\b(a?byste)\s+měli\b/gi, "$1 měl", "$1 měla"],
    [/\b(a?byste)(\s+si)?\s+chtěli\b/gi, "$1$2 chtěl", "$1$2 chtěla"],
    [/\b(a?byste)(\s+si)?\s+přáli\b/gi, "$1$2 přál", "$1$2 přála"],
    [/\b(a?byste)\s+potřebovali\b/gi, "$1 potřeboval", "$1 potřebovala"],
    [/\b(a?byste)\s+chtěli\b/gi, "$1 chtěl", "$1 chtěla"],
    [/\b(jste)\s+vítáni\b/gi, "$1 vítán", "$1 vítána"],
    [/\b(jste)\s+spokojeni\b/gi, "$1 spokojen", "$1 spokojena"],
    [/\bspokojen\/á\b/gi, "spokojen", "spokojena"],
    [/\bchtěl\/a\b/gi, "chtěl", "chtěla"],
    [/\bměl\/a\b/gi, "měl", "měla"],
    [/\brád\/a\b/gi, "rád", "ráda"],
    [/\bdostal\/a\b/gi, "dostal", "dostala"],
    [/\bvítán\/a\b/gi, "vítán", "vítána"],
  ];
  let out = text;
  for (const [re, masc, fem] of rules) {
    out = out.replace(re, female ? fem : masc);
  }
  return out;
}
