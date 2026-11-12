# Rodinný web – aplikace, nastavení, zveřejnění

Web je Next.js aplikace `aplikace/`, která čte data **přímo z databáze** (Postgres; lokálně Docker, v produkci Neon
na Vercelu). Žádný export dat už není – co zapíšeš přes `rdb.py`, je na webu hned. Starý Astro web `web/` je zastaralý.
Stránky: úvod (lákadlo, statistiky, zajímavosti, mapa, rody, vějíř), příběh, zajímavosti, rody, stránka rodu,
mapa, vějíř, seznam předků, zápisy (s výřezem, rámečkem, přepisem a překladem), stránka osoby, rodiny, výzkumný deník,
hledání; přihlášení členové rodiny mohou posílat vodítka (údaje od rodiny).

## Příkazy (ve složce `aplikace/`)
| příkaz | co dělá |
|---|---|
| `npm install` | jednou na začátku |
| `npm run db:up` | spustí lokální databázi (Docker; opakovat nevadí) |
| `npm run dev` | náhled na http://localhost:3000 |
| `npm run db:seed` | fiktivní ukázková rodina do prázdné lokální DB (vyzkoušení, vývoj; nikdy proti produkci) |
| `npm run token -- <nazev> agent` | API token pro AI / skripty (ulož do `.env` jako `RODOKMEN_API_TOKEN`) |
| `npm run admin -- <id osoby>` | první správce webu (žijící osoba ve stromu) – vypíše jméno a heslo |
| `npm test` | testy aplikace |

Přístup nástrojů: `.env` v kořeni (`RODOKMEN_API_URL`, `RODOKMEN_API_TOKEN`, vzor `.env.example`).
Náhled spouštěj na pozadí a uživateli pošli odkaz. Vzhled si ověř sám (snímek obrazovky přes prohlížeč, je-li k dispozici).

## Nastavení webu
Nastavení je v DB: `python3 -I tools/rdb.py api GET nastaveni`. Měnit ho smí jen admin token:
`python3 -I tools/rdb.py api PUT nastaveni/<klic> '{"value": …}'` (např. `nazev`, `kontakt`, `vychozi_koren` = id výchozí osoby).
- Název nastav hned, jak znáš příjmení výchozí osoby („Rodokmen Novákových“).
- `kontakt.jmeno` je ve 3. pádě („Napište Petrovi na …“) – e-mail jen se souhlasem uživatele.
- Úvodní text a příběh: příběhy přes `rdb.py pribeh uloz` (`pribehy.md`).

## Přihlášení a účty
Web je jen pro rodinu: každý člen má vlastní účet (žijící osoba ve stromu). Prvního správce založí
`npm run admin -- <id osoby>`, další účty správce v aplikaci (nebo `rdb.py api POST uzivatele '{"personIds": [...]}'` admin tokenem).
Hesla se ukážou jen jednou – předej je uživateli, neukládej je nikam do souborů.
Člen rodiny vidí žijící jen v základním rozsahu a smí jen číst a posílat vodítka; AI pracuje s tokenem role `agent`.

## Zveřejnění (Vercel + Neon)
Nasazení a nastavení databáze v produkci dělá uživatel (účet na Vercelu, proměnná `DATABASE_URL`). Po nasazení:
v `.env` přepni `RODOKMEN_API_URL` na produkční adresu a vytvoř produkční token. Ověř v anonymním okně, že web
bez přihlášení nic neukáže.

## Vějíř jako plakát
`python3 -I tools/fan_chart.py [--koren <id>]` → `pracovni/vejir/` (SVG, HTML a PNG, je-li nainstalovaný Google Chrome) k tisku.
