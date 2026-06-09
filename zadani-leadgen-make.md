# Technické zadání — Lead generátor pro realitního makléře (Make automatizace)

> Dokument pro vývojáře / implementátora. Popisuje automatizaci „formulář → odhad ceny → e-mail → CRM" postavenou v **Make.com**. Marketingová/copy vrstva (landing page, reklamy) je zmíněna jen jako kontext, hlavní scope je **automatizace**.

---

## 1. Cíl a obchodní kontext

Solo realitní makléř chce vlastní lead-gen kanál na **prodávající nemovitostí**. Mechanika:

1. Návštěvník na landing page vyplní krátký formulář (adresa, typ, výměra, stav, e-mail, telefon).
2. Systém zavolá **Cemap API** → vrátí cenové **rozpětí (min–max)**.
3. Rozpětí dorazí návštěvníkovi **e-mailem** (ne na obrazovku) — vynutí platný e-mail, vznikne kontaktní bod.
4. E-mail **nekončí číslem, ale výzvou k hovoru** (přesné číslo až po konzultaci).
5. Lead se zapíše do **CRM (Tabidoo)** + **okamžitá notifikace makléři** → volá co nejdřív.

**Klíčový princip:** rychlost reakce je úzké hrdlo. E-mail musí odejít automaticky „do pár minut", makléř musí být notifikován okamžitě.

---

## 2. Architektura (high-level)

```
Landing page (vlastní web)
   │  formulář (POST)
   ▼
Make.com  ── webhook ──► [validace] ──► [Cemap: min–max] ──► [logika šířky rozpětí]
                                                                │
                          ┌─────────────────────────────────────┤
                          ▼                                     ▼
                   Ecomail (e-mail s odhadem)          Tabidoo (zápis leadu)
                   + nurture sekvence                  + notifikace makléři
```

### Použité nástroje (rozhodnuto)
| Vrstva | Nástroj | Poznámka |
|---|---|---|
| Orchestrace | **Make.com** | Hlavní logika scénáře |
| Formulář | **Vlastní HTML → Make webhook** | MVP lze přes Tally (embed + webhook) |
| Oceňování | **Cemap API** | Vrací cenové rozpětí — viz §6 (nutno ověřit přístup) |
| CRM / úložiště | **Tabidoo** | Nativní Make konektor |
| E-mail + nurture | **Ecomail** | Triggered e-mail + drip kampaně, Make konektor |

---

## 3. Make scénář — moduly krok za krokem

```
[1] Webhook (Custom webhook)
      → příjem dat z formuláře
[2] Filtr / validace
      → platný e-mail, vyplněná povinná pole
      → při chybě: notifikace makléři "zkontroluj lead", konec větve
[3] HTTP / Cemap modul
      → odešle parametry nemovitosti, vrátí min–max rozpětí
[4] Tools / Set variables — výpočet šířky rozpětí
      → sirka = max - min
      → relativni_sirka = (max - min) / ((max + min) / 2)
      → rozhodnutí, co zobrazit v e-mailu (úzké vs. široké)
[5] Router → 2 větve běží paralelně:
      [5a] Ecomail — triggered e-mail s odhadem návštěvníkovi
      [5b] Tabidoo — vytvoření záznamu leadu + notifikace makléři
[6] Nurture tagging
      → pokud lead označí "teď neprodávám" → přidat do Ecomail nurture sekvence
[7] Error handler (na celý scénář)
      → Cemap/HTTP chyba: lead se přesto uloží, makléř notifikován,
        návštěvníkovi odejde fallback e-mail "odhad připravujeme, ozveme se"
```

---

## 4. Datová struktura formuláře (webhook payload)

Formulář na landing page posílá `POST` na Make webhook. Doporučený JSON:

```json
{
  "adresa": "Ulice 123, Město",
  "typ_nemovitosti": "byt",          // byt | dům | pozemek | ...
  "vymera_m2": 68,
  "stav": "dobrý",                    // novostavba | po rekonstrukci | dobrý | před rekonstrukcí
  "dispozice": "2+kk",               // volitelné, ale pomáhá Cemapu
  "email": "klient@email.cz",
  "telefon": "+420...",              // POVINNÉ
  "gdpr_souhlas": true,
  "utm_source": "google",
  "utm_campaign": "odhad-mesto",
  "utm_term": "odhad ceny bytu",
  "stranka_url": "https://..."
}
```

**Povinná pole:** adresa, typ_nemovitosti, vymera_m2, email, telefon, gdpr_souhlas.
**Telefon je povinný** (rozhodnuto — silnější lead, makléř volá hned; akceptujeme nižší konverzi).

---

## 5. Logika šířky rozpětí (krok [4])

Cemap vždy vrací rozpětí. Podle jeho šířky se mění obsah e-mailu — nikdy nedáváme „hotové číslo":

- **Úzké rozpětí** (např. 4,30–4,40 mil.) → v e-mailu NEukazovat tak, aby měl klient pocit, že už ví vše.
  → Ukázat jen **střed** nebo formulaci „přesné číslo řeknu po krátké konzultaci".
- **Široké rozpětí** → zdůraznit, že **nejistotu sníží konzultace** (stav, dispozice, patro, rekonstrukce, poptávka).

Práh úzké/široké: doporučuji `relativni_sirka < 0.05` = úzké (doladíme po prvních reálných datech z Cemapu).

**Vždy formulovat jako „odhad z tržních dat", NE „cena vaší nemovitosti"** (drží očekávání, chrání makléře po prohlídce).

---

## 6. ⚠ Cemap API — nutno ověřit / doplnit (BLOKER č. 1)

Zákazník má Cemap „napojený přímo v CRM (Tabidoo)" a domnívá se, že Make k odhadům dosáhne. **První úkol implementátora:**

1. **Zjistit, jak je Cemap reálně dostupný:**
   - (A) Přímý API přístup → **API klíč + dokumentace** (endpoint, auth, request/response schema). → Make volá Cemap přes HTTP modul. **Preferovaná varianta.**
   - (B) Cemap je dostupný jen přes Tabidoo → Make spustí výpočet přes Tabidoo a přečte výsledek.
2. **Doplnit do zadání:**
   - URL endpointu odhadu
   - Způsob autentizace (API key / Bearer / …)
   - Jaké vstupní parametry Cemap potřebuje (adresa? GPS? typ? výměra? dispozice?)
   - Formát výstupu (kde v JSON je `min` a `max`)
   - Rate limity / cena za dotaz

> Doporučení: pokud to jde, volat Cemap **přímo z Make (HTTP modul)** — veškerá logika (rozpětí → e-mail) pak žije na jednom místě a Tabidoo zůstane čistým úložištěm.

---

## 7. Ecomail — e-mail s odhadem + nurture

- **Triggered (transakční) e-mail** odeslaný hned po získání odhadu.
  - Obsahuje: odhad podle logiky §5, prvky důvěry, **výzvu k hovoru jako závěr** (ne číslo).
  - Měřit open rate (kdo otevřel = teplejší lead).
- **Nurture sekvence** pro leady „teď neprodávám" (prodej často za 6–12 měsíců) — drip kampaň, nezahazovat.
- **Co potřebuje implementátor:** Ecomail účet + API klíč, založené seznamy/automatizace, schválené šablony e-mailů.
- **Copy e-mailu** dodá zákazník / připraví se zvlášť (viz §10).

---

## 8. Tabidoo — zápis leadu + notifikace

- **Vytvořit/ověřit tabulku „Leady"** s poli odpovídajícími §4 + `cena_min`, `cena_max`, `sirka_rozpeti`, `datum`, `stav_leadu`.
- Po zápisu **notifikace makléři** — okamžitě (e-mail / SMS / push / Slack — dle preference makléře).
- **Co potřebuje implementátor:** Tabidoo přístup (API token), strukturu tabulky, kam posílat notifikaci.

---

## 9. Ošetření chyb (důležité — lead nikdy neztratit)

| Situace | Co se má stát |
|---|---|
| Cemap selže / nevrátí rozpětí | Lead se **přesto uloží** do Tabidoo, makléř notifikován, klient dostane e-mail „odhad připravujeme, ozveme se" |
| Neplatný e-mail / chybí pole | Větev „chyba" → notifikace makléři ke kontrole |
| Ecomail výpadek | Retry; lead je už v Tabidoo, makléř kontaktuje ručně |

---

## 10. Mimo Make — připraví se paralelně (copy & marketing)

Nutné pro spuštění, ale mimo automatizaci:
- **Město/region** (zatím `[MĚSTO]`) — odemyká všechny texty.
- Headline + landing page copy (dedikovaná stránka, jeden cíl, prvky důvěry, GDPR u tlačítka).
- Znění e-mailu s odhadem (§7).
- Google Ads texty (hlavní kanál) + Meta retargeting (doplněk).
- Scénář prvního hovoru (odhad → schůzka).

---

## 11. Měření (KPI)
- Cena za lead
- % leadů → schůzka
- % schůzek → podpis

---

## 12. Checklist přístupů, které implementátor potřebuje

- [ ] **Make.com** — přístup do účtu / pozvánka do teamu
- [ ] **Cemap** — API klíč + dokumentace *(nebo potvrzení, že jde jen přes Tabidoo)*
- [ ] **Tabidoo** — API token + struktura tabulky Leady
- [ ] **Ecomail** — API klíč + seznamy + šablony
- [ ] **Landing page** — možnost vložit formulář / nastavit POST na webhook
- [ ] **Notifikace makléři** — kanál (e-mail / SMS / Slack) + kontakt

---

## 13. Pořadí implementace

1. Ověřit Cemap přístup (§6) — **bloker, řešit první**
2. Webhook + datová struktura (§4)
3. Cemap volání + logika šířky rozpětí (§5)
4. Ecomail triggered e-mail (§7)
5. Tabidoo zápis + notifikace (§8)
6. Nurture větev + error handling (§9)
7. End-to-end test na testovacím leadu

---

## Mimo scope (rozhodnuto)
- Žádný Reas-style marketplace ani síť makléřů.
- Žádný vlastní oceňovací algoritmus (řeší Cemap).
