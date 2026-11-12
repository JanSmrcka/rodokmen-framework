# Rodokmen s AI – framework

Hotová kostra pro vlastní rodokmen z českých matrik a pro historii domů, kde většinu hledání a čtení dělá
[Claude Code](https://claude.com/claude-code) a vy jen schvalujete a doplňujete, co víte z rodiny.
Repo je **prázdné**: neobsahuje žádná osobní data ani klíče. Stáhnete si ho, spustíte a začnete svou rodinou.

Vychází z projektu [rodokmen-plus](https://github.com/zbysekvoda/rodokmen-plus) (Zbyšek Voda), který rozšiřuje
o aplikaci s databází a API.

Obsahuje:
- **Skilly pro Claude Code** (`.claude/skills/`). Návod, jak hledat v matrikách a archivech, číst kurent a latinu,
  ztotožňovat místa, zapisovat doložené údaje a psát příběhy rodu.
- **Webovou aplikaci** (`aplikace/`, Next.js + PostgreSQL). Rodinný web jen pro přihlášené: strom, osoby,
  zápisy s výřezy z matrik, mapa, domy, příběhy, rody a větve, deník bádání a vodítka od rodiny. Má i API, přes které
  zapisuje AI.
- **Nástroje** (`tools/`). Python skripty pro stahování snímků z archivních portálů, výřezy, rámečky a práci s API.
- **Lokální databázi v Dockeru** (`docker-compose.yml`) a návod na nasazení na Vercel + Neon.

---

## Obsah
1. [Jak to funguje](#jak-to-funguje)
2. [Co potřebujete](#co-potřebujete)
3. [Rychlý start (lokálně)](#rychlý-start-lokálně)
4. [První kroky s vlastní rodinou](#první-kroky-s-vlastní-rodinou)
5. [Práce s Claude Code](#práce-s-claude-code)
6. [Nasazení na internet (Vercel + Neon)](#nasazení-na-internet-vercel--neon)
7. [Účty pro rodinu](#účty-pro-rodinu)
8. [Zálohy](#zálohy)
9. [Struktura repa](#struktura-repa)
10. [Nástroje v `tools/`](#nástroje-v-tools)
11. [Datový model ve zkratce](#datový-model-ve-zkratce)
12. [Soukromí a bezpečnost](#soukromí-a-bezpečnost)
13. [Slušné chování k archivům](#slušné-chování-k-archivům)
14. [Vývoj a testy](#vývoj-a-testy)
15. [Řešení potíží](#řešení-potíží)

---

## Jak to funguje

```
 Vy + rodina ──(vodítka: „děda byl z Lhoty“)──┐
                                              ▼
 Claude Code + skilly ──► archivní portály (snímky matrik) ──► přečte zápis
        │                                                         │
        └──── python3 -I tools/rdb.py … ──► API /api/v1 ──► PostgreSQL ◄── rodinný web (Next.js)
```

- **Jediný zdroj pravdy je databáze.** Nic se neukládá ručně do souborů. AI i skripty zapisují přes API (`tools/rdb.py`).
- **Každý údaj má jistotu:** `doc` = doloženo matrikou, `prob` = pravděpodobné, `fam` = od rodiny,
  `mh` = z cizího stromu (MyHeritage apod.), `lit` = z literatury, `unk` = neznámé.
- **Ke každému zápisu patří výřez** ze snímku matriky a rámeček, kde přesně je údaj napsaný. Kdokoli si ho na webu ověří.
- **Vodítka** jsou to, co víte z rodiny (vzpomínky, zvěsti, dokumenty). AI je ověřuje v pramenech a uzavírá.
- **Deník bádání** zapisuje každé hledání, i to neúspěšné, aby se nic nehledalo dvakrát.
- **Rody a větve** se počítají automaticky: rod po meči od nejstaršího známého předka, větve podle prarodičů
  každého přihlášeného. Agent tak může pracovat po jednom rodu (`--rod`) nebo po jedné větvi (`--vetev`).

## Co potřebujete

| co | proč | instalace |
|---|---|---|
| **Node.js 22+** | webová aplikace | https://nodejs.org |
| **Docker Desktop** | lokální databáze Postgres | https://www.docker.com/products/docker-desktop |
| **Python 3.10+** | nástroje v `tools/` (jen standardní knihovna) | macOS má, jinak https://python.org |
| **ImageMagick** | skládání a výřezy snímků | macOS `brew install imagemagick`, Windows `winget install ImageMagick.ImageMagick` |
| **Claude Code** | AI, která bádá | https://claude.com/claude-code |
| Git | stažení repa | |

Na internet (volitelné): účet na [Vercelu](https://vercel.com) a [Neonu](https://neon.tech) (obojí má bezplatný tarif).

## Rychlý start (lokálně)

```bash
git clone <adresa-tohoto-repa> muj-rodokmen
cd muj-rodokmen
cp .env.example .env               # lokální nastavení (není v gitu)

cd aplikace
npm install
npm run db:up                      # Postgres v Dockeru na portu 5433 (DB rodokmen + rodokmen_test)
npm run db:migrate                 # vytvoří tabulky
npm run token -- claude agent      # API token pro AI → zkopírujte do .env jako RODOKMEN_API_TOKEN
npm run dev                        # web na http://localhost:3000
```

Ověření v druhém terminálu z kořene repa:

```bash
python3 -I tools/rdb.py ja         # vypíše token a roli → spojení s API funguje
```

### Chcete si to nejdřív jen prohlédnout?

```bash
cd aplikace
npm run db:seed                    # fiktivní ukázková rodina Novákových (jen do lokální DB)
npm run admin -- petr-novak-1980   # vypíše jméno a heslo → přihlaste se na http://localhost:3000
```

Ukázku pak smažete příkazem `npm run db:reset`. Ten DB smaže, zmigruje a ukázku nahraje znovu. Pro úplně prázdnou DB:
`npm run db:down`, `docker volume rm rodokmen_rodokmen-db`, `npm run db:up` a `npm run db:migrate`.

Port 5433 je obsazený? Nastavte `RODOKMEN_DB_PORT=5434` v prostředí a stejný port dejte do `DATABASE_URL`
a `TEST_DATABASE_URL` v `.env`.

## První kroky s vlastní rodinou

Nejjednodušší je otevřít Claude Code v kořeni repa a napsat: **„Chci začít rodokmen.“** Skill `rodokmen-plus`
se vás zeptá na vás, rodiče a prarodiče a všechno zapíše. Ručně by to vypadalo takto:

```bash
# 1) zapsat sebe (žijící osoba, údaj od rodiny)
python3 -I tools/rdb.py osoba pridej --jmeno Petr --prijmeni Novák --sex M --narozeni 1980 --jistota fam --zije ano
#    → vypíše id, např. petr-novak-1980

# 2) výchozí kořen stromu (potřebuje token s rolí admin; jednorázově)
cd aplikace && npm run token -- nastaveni admin && cd ..
RODOKMEN_API_TOKEN=<admin token> python3 -I tools/rdb.py api PUT nastaveni/vychozi_koren '{"value": "petr-novak-1980"}'

# 3) účet správce webu pro sebe
cd aplikace && npm run admin -- petr-novak-1980
```

Pak přihlášení na webu, rodiče a prarodiče (`osoba pridej`, `vztah pridej`) a to, co víte z rodiny, jako
**vodítka** (`voditko pridej`). Od toho se odrazí hledání v matrikách.

Další nastavení webu (`PUT nastaveni/<klíč>`, admin): `nazev`, `popis`, `zapati`, `kontakt` (`{"jmeno": "…", "email": "…"}`), `uvod`.

## Práce s Claude Code

Claude Code načte `CLAUDE.md` v kořeni a skilly z `.claude/skills/`. Vše je v češtině.

| skill | k čemu |
|---|---|
| `rodokmen-plus` | hlavní průvodce: matriky, archivy, domy, zápis nálezů, vodítka, deník, příběhy, web |
| `paralelni-badani` | víc pomocníků najednou („pusť pomocníky“, „velké kolo“): fronta úkolů, každý s vlastním tokenem |
| `matriky-v-prohlizeci` | portály, které jdou jen v prohlížeči (CAPTCHA, MZA Acta Publica, FamilySearch), přes Claude in Chrome |
| `ztotozneni-mist` | nečitelné, německé nebo stejnojmenné obce a varianty příjmení |

Typické věty: „pokračuj v rodokmenu“, „najdi křest dědy Josefa“, „projdi otevřená vodítka rodu Novákových“,
„kdo bydlel v čp. 12 v Lhotě“, „napiš příběh rodu“, „jak je Anna příbuzná s Petrem“.

Na začátku každé konverzace si Claude zjistí stav:

```bash
python3 -I tools/rdb.py rod seznam --pro <koren>          # moje rody s počty otevřených vodítek a úkolů
python3 -I tools/rdb.py voditko seznam --otevrena          # vodítka seskupená po rodech
python3 -I tools/rdb.py ukol seznam --rod <slug>           # úkoly jednoho rodu
python3 -I tools/rdb.py denik posledni 20 --vetev <koren>  # deník po větvích prarodičů
```

`.claude/settings.json` zapíná hook `tools/hlidac.py`. Ten pouští síťový přístup k archivům jen přes
`tools/slusne.py` se společným limitem rychlosti, aby AI archivy nezahltila.

Do `CLAUDE.md` si dopište vlastní pravidla projektu, třeba co nesmí na web.

## Nasazení na internet (Vercel + Neon)

1. **Repo na GitHub.** Nahrajte si repo do vlastního (klidně soukromého) GitHub repozitáře.
2. **Neon.** Založte projekt (region např. Frankfurt) a zkopírujte *pooled* connection string
   (`postgres://…-pooler…/neondb?sslmode=require`).
3. **Vercel.** Zvolte *Add New → Project* a importujte repo:
   - **Root Directory** = `aplikace`,
   - Environment Variable `DATABASE_URL` = connection string z Neonu (Production),
   - build se nastaví sám z `aplikace/vercel.json`: `npm run vercel-build` spustí migrace a pak `next build`.
4. **První správce a token** (lokálně, proti produkční DB):
   ```bash
   cd aplikace
   DATABASE_URL='<neon url>' npm run token -- claude agent     # → RODOKMEN_API_TOKEN do .env
   ```
   V `.env` nastavte `RODOKMEN_API_URL=https://<projekt>.vercel.app`. Zapište sebe (`rdb.py osoba pridej …`)
   a pak `DATABASE_URL='<neon url>' npm run admin -- <vaše id>`.
5. **Další nasazení.** Podle nastavení Vercelu proběhnou po pushi, nebo ručně `cd aplikace && npx vercel --prod`.
   Migrace DB proběhnou při buildu.

Máte už data lokálně? `pg_dump` lokální DB a obnova do Neonu, nebo nasadit hned na začátku a bádat rovnou proti produkci.
Opačný směr (produkce → lokál pro vývoj): `PROD_DATABASE_URL` v `.env` a `npm run db:z-produkce`.

Limity: výřez max 4 MB (Vercel bere tělo požadavku do 4,5 MB; `tools/vyrez.py` dělá max 1800 px).

## Účty pro rodinu

- Web je celý jen pro přihlášené (`/prihlaseni`). Vyhledávače ho neindexují (`noindex`, `robots.txt`).
- Správce v `/admin` vybere žijící osoby a dá „Vytvořit přístupy a karty“. Vzniknou **dárkové karty s QR kódem**
  ke kartě k tisku. Hesla se ukážou jen jednou. Ztracené heslo: „nové heslo + karta“.
- Každý přihlášený vidí strom, příbuzenství („prababička“, „švagr“), rody a větve **od sebe**.
- Role:
  - `admin`: všechno;
  - `agent`: jen API token, čte a zapisuje, nemaže;
  - `member`: čte a posílá vodítka (u žijících vidí jen jméno a rok narození).

## Zálohy

```bash
cd aplikace
npm run db:zaloha                          # lokální DB → ../zalohy/ (pg_dump přes Docker)
npm run db:zaloha -- "$PROD_DATABASE_URL"  # produkce
```

Neon má navíc obnovu k libovolnému času za posledních pár dní. `zalohy/` je v `.gitignore`.

## Struktura repa

```
.
├── README.md                  tento návod
├── CLAUDE.md                  instrukce pro Claude Code (dopište vlastní pravidla)
├── poznamky_pro_skill.md      sem AI zapisuje nápady na zlepšení skillu
├── docker-compose.yml         lokální Postgres
├── .env.example               vzor nastavení → zkopírujte do .env
├── .claude/
│   ├── settings.json          hook hlidac.py (slušný přístup k archivům)
│   ├── launch.json            spuštění aplikace z Claude Code
│   └── skills/                rodokmen-plus, paralelni-badani, matriky-v-prohlizeci, ztotozneni-mist
├── aplikace/                  Next.js web + API (vlastní README)
│   ├── src/db/schema.ts       tabulky (Drizzle)
│   ├── src/server/            doménová vrstva a API (api.ts, vstupy.ts, graf.ts, rody.ts, …)
│   ├── src/app/               stránky webu
│   ├── drizzle/               SQL migrace
│   ├── scripts/               migrate, seed, token, admin, zaloha, import
│   └── tests/                 vitest (potřebují běžící DB)
└── tools/                     Python nástroje (CLI rdb.py a portály archivů)
```

Podrobnosti o aplikaci: [`aplikace/README.md`](aplikace/README.md). Datový model pro AI:
[`.claude/skills/rodokmen-plus/reference/data.md`](.claude/skills/rodokmen-plus/reference/data.md).

## Nástroje v `tools/`

Spouštějte z kořene repa přes `python3 -I tools/<nástroj> -h`.

**Data (API)**

| nástroj | co dělá |
|---|---|
| `rdb.py` | hlavní CLI: osoby, vztahy, události, zápisy, svazky, místa, domy, vodítka, deník, úkoly, rody, příběhy, kontrola |
| `rdb_klient.py` | knihovna pro vlastní skripty (jen standardní knihovna) |
| `vyrez.py`, `ramecek.py` | výřez zápisu ze snímku a rámeček, kde je údaj napsaný; nahraje přes API |
| `vylepsi_snimek.py` | varianty špatně čitelného snímku vedle sebe (kontrast, ostření) |
| `mista.py`, `mista_domy.py`, `domy_rodiny.py` | místa a domy pro mapu |
| `fan_chart.py`, `napady.py`, `rdb_strom.py` | vějíř předků (SVG), náměty na zajímavosti |
| `ged_import.py`, `ftb_export.py` | import stromu z GEDCOM (MyHeritage, Geni, FamilySearch) a ze zálohy Family Tree Builderu – jen jako vodítka |
| `test_rdb.py` | smoke test CLI proti běžícímu API s ukázkovými daty |

**Archivy a portály**

| nástroj | portál |
|---|---|
| `trebon.py` | SOA Třeboň (digi.ceskearchivy.cz) |
| `portafontium.py` | SOA Plzeň (Porta fontium) |
| `ebadatelna.py` | SOA Praha (eBadatelna) |
| `aron_search.py`, `aron_img.py` | SOA Zámrsk (ARON) |
| `mza.py`, `scitani_mza.py` | MZA Brno (Acta Publica, sčítací operáty) |
| `soal_zoomify.py` | SOA Litoměřice, ZA Opava (Zoomify) |
| `ahmp_search.sh`, `ahmp_parse.py`, `ahmp_scan.py` | Archiv hl. m. Prahy |
| `policie_prihlasky.py` | pražské policejní přihlášky 1850–1914 |
| `matricula_dl.sh`, `matricula_batch.sh` | Matricula (snímky přes URL z prohlížeče) |
| `cuzk_archiv.py`, `ipr_praha.py` | staré mapy: stabilní katastr, indikační skici, plány Prahy |
| `kramerius.py`, `dnnt.py`, `anno.py`, `anno_snap.py` | noviny a tisky (NK ČR, ANNO) |
| `slusne.py`, `hlidac.py` | společný limit rychlosti a hook, který ho vynucuje |
| `zdravi.py` | kontrola, že nástroje ještě fungují proti živým portálům |

`tools/archiv/` slouží k jednorázovému převodu starého souborového formátu skillu do DB. Na nový projekt ho nepotřebujete.

## Datový model ve zkratce

- **osoba**: jméno, pohlaví, jistota, žije/nežije; vztahy `rodic` a `manzele`; `sameAs` pro sloučení duplicit.
- **událost**: narození, křest, sňatek, úmrtí, povolání… s osobami v rolích a citacemi.
- **svazek → zápis**: přepis originálu i češtiny, osoby v rolích (kmotr, svědek…), výřez a rámečky.
- **místo, dům**: obce s polohou, domy s čísly popisnými a obyvateli v čase.
- **vodítko**: údaj od rodiny nebo zvěst. Stavy: nezpracované, ověřuje se, potvrzené, vyvrácené, nelze ověřit, rozdělené. Patří k osobám,
  rody se z nich dopočítají.
- **deník a úkol**: co se hledalo a s jakým výsledkem; fronta práce, i pro víc agentů najednou.
- **rod**: dopočítá se po meči. Ručně se dá jen pojmenovat nebo popsat (`rdb.py rod pridej`).
- **audit**: každá změna se zapisuje do `change_log`.

Celý popis je v `.claude/skills/rodokmen-plus/reference/data.md` a cesty API v `aplikace/src/server/api.ts`
(`GET /api/v1` s admin tokenem vypíše přehled).

## Soukromí a bezpečnost

- **V repu nejsou žádná data ani klíče.** `.env`, `data/`, `zdroje/`, `vyrezy/`, `dokumenty/`, `zalohy/` a `pracovni/` jsou
  v `.gitignore`. Rodinná data žijí jen v DB.
- Tokeny a hesla se ukážou jen jednou a v DB jsou jen jako hash. Token kdykoli zneplatníte novým se stejným názvem.
- U žijících osob vidí členové jen jméno a rok narození. Celé údaje vidí jen admin.
- Skill má pravidla, co nedávat na web (`reference/soukromi.md`). Vlastní výjimky si napište do `CLAUDE.md`.
- `poznamky_pro_skill.md` je jen na technické věci, žádné údaje o rodině.

## Slušné chování k archivům

- Stahujte jen to, co potřebujete číst. Nástroje mají společný limit rychlosti (`slusne.py`) a hook ho vynucuje.
- **Nescrapujte placené služby** (MyHeritage, Ancestry, Geni…). Hromadné stahování vede k zablokování účtu.
  Místo toho si stáhněte vlastní GEDCOM export a použijte `tools/ged_import.py`. Údaje z cizích stromů jsou jen vodítka
  (`mh`) a ověřují se v matrikách.
- Portály s CAPTCHA a přihlášením se čtou v prohlížeči (skill `matriky-v-prohlizeci`). Ochrana se neobchází.

## Vývoj a testy

```bash
cd aplikace
npm test             # vitest; potřebuje běžící DB (npm run db:up), testovací DB rodokmen_test se pokaždé vytvoří znovu
npm run typecheck
npm run lint
npm run db:generate  # po změně src/db/schema.ts vytvoří migraci v drizzle/
npm run db:studio    # prohlížeč tabulek
python3 -I ../tools/test_rdb.py   # smoke test CLI (běžící `npm run dev` + db:seed)
```

## Řešení potíží

| problém | řešení |
|---|---|
| `rdb.py ja` hlásí chybu spojení | běží `npm run dev`? sedí `RODOKMEN_API_URL` a `RODOKMEN_API_TOKEN` v `.env`? |
| `npm run db:up` selže | běží Docker Desktop? není port 5433 obsazený (viz `RODOKMEN_DB_PORT`)? |
| `Chybí ImageMagick` | nainstalujte ImageMagick a restartujte terminál a Claude Code |
| 401 / 403 z API | token neplatí nebo nemá roli (nastavení webu chce `admin`) |
| portál vrací 403 / CAPTCHA | použijte skill `matriky-v-prohlizeci` |
| výřez se nenahraje (413) | obrázek nad 4 MB, zmenšete (`vyrez.py` to dělá sám) |

---

Skill `rodokmen-plus` vychází z projektu [rodokmen-plus](https://github.com/zbysekvoda/rodokmen-plus).
Nápady a chyby skillu posílejte tam jako issue.

Licence: MIT, viz [LICENSE](LICENSE).
