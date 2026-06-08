import { escapeHtml } from "./email";

/**
 * Převede „markdownish" text z notifikačních šablon na HTML:
 *  - **tučně** → <strong>
 *  - [text](url) → klikací odkaz
 *  - holé URL → odkaz
 *  - odstraní řádky s prázdným odkazem [text]()
 *  - \n → <br/>
 *
 * DŮLEŽITÉ: placeholdery pro odkazy/tučné používají sentinel %%TOK_n%%,
 * který NEKOLIDUJE s čísly v textu (telefon "724 191 620",
 * adresa "Praha 7" apod.).
 */
export function markdownishToHtml(s: string): string {
  // 0) odstraň řádky s prázdným markdown odkazem [text]()
  let cleaned = s
    .split("\n")
    .filter((line) => !/\[[^\]]*\]\(\s*\)/.test(line))
    .join("\n");
  cleaned = cleaned.replace(/\[[^\]]*\]\(\s*\)/g, "");

  const tokens: string[] = [];
  const place = (html: string): string => {
    const id = tokens.length;
    tokens.push(html);
    return `%%TOK_${id}%%`;
  };

  let work = cleaned;

  // 1) markdown odkazy [text](url)
  work = work.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (_, text, url) =>
      place(
        `<a href="${url}" style="color:#2563eb;text-decoration:underline;">${escapeHtml(text)}</a>`,
      ),
  );

  // 2) tučně **text**
  work = work.replace(/\*\*([^*]+)\*\*/g, (_, text) =>
    place(`<strong>${escapeHtml(text)}</strong>`),
  );

  // 3) holé URL
  work = work.replace(/(https?:\/\/[^\s<]+)/g, (url) =>
    place(
      `<a href="${url}" style="color:#2563eb;text-decoration:underline;">${escapeHtml(url)}</a>`,
    ),
  );

  // 4) escape zbytku (sentinel %%TOK_n%% projde beze změny)
  let out = escapeHtml(work);

  // 5) obnov sentinel placeholdery
  out = out.replace(/%%TOK_(\d+)%%/g, (_, i) => tokens[parseInt(i, 10)] ?? "");

  // 6) konce řádků
  return out.replace(/\n/g, "<br/>");
}
