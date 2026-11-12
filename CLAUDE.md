# Projekt rodokmenu

Tohle je projekt rodokmenu vedený skillem **rodokmen-plus**. Data jsou v databázi (Postgres) za API aplikace – čti
a zapisuj je jen přes `python3 -I tools/rdb.py …` (nápověda `-h`), nikdy ručně v souborech. Na začátku každé konverzace:
1. Načti skill `rodokmen-plus` (pokud ještě není načtený).
2. Zjisti stav a co je rozpracované (`<koren>` = id osoby, od které se strom počítá, viz `rdb.py osoba hledej <jméno>`):
   ```
   python3 -I tools/rdb.py ja
   python3 -I tools/rdb.py rod seznam --pro <koren>
   python3 -I tools/rdb.py ukol seznam
   python3 -I tools/rdb.py denik posledni 10
   python3 -I tools/rdb.py voditko seznam --otevrena
   ```
   Když je databáze prázdná, začni podle skillu: zeptej se na uživatele, rodiče a prarodiče, zapiš je jako osoby
   a vodítka od rodiny a teprve pak jdi do matrik.
3. Pokračuj tam, kde se skončilo. Komunikuj česky, stručně a srozumitelně pro člověka bez zkušeností s genealogií a programováním.
4. Co by šlo ve skillu zlepšit (chyby nástrojů, nové archivy, co chybí v API, nápady), zapisuj do `poznamky_pro_skill.md` – viz skill, sekce „Poznámky pro správce skillu“.

## Pravidla projektu (navíc ke skillu)
- (sem si dopište vlastní pravidla, např. co nesmí na web)

## Data a API
- Databáze: lokálně Postgres v Dockeru (`docker-compose.yml`), v produkci např. Neon; API běží v aplikaci (lokálně
  http://localhost:3000, v produkci Vercel).
- Přístup: `.env` v kořeni (není v gitu, vzor `.env.example`): `RODOKMEN_API_URL`, `RODOKMEN_API_TOKEN`
  (lokálně i `DATABASE_URL`). Ověření: `python3 -I tools/rdb.py ja`.
- Cesty API: `aplikace/src/server/api.ts`, tvar vstupů: `aplikace/src/server/vstupy.ts`, popis modelu:
  `.claude/skills/rodokmen-plus/reference/data.md`.
- Nástroje: `tools/rdb.py` (CLI), `tools/rdb_klient.py` (knihovna pro skripty), ostatní v `tools/` volají API samy.
  `tools/archiv/` = starý souborový formát, jen pro jednorázový import starých dat.

## Aplikace (Next.js, `aplikace/`)
- Jednou: `cd aplikace && npm install`; databáze `npm run db:up` (Docker, idempotentní), schéma `npm run db:migrate`.
- Náhled: `cd aplikace && npm run dev` → http://localhost:3000. Aplikace čte DB přímo – po změně dat nic neexportuješ.
- Token pro AI / skripty: `cd aplikace && npm run token -- <nazev> agent` (ukáže se jen jednou) → `.env`.
  Účet správce webu: `npm run admin -- <id žijící osoby>`.
- Testy: `npm test`, typy `npm run typecheck`. `npm run db:reset` maže lokální data (jen pro vývoj, nikdy proti produkci).
- Skilly jsou v repu v `.claude/skills/`.
