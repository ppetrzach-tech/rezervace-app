# Technické zadání — Lead generátor pro realitního makléře (vlastní aplikace)

> Lead-gen aplikace „landing page → odhad ceny → e-mail → CRM". Postaveno jako **jeden projekt (Next.js, nasazený na Vercelu)** — landing page i backend logika pohromadě.
>
> **Architektura: SaaS-ready, zatím pro jednoho makléře (varianta C).** Appka běží hned pro majitele, ale uvnitř je tvarovaná jako produkt, který půjde v budoucnu pronajímat dalším makléřům bez přepisu. Multi-tenant nadstavba (přihlašování, fakturace, UI na konektory) se staví až ve fázi 2.

---

## 1. Cíl a obchodní kontext

Solo realitní makléř chce vlastní lead-gen kanál na **prodávající nemovitostí**. Mechanika:

1. Návštěvník na landing page vyplní krátký formulář (adresa, typ, výměra, stav, e-mail, telefon).
2. Backend zavolá **Cemap API** → vrátí cenové **rozpětí (min–max)**.
3. Rozpětí dorazí návštěvníkovi **e-mailem** (ne na obrazovku) — vynutí platný e-mail, vznikne kontaktní bod.
4. E-mail **nekončí číslem, ale výzvou k hovoru** (přesné číslo až po konzultaci).
5. Lead se uloží do **vlastní DB** + rozešle do nakonfigurovaných konektorů + **okamžitá SMS makléři** → volá co nejdřív.

**Klíčový princip:** rychlost reakce je úzké hrdlo. E-mail odchází „do pár minut", makléř je notifikován SMS okamžitě, lead se nesmí nikdy ztratit.

---

## 2. Architektura

```
JEDEN projekt — Next.js, nasazený na Vercelu, vlastní doména
│
├─ Landing page (frontend)
│     dedikovaná stránka · formulář · prvky důvěry · GDPR souhlas
│
└─ Backend (API route ve stejném projektu)
      POST /api/lead  ← formulář
        1. validace
        2. ulož lead → VLASTNÍ DB (Supabase)   ← zdroj pravdy, NEJDŘÍV
        3. zavolej Cemap (konektor) → min–max rozpětí
        4. logika šířky rozpětí
        5. rozešli do konektorů (dle config):
              • Ecomail   → e-mail s odhadem + zařazení do segmentu
              • Tabidoo   → zápis leadu (volitelný konektor)
              • Sheets/Excel → řádek do tabulky (volitelný konektor)
              • SMS       → alert makléři "volej hned"
        6. error kdekoli → SMS makléři "zkontroluj lead ručně"
```

### Tech stack (rozhodnuto)
| Vrstva | Volba | Proč |
|---|---|---|
| Framework | **Next.js** | Landing page + API endpoint v jednom projektu |
| Hosting | **Vercel** | Free tier pro tento objem, snadné nasazení, vlastní doména |
| **Databáze (zdroj pravdy)** | **Supabase (Postgres)** | Vlastní úložiště leadů, free tier, připraveno na multi-tenant |
| Oceňování | **Cemap API** | Konektor — vrací cenové rozpětí (viz §7, bloker) |
| Nurture engine | **Ecomail** | Triggered e-mail + drip kampaně |
| Konektory (volitelné) | **Tabidoo, Google Sheets/Excel, další CRM** | Kam lead navíc poteče — per makléř |
| SMS alert | **GoSMS / SMSbrána** | Levné CZ API, jen alert makléři |

---

## 3. Rozdělení rolí (co kde bydlí) — FINÁLNÍ MODEL

| Vrstva | Role |
|---|---|
| **Vlastní DB (Supabase)** | **Zdroj pravdy.** Každý lead se uloží sem jako první — nikdy se neztratí. |
| **Konektory** (Tabidoo · Sheets/Excel · CRM) | **Výstupy** — kam lead navíc poteče. Volitelné, konfigurovatelné per makléř. |
| **Ecomail** | **Motor e-mailů a nurtureu** — rozesílá odhad i drip sekvence. |
| **Cemap** | **Konektor na ocenění** — vlastní API klíč per makléř. |
| **SMS (GoSMS/SMSbrána)** | Alert makléři při novém leadu. |

> Excel/Google Sheets je **konektor, ne hlavní úložiště.** Jako jediný store se pro pronájem nehodí (souběh, GDPR oddělení, růst, spolehlivost). Z DB jde navíc export do Excelu/CSV kdykoli jedním kliknutím.

---

## 4. Vrstva konektorů (klíč k pozdějšímu pronájmu)

Integrace NEJSOU natvrdo v kódu. Každá (Cemap, Ecomail, Tabidoo, Sheets, SMS) je **adaptér za společným rozhraním**, řízený **konfigurací**:

```
config (zatím 1 = majitel; v budoucnu 1 záznam per makléř):
  cemap:   { apiKey, endpoint }
  email:   { provider: "ecomail", apiKey, listId, segmenty }
  crm:     { provider: "tabidoo", token, tableId }   // nebo "sheets", "none", ...
  sms:     { provider: "gosms", apiKey, cislo_maklere }
  branding:{ mesto, jmeno, foto, domena }
```

Přidat dalšího makléře = nový config + (případně) nový adaptér. **Appku není třeba přepisovat.**

---

## 5. Datový tok backendu (POST /api/lead)

Pořadí je záměrné — **lead se uloží do vlastní DB jako první**:

```
1. Validace vstupu (povinná pole, platný e-mail, GDPR=true)
2. Zápis leadu do Supabase → status "nový"   ← zdroj pravdy
3. Cemap (konektor) → min, max
      └─ chyba? → lead zůstává v DB, SMS makléři "zkontroluj ručně",
                  klientovi fallback e-mail "odhad připravujeme"
4. Výpočet šířky rozpětí (viz §6) → text do e-mailu
5. Rozeslání do konektorů (dle config):
      • Ecomail → triggered e-mail s odhadem + segment dle horizontu
      • Tabidoo / Sheets → zápis (pokud nakonfigurováno)
      • SMS → alert makléři "volej hned" (jméno, telefon, typ, lokalita)
6. Update leadu v DB (cena_min, cena_max, status "odhad odeslán")
```

---

## 6. Formulář — pole

| Pole | Povinné | Pozn. |
|---|---|---|
| adresa | ✅ | |
| typ_nemovitosti | ✅ | byt / dům / pozemek |
| vymera_m2 | ✅ | |
| stav | ✅ | novostavba / po rekonstrukci / dobrý / před rekonstrukcí |
| dispozice | ⬜ | pomáhá přesnosti Cemapu |
| **horizont_prodeje** | ⬜ | hned / do roka / 1–2 roky / jen zjišťuju → první zařazení do nurture |
| email | ✅ | |
| **telefon** | ✅ | **povinný** |
| gdpr_souhlas | ✅ | checkbox u tlačítka |
| utm_source / campaign / term | auto | měření |
| stranka_url | auto | |

---

## 7. Logika šířky rozpětí

- **Úzké rozpětí** → ukázat jen **střed** nebo „přesné číslo po konzultaci".
- **Široké rozpětí** → zdůraznit, že nejistotu sníží konzultace.
- Návrh prahu: `(max-min)/((max+min)/2) < 0.05` = úzké (doladíme po reálných datech).
- **Vždy „odhad z tržních dat", NE „cena vaší nemovitosti."**

---

## 8. ⚠ Cemap API — nutno ověřit / doplnit (BLOKER č. 1)

- [ ] URL endpointu odhadu
- [ ] Autentizace (API key / Bearer / …)
- [ ] Vstupní parametry (adresa? GPS? typ? výměra? dispozice?)
- [ ] Formát výstupu (kde je `min` a `max`)
- [ ] Rate limity / cena za dotaz

> **Byznys háček pro pronájem:** Cemap je placený zdroj dat. Každý budoucí makléř bude potřebovat buď vlastní Cemap přístup, nebo mu ho přeprodáš. Proto je Cemap konektor s vlastním klíčem per makléř (§4).

---

## 9. Nurture — dlouhodobé leady (prodej za 1–2 roky)

**Motor = Ecomail.** Časování, drip, odhlášení, GDPR řeší Ecomail.

```
Lead → DB + Ecomail (segment dle "horizont_prodeje" z formuláře)
   → makléř po hovoru upraví horizont (v appce / konektoru)
   → kontakt přepadne do správného Ecomail segmentu:
        • hned / do roka → rychlý follow-up, tlak na schůzku
        • 1–2 roky      → pomalý drip (1×/měsíc hodnota), až dozraje → makléř volá
```

Horizont = **obojí**: nepovinné pole ve formuláři + úprava makléřem po hovoru.

---

## 10. SMS — jen alert makléři

- Jediné použití: **SMS makléři při novém leadu** „volej hned" (jméno, telefon, typ, lokalita).
- Žádná SMS klientovi, žádný SMS nurture.
- Poskytovatel: CZ **GoSMS** nebo **SMSbrána**.

---

## 11. Integrace — co potřebujeme

| Služba | Potřebujeme | K čemu |
|---|---|---|
| **Supabase** | projekt (free) | vlastní DB / zdroj pravdy |
| **Cemap** | API klíč + dokumentace | odhad min–max |
| **Ecomail** | API klíč + seznamy + segmenty + sekvence | e-mail + nurture |
| **Tabidoo** | API token + tabulka (volitelný konektor) | výstup leadů |
| **GoSMS/SMSbrána** | účet + API klíč + odesílatel | SMS alert |
| **Vercel** | účet (free) | hosting |
| **Doména** | subdoména (např. odhad.tvujweb.cz) | běh stránky |

DB tabulka „leads" (Supabase): vše z §6 + `cena_min`, `cena_max`, `sirka_rozpeti`, `horizont`, `status`, `datum`, `tenant_id` (zatím konstantní, připraveno na multi-tenant).

---

## 12. Spolehlivost

- **Lead se ukládá do DB jako první** → nikdy se neztratí.
- **Try/catch kolem každého konektoru** → při chybě fallback, ne pád.
- **SMS error alert makléři** při selhání.
- **Logování** každého requestu (úspěch/chyba).

---

## 13. Rentability / fáze pronájmu

**Fáze 1 (teď) — single-tenant pro majitele:**
- Vlastní DB, vrstva konektorů, config object (1 config), `tenant_id` v datech jako konstanta.
- Žádné přihlašování, fakturace ani UI na konektory.

**Fáze 2 (až bude druhý platící makléř) — multi-tenant SaaS:**
- Přihlašování + účty (makléř = tenant).
- UI, kde si makléř napojí svoje konektory (Cemap klíč, CRM, Ecomail, SMS, branding, doména).
- Fakturace / předplatné.
- Izolace dat per `tenant_id` (schéma je na to připravené už ve fázi 1).

> Tím, že DB + konektory + `tenant_id` existují od začátku, je přechod na fázi 2 **přidání nadstavby, ne přepis appky.**

---

## 14. Mimo kód — copy & marketing (paralelně)

- **Město/region** (zatím `[MĚSTO]`) — odemyká texty.
- Headline + landing page copy.
- Znění e-mailu s odhadem (výzva k hovoru na konci).
- Ecomail sekvence: rychlá (hned/do roka) + pomalá (1–2 roky).
- Google Ads (hlavní kanál) + Meta retargeting.
- Scénář prvního hovoru (odhad → schůzka).

---

## 15. Měření (KPI)
- Cena za lead · % leadů → schůzka · % schůzek → podpis

---

## 16. Pořadí implementace

1. **Skeleton** (Next.js + Vercel deploy + Supabase napojení).
2. **Landing page** — formulář, prvky důvěry, GDPR (placeholder město).
3. **API endpoint** — validace + zápis do Supabase (zdroj pravdy).
4. **Vrstva konektorů** — společné rozhraní + config.
5. **Cemap** konektor — ověřit přístup (§8), napojit, logika rozpětí.
6. **Ecomail** konektor — e-mail + segment.
7. **SMS** alert + error handling.
8. **Tabidoo / Sheets** konektor (volitelný výstup).
9. **Nurture** segmenty.
10. **End-to-end test** + napojení reklam.

---

## Mimo scope (zatím / rozhodnuto)
- Žádný Reas-style marketplace ani síť makléřů.
- Žádný vlastní oceňovací algoritmus (řeší Cemap).
- Žádný Make.com — logiku řeší vlastní backend.
- Žádné SMS klientovi / SMS nurture — SMS jen alert makléři.
- Excel/Sheets NENÍ hlavní úložiště — jen volitelný konektor.
- Multi-tenant nadstavba (přihlašování, fakturace, UI konektorů) až ve fázi 2.
