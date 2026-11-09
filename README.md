# Rezervační aplikace

Webová aplikace pro rezervace schůzek s podporou více poskytovatelů, automatickými potvrzovacími emaily (Resend), SMS (GoSMS) a připomínkami 24 hodin před schůzkou.

## Tech stack

- **Next.js 14** (App Router, TypeScript)
- **Prisma + SQLite** (lokálně) → Postgres v produkci
- **NextAuth** pro přihlášení admin uživatelů
- **Tailwind CSS** pro styling
- **Resend** pro emaily
- **GoSMS** pro SMS

## Rychlý start

### 1. Instalace závislostí

```bash
npm install
```

### 2. Konfigurace prostředí

Zkopírujte `.env.example` na `.env` a vyplňte hodnoty:

```bash
cp .env.example .env
```

Minimum pro lokální spuštění:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="cokoliv-dlouhe-a-nahodne"
```

Pro generování bezpečného `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

### 3. Databáze + testovací data

```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

Seed vytvoří:
- 3 admin uživatele (heslo `heslo123`):
  - `admin@salonkrasy.cz` — vidí všechny rezervace
  - `anna@salonkrasy.cz` — vidí jen své
  - `petr@salonkrasy.cz` — vidí jen své
- 2 poskytovatele (Anna, Petr) s pracovní dobou Po–Pá 9:00–17:00
- 3 služby: Dámský střih, Barvení vlasů, Pánský střih

### 4. Spuštění

```bash
npm run dev
```

Otevřete:
- **Klientská část:** http://localhost:3000
- **Admin:** http://localhost:3000/admin

## Notifikace

Aplikace **funguje i bez** nakonfigurovaných notifikací — pokud nejsou klíče vyplněné, jen se vypíše varování do konzole a rezervace proběhne normálně.

### Resend (email)

1. Zaregistrujte se na [resend.com](https://resend.com) (100 emailů/den zdarma).
2. Vytvořte API klíč a verifikujte doménu.
3. Doplňte do `.env`:
   ```env
   RESEND_API_KEY="re_xxxxx"
   EMAIL_FROM="Salon Krásy <noreply@vasedomena.cz>"
   ```

### GoSMS

1. Zaregistrujte se na [gosms.cz](https://gosms.cz).
2. V administraci si vygenerujte **OAuth2 klienta** (Client ID + Secret) a najděte **ID kanálu** (channel).
3. Doplňte do `.env`:
   ```env
   GOSMS_CLIENT_ID="..."
   GOSMS_CLIENT_SECRET="..."
   GOSMS_CHANNEL_ID="..."
   GOSMS_SENDER="SalonKrasy"   # volitelný (jen schválené senderID)
   ```

## Připomínky před schůzkou

Aplikace pošle email + SMS připomínku všem klientům, jejichž rezervace začíná za 22–26 hodin (a kteří připomínku ještě nedostali). Spouští se buď:

### Vercel Cron (doporučeno při nasazení na Vercel)

`vercel.json` už obsahuje konfiguraci — Vercel automaticky volá endpoint každou hodinu:

```json
{
  "crons": [{ "path": "/api/cron/reminders", "schedule": "0 * * * *" }]
}
```

Endpoint vyžaduje `Authorization: Bearer <CRON_SECRET>`. Vercel cron tento header posílá automaticky, pokud máte v Project Settings → Environment Variables nastavený `CRON_SECRET`.

### Lokálně / na vlastním serveru

```bash
npm run reminders
```

Přidejte do crontabu, např. každou hodinu:

```cron
0 * * * * cd /cesta/k/app && npm run reminders >> /var/log/rezervace-reminders.log 2>&1
```

## Nasazení na Vercel

1. Pushněte repozitář na GitHub.
2. V [vercel.com](https://vercel.com) → **New Project** → Import.
3. Místo SQLite použijte **Postgres** (Vercel Postgres, Neon, Supabase apod.):
   - V `prisma/schema.prisma` změňte `provider = "postgresql"`.
   - `DATABASE_URL` nastavte v Project Settings → Environment Variables.
4. Doplňte ostatní env proměnné (NEXTAUTH_SECRET, RESEND_API_KEY, GOSMS_*, CRON_SECRET).
5. Po prvním deploymentu spusťte migrace:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```

## Struktura projektu

```
prisma/
  schema.prisma        # Datový model
  seed.ts              # Testovací data
scripts/
  send-reminders.ts    # Skript pro lokální cron
src/
  app/
    page.tsx           # Úvodní stránka (seznam služeb)
    rezervace/         # Veřejný booking flow
    admin/             # Admin panel (login + rezervace)
    api/
      availability/    # GET sloty
      bookings/        # POST nová rezervace, POST /{id}/cancel
      cron/reminders/  # GET připomínky (volá ho cron)
      auth/            # NextAuth endpoints
  lib/
    db.ts              # Prisma klient (singleton)
    auth.ts            # NextAuth konfigurace
    slots.ts           # Generování volných slotů
    email.ts           # Resend integrace
    sms.ts             # GoSMS integrace
```

## Co lze přidat (další iterace)

- UI pro editaci služeb a pracovní doby (zatím přes Prisma Studio)
- Vytváření rezervací z admin panelu
- Změna termínu klientem přes odkaz v emailu
- iCal / Google Calendar synchronizace
- Více lokalit/poboček
- Online platby (Stripe / GoPay)
- Vlastní vzhled emailových šablon

## Licence

Volné použití pro vaše projekty.

## Integrace s Tabidoo

Rezervace „zvenku" (Tabidoo → Make → tato aplikace). Rezervace založená přes integraci se chová stejně jako ta, kterou si klient udělá sám na veřejné stránce:
- dostane stejný potvrzovací e-mail s odkazem „Přeplánovat nebo zrušit",
- navazující e-maily/SMS chodí podle notifikačních pravidel pro daný druh (konzultace / nemovitost),
- historie se zapisuje do NotificationLog,
- rezervace je vidět v dashboardu.

Rozdíly oproti veřejné rezervaci: **nevytváří se Google událost** (zakládá ji Make), **neposílá se e-mail vlastníkovi**, termín se nekontroluje proti slotům.

**Zabezpečení:** každý požadavek musí mít hlavičku `x-integration-secret: <INTEGRATION_SECRET>`, jinak vrátí `401`. Proměnná `INTEGRATION_SECRET` (aspoň 16 znaků, náhodná) se nastavuje jen ve Vercelu, do repozitáře nepatří. Bez ní je integrace vypnutá. Volitelně `INTEGRATION_TENANT_SLUG`; když v systému je jen jeden účet, není potřeba.

### `POST /api/integrations/booking`
```json
{
  "externalRef": "ID aktivity v Tabidoo",
  "kind": "consultation",              // nebo "property"
  "listingSlug": "konzultacezach",     // volitelné; jinak první aktivní položka daného druhu
  "startsAt": "2026-11-20T10:00:00+01:00",
  "endsAt": "2026-11-20T10:30:00+01:00",   // volitelné; jinak startsAt + délka položky
  "client": { "name": "Jan Novák", "email": "jan@example.cz", "phone": "+420…" },  // phone volitelný
  "note": "…", "location": "Kancelář Přerov",   // volitelné
  "sendConfirmation": true             // výchozí true
}
```
Odpověď `200`: `{ bookingId, manageUrl, dashboardUrl, emailSent, alreadyExisted }`.
Volání je **idempotentní podle `externalRef`**: když rezervace s tímto externalRef už existuje, nic se nezakládá ani neposílá a vrátí se existující rezervace s `alreadyExisted: true`. Termín v minulosti vrátí `400`.

### `POST /api/integrations/booking/{externalRef}/move`
Body `{ "startsAt": "…", "endsAt": "…" }`, `endsAt` je volitelné. Stejný přesun a e-mail klientovi jako přesun z dashboardu. Neexistující externalRef vrátí `404`, zrušená rezervace `409`.

### `POST /api/integrations/booking/{externalRef}/cancel`
Body `{ "reason": "…" }`, `reason` je volitelné a zapíše se do historie. Stejné zrušení a e-mail klientovi jako zrušení z dashboardu. Opakované volání vrátí `alreadyCancelled: true` a nic znovu neposílá. Neexistující externalRef vrátí `404`.

**Formulář místo JSONu (pro Make):** všechny tři endpointy přijímají i `application/x-www-form-urlencoded` s plochými poli (`clientName`, `clientEmail`, `clientPhone` místo objektu `client`). Prázdná pole se ignorují, takže se v Make nemusí řešit escapování JSONu. Přesun na stejný termín nic nemění ani neposílá (`unchanged: true`), proto ho Make může volat při každé úpravě aktivity.

**Napojení v Make:** scénáře „Tabidoo | Aktivity → Kalendář (create/edit/delete)“ mají samostatnou větev „Rezervace (Konzultace)“. Ta se spustí jen u aktivit kategorie **Konzultace** s vyplněným kontaktem (pole Subjekty a jeho e-mail `email_1`).
