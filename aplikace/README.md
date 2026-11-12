# Rodinný web rodokmenu

Next.js 16 + PostgreSQL (Drizzle). Celý web je jen pro přihlášené členy rodiny. Strom, čísla předků (Kekulé), příbuzenství („prababička“, „švagr“) i mapa se počítají od osoby přihlášeného. Každý vidí celý strom, ale u žijících osob jen jméno a rok narození.

Data se čtou i zapisují jen přes **API** (`/api/v1`). Používá ho AI i skripty v `tools/` (CLI `tools/rdb.py`).

## Lokální vývoj

```bash
cp ../.env.example ../.env       # jednou; .env je v kořeni repa (čte ho i tools/rdb.py)
npm install
npm run db:up                    # Postgres v Dockeru (port 5433), databáze rodokmen + rodokmen_test
npm run db:migrate               # schéma
npm run setup -- --jmeno Petr --prijmeni Novák --pohlavi M   # prázdný rodokmen: vy jako kořen, účet správce, token pro AI
npm run db:seed                  # fiktivní ukázková rodina (jen lokálně)
npm run admin -- petr-novak-1980 # účet správce pro osobu ve stromu → vypíše jméno a heslo
npm run token -- claude agent    # API token pro AI/skripty → do .env jako RODOKMEN_API_TOKEN
npm run dev                      # http://localhost:3000
```

Další příkazy:

| příkaz | co dělá |
|---|---|
| `npm test` | testy (vitest) proti `rodokmen_test`; testovací DB se pokaždé vytvoří znovu |
| `npm run typecheck` | kontrola typů |
| `npm run setup -- …` | první spuštění prázdného rodokmenu (osoba, kořen stromu, správce, token) |
| `npm run db:generate` | po změně `src/db/schema.ts` vytvoří SQL migraci v `drizzle/` |
| `npm run db:reset` | lokální DB smazat, zmigrovat a naplnit ukázkou (jen localhost) |
| `npm run db:studio` | prohlížeč tabulek |
| `npm run db:zaloha` | `pg_dump` (přes Docker) do `../zalohy/`; jiná DB: `npm run db:zaloha -- <URL>` |

## Struktura

- `src/db/schema.ts`: tabulky a indexy.
  - Osoby: jména a vztahy rodič/manželé.
  - Události: s osobami v rolích a citacemi zdrojů.
  - Prameny: svazky a zápisy s přepisem, osobami v rolích a výřezy jako `bytea`.
  - Místa a domy.
  - Fronta vodítek: údaje od rodiny a zvěsti.
  - Deník bádání, úkoly.
  - Účty, sessions, API tokeny, audit (`change_log`).
- `src/server/`: doménová vrstva, jediné místo, které sahá do DB.
  - `api.ts`: směrovač všech cest `/api/v1/*`. `GET /api/v1` vypíše přehled (admin).
  - `vstupy.ts`: validace vstupů (zod).
  - `graf.ts`: graf osob v paměti, Kekulé, předci, kontrola.
  - `pribuznost.ts`: česká označení příbuzenství.
  - `soukromi.ts`: ořez žijících.
  - `web.ts`: data stránek pro přihlášeného, s cache podle verze dat.
  - `nalez.ts`: nález z matriky v jedné transakci.
  - `auth.ts`: hesla (scrypt), sessions, tokeny, omezení pokusů.
- `src/app/`: stránky.
  - `/prihlaseni`, `/ucet`: změna hesla, odhlášení, moje vodítka.
  - `/admin`: účty a dárkové karty s QR kódem, pro tisk.
  - `/admin/voditka`: fronta vodítek.
- `src/proxy.ts`: bez přihlášení přesměruje na `/prihlaseni`. Posílá i hlavičku `noindex`.

Role:
- `admin`: vše.
- `agent` (jen API token): čte a zapisuje data, nemaže.
- `member`: čte a u žijících vidí jen jméno a rok narození. Posílá vodítka.

## Nasazení (Vercel + Neon)

1. **Neon:** vytvořte projekt (region Frankfurt). Zkopírujte *pooled* connection string (`…-pooler…/neondb?sslmode=require`).
2. **Vercel:** Import projektu z GitHubu.
   - **Root Directory** = `aplikace`.
   - Proměnná `DATABASE_URL` = connection string z Neonu (Production; pro Preview raději Neon branch).
   - Build použije `npm run vercel-build`, tedy migrace a pak `next build`.
3. **Po prvním nasazení** (lokálně, s produkční `DATABASE_URL` v prostředí):
   ```bash
   DATABASE_URL=<neon url> npm run admin -- <vaše id osoby>    # účet správce
   DATABASE_URL=<neon url> npm run token -- claude agent       # token pro AI → RODOKMEN_API_TOKEN
   ```
   V `.env` nastavte `RODOKMEN_API_URL=https://<projekt>.vercel.app`. AI pak zapisuje rovnou do produkce.
4. **Účty pro rodinu:** `/admin` → vybrat žijící → „Vytvořit přístupy a karty“ → Tisknout.
   - Hesla se ukážou jen jednou. Ztracené heslo: „nové heslo + karta“.
5. **Záloha:** pravidelně `npm run db:zaloha -- <neon url>`. Neon má navíc vlastní obnovu k libovolnému času v posledních dnech.

## Data na produkci

Po nasazení je zdrojem pravdy produkční DB a AI i skripty zapisují jen přes API (`RODOKMEN_API_URL`).
- Kopie produkce pro lokální vývoj: `PROD_DATABASE_URL` v `.env`, pak `npm run db:z-produkce` (přepíše lokální DB).
- Záloha: `npm run db:zaloha -- "$PROD_DATABASE_URL"`.
- Starý souborový formát skillu (`data/`, `vyrezy/`, `zdroje/`) jde jednorázově naimportovat: `python3 -I ../tools/archiv/export_pro_import.py` a `npm run import`.

Limity: obrázek výřezu max 4 MB (Vercel bere tělo požadavku do 4,5 MB; `tools/vyrez.py` dělá max 1800 px).
