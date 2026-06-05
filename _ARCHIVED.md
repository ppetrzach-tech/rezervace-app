# ⚠️ POZOR — tohle je ŽIVÁ aplikace, NEMAZAT

Tento adresář obsahuje **`rezervace-app`** — Next.js rezervační systém na prohlídky
nemovitostí (Calendly styl). Je **nasazený na Vercelu + Neon Postgres** a aktivní.

## Petr má DVĚ samostatné aplikace:

| Aplikace | Tento adresář? | Stack | Účel | Hosting |
|---|---|---|---|---|
| **rezervace-app** | ✅ ANO (tady) | Next.js + Prisma + Neon | Veřejné objednávání prohlídek pro zájemce | Vercel + Neon |
| **proverenynajemnik-crm** | ❌ jinde | Vite + React + Supabase | Interní CRM: nájemníci, smlouvy, platby, screening | Vercel + Supabase |

CRM najdeš v: `~/Desktop/proverenynajemnik-crm/` (viz tamní `HANDOFF.md`)

## Obě aplikace běží vedle sebe — žádnou nemazat.

Dříve byl v tomto souboru text, že je projekt archivovaný. **To už neplatí** —
2026-06-04 Petr potvrdil, že chce obě aplikace provozovat současně.

Poznámka: aktuální session běží ve worktree `.claude/worktrees/musing-franklin-fb8bf6`.
