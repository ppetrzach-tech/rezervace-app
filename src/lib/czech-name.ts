/**
 * České skloňování křestních jmen do 5. pádu (oslovení / vokativ)
 * a formální oslovení pro emaily. Vždy VYKÁNÍ.
 *
 * Pravidla jsou heuristická — pokryjí běžná česká jména. Pokud si nejsme
 * jistí, vrátíme jméno beze změny (raději bez chyby).
 */

/** Detekce ženského jména/příjmení (česká příjmení -ová/-á jsou spolehlivá). */
export function isFemaleName(fullName: string): boolean {
  const parts = fullName.trim().split(/\s+/);
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
  const first = (fullName.trim().split(/\s+/)[0] || "").trim();
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
