# Datový model a API

Data projektu jsou v databázi (Postgres) za HTTP API aplikace (`/api/v1/`). Čti a zapisuj je přes
`python3 -I tools/rdb.py …` (z kořene projektu); co `rdb.py` neumí, zavolej obecně `rdb.py api <METODA> <cesta> [json]`.
Zdroj pravdy: cesty `aplikace/src/server/api.ts`, vstupy (pole, povinnost, výchozí hodnoty) `aplikace/src/server/vstupy.ts`,
tabulky `aplikace/src/db/schema.ts`. Názvy polí jsou camelCase (`personId`, `dateText`, `recordKey`).

**Přístup:** `.env` v kořeni (`RODOKMEN_API_URL`, `RODOKMEN_API_TOKEN`); hlavička `Authorization: Bearer <token>`.
Role tokenu: `agent` (AI, skripty – čte i zapisuje), `admin` (navíc mazání, nastavení, účty). Člen rodiny přihlášený
na webu jen čte (žijící ořezané) a posílá vodítka. **Chyba** = JSON `{"chyba": "…", "detail": …}` se statusem 4xx/5xx;
`rdb.py` ji vypíše česky a skončí s kódem 1. Každá změna se zapisuje do auditu (kdo, kdy, co předtím).

**Pravidla zápisu:** jeden nález = jedna transakce (`rdb.py nalez`), žádné ruční úpravy souborů, nic bez zdroje
(citace), jistota u každého údaje. Testovací data nikdy do produkčního API.

## Kekulého čísla (počítají se, neukládají)
| číslo | kdo |
|---|---|
| 1 | výchozí osoba (kořen) |
| 2, 3 | otec, matka |
| 4–7 | prarodiče (4, 5 otcovi rodiče; 6, 7 matčini) |
| 8–15 | pradědečci a prababičky = až **8 rodů** (viz Rody níže) |
| 16–31, 32–63 … | každá další generace dvojnásobek |

Otec předka k je 2k, matka 2k+1, dítě k // 2; muži mají sudá čísla. `rdb.py kekule [kořen]`, `rdb.py predci <id>`,
`rdb.py pribuznost <od> <k>` („prapraděd“, „bratranec z 2. kolena“, „švagr“, „nevlastní strýc“ = jen jeden společný
předek). Při dvojím příbuzenství vypíše všechny cesty (API pole `cesty`). Výchozí kořen = nastavení `vychozi_koren`.

## Osoba (`POST /osoby`, `PATCH /osoby/<id>`, `GET /osoby/<id>`)
| pole | význam |
|---|---|
| `id` | slug `jmeno-prijmeni-rok` (bez diakritiky, rok narození; kolize `-2`); bez něj ho vytvoří API. **Nikdy se nemění.** |
| `sex` | `M` / `F` (povinně; `U` jen u zástupné osoby) |
| `given`, `surname` | hlavní (rodné) jméno; ženy rodným příjmením |
| `certainty` | jistota osoby (viz níže) |
| `yearsText` | roky pro přehledy: `"* 1895"`, `"1890–1944"`, `"asi 1720–1785"`, `"1680 – před 1740"`, `"† 1940"`, nic → prázdné |
| `living` | `true`/`false`/`null` (null = automaticky: bez úmrtí a narozen před < 110 lety = žijící) |
| `note`, `notePrivate` | poznámka (proč nejistota, rozpor, odkud údaj); neveřejná poznámka jen pro správce |
| `sameAsId` | tatáž osoba jako jiný záznam (duplicitní výskyt; dřív `tataz`/`SAME`) |
| `placeholder` | zástupná osoba („otec neuveden“) |
| `names`, `events`, `sources` | při založení: další jména, události osoby (s `role`), zdroje k osobě jako celku |

Detail osoby (`rdb.py osoba ukaz`) vrací i jména, události s osobami a citacemi, vztahy, bydliště, zápisy (s rolí),
boční poznámky a příbuznost k přihlášenému.

**Jména** (`rdb.py osoba jmeno <id> --jmeno … --prijmeni … --druh …`): `kind` = `rodne` (hlavní), `po_snatku`,
`varianta`, `v_zapisu` (tvar ze zápisu, např. „Nowakin“); každé s jistotou. Hledání (`osoba hledej`) jde přes všechna
jména bez diakritiky.

## Vztahy (`POST /vztahy`)
Jen dva typy: `rodic` (`aId` = rodič, `bId` = dítě; zvlášť otec a matka) a `manzele` (`aId`, `bId`). Pole `certainty`,
`note`, `sources`; u manželů i konec svazku `endReason` (`rozvod` | `rozluka` | `umrti` | `jine`) a `endText` („1935“) –
`rdb.py vztah uprav <id> --konec rozvod --konec-kdy 1935`. Obě osoby musí existovat (nejdřív osoba, pak vztah).
V nálezu (`POST nalez`) se už zapsaný vztah nezakládá znovu, jen dostane citaci zápisu (`existingRelations`). Nejvýš jeden otec a jedna matka – alternativy
jako hypotéza. Sourozenci = společní rodiče; chybějící rodiče založ (`unk`, případně zástupná osoba).
**Kmotr, svědek, porodní bába, farář nejsou vztahy** – jsou to osoby v rolích zápisu (níže).

## Události (`POST /udalosti`, `PATCH /udalosti/<id>`)
| pole | význam |
|---|---|
| `type` | `narozeni`, `krest`, `snatek`, `umrti`, `pohreb`, `povolani`, `sluzba`, `jine` |
| `dateText` | datum česky: „14. 2. 1890“, „3/1867“, „1797“, „asi 1720“, „před 1740“, „po 1800“, „1720–1785“ – API z něj odvodí `yearFrom/yearTo/month/day/dateQual` |
| `placeSlug`, `houseKey`, `placeText` | místo z DB, dům z DB, nebo text (když místo v DB není) |
| `text` | povolání, příčina…, volný text |
| `persons` | `[{personId, role}]` – `hlavni`; u sňatku obě strany (`zenich`, `nevesta` nebo obě `hlavni`); kdo je jen zmíněn (otec u křtu) má jinou roli |
| `certainty`, `note`, `sources` | jistota, poznámka, citace |

Úprava události: API v PATCH doplní chybějící `certainty` na `unk` – proto `rdb.py udalost uprav` vyžaduje `--jistota`.

## Citace (zdroje)
Každý údaj (událost, vztah, bydliště, osoba) má mít zdroj: `{"recordKey": "<klíč zápisu>"}`, `{"tipId": <vodítko>}`
nebo `{"documentId": <dokument>}` (právě jedno) + volitelně `note`. V nálezu se zápis doplní sám; jinak `--zaznam`,
`--voditko`, `--dokument` u `rdb.py … pridej`, nebo dodatečně `rdb.py citace pridej --udalost <id> --zaznam <klíč>`.
Citace zápisu k události zároveň připojí osoby události k zápisu (role podle typu: `dite`, `zemrely`, jinak `zminen`).

## Bydliště (`POST /bydliste`)
`personId`, `placeSlug` / `houseKey` / `placeText`, `cp`, `fromText`, `toText` (texty jako u data), `role`
(„domkář“, „syn, pak držitel“, „výměnkář“), `certainty`, `sources`. Z každého zápisu s číslem domu. Je to most
k domům (`tools/domy_rodiny.py`).

## Svazky a zápisy
**Svazek** (`PUT /svazky/<klíč>`): `archive`, `portal`, `title` (např. „N Holice 1880–1900, sign. …“), `description`,
`url`, `kind` (N, O, Z, NOZ, I, S = sčítání, G, K…), `yearFrom`/`yearTo`, `imageCount` (počet snímků), `placeSlug`
(obec/farnost svazku), `meta` (údaje portálu ke stažení, např. sčítání MZA `{cesta, prefix, signatura}`).
Hledání: `GET /svazky?misto=<slug>&druh=S&rok=1880`. Klíč podle portálu: `mza_<id>`, `trebon_<id>`, `pf_<kniha>`, `ebad_<id>`, ARON prvních
8 znaků apu. Stahovače ho registrují samy (`… svazek <id>`).

**Zápis** (`PUT /zaznamy/<klíč>` celý, `PATCH` část; `rdb.py zaznam …`, běžně v nálezu):
| pole | význam |
|---|---|
| klíč | malá písmena bez diakritiky: `n-horni-lhota-1820-jan`, `obec_druh_kdo_rok`, u domů `obec_scitani_cp12_1890` |
| `kind` | N narození/křest, O sňatek, Z úmrtí, I index/rejstřík, S sčítání, G gruntovní kniha, K katastr, M mapa, C cizí pramen, L literatura, J jiný |
| `volumeKey`, `imageNo`, `url` | svazek, číslo snímku, trvalý odkaz na snímek (`… link`) |
| `dateText`, `year` | datum zápisu česky (web podle něj řadí); rok se odvodí |
| `title`, `summary` | název („Křest Jana Nováka“) a shrnutí jednou větou (jména, dům, rodiče, kmotři) |
| `transcriptOrig` | věrný přepis po sloupcích, `[Název sloupce]` v hranatých závorkách, nejisté „(?)“, nečitelné „[…]“, zkratky ponechat |
| `transcriptCs` | srozumitelný český překlad pro rodinu; vysvětli staré pojmy (domkář, podruh) |
| `review` | `rozpracovano` → `ke_kontrole` (čtení pomocníka, neověřené) → `overeno` (ověřil hlavní agent na snímku) |
| `persons` | osoby v rolích: `[{personId, role, nameAsWritten}]` – `dite`, `otec`, `matka`, `kmotr`, `kmotra`, `svedek`, `zenich`, `nevesta`, `zemrely`, `porodni_baba`, `farar`, `drzitel`, `obyvatel`, `zminen` …; při uvedení **nahradí celý seznam** |

**Výřez** ke každému zápisu: `tools/vyrez.py` (web max. 1800 px + plná varianta, max. 4 MB) → `PUT
/zaznamy/<klíč>/vyrez?varianta=web|plny`. Obrázky jsou v DB, čtou se jen přes `/media/<sha256>` (s přihlášením).
**Rámeček** čteného místa: `tools/ramecek.py` → `PUT /zaznamy/<klíč>/zvyrazneni` `{"boxes": [[x0,y0,x1,y1]], "status":
"ok", "note": ""}` – zlomky šířky/výšky webového výřezu; má obepnout celý čtený zápis (ne jen jméno).

**Nález** (`POST /nalez`, `rdb.py nalez`) = svazek + zápis + nové osoby + vztahy + události + bydliště + vyřízená
vodítka + deník v jedné transakci. Tvar s příkladem je v `SKILL.md` → „JSON nálezu“.

## Místa, příjmení, domy
**Místo** (`rdb.py misto pridej <slug>` – slug = název bez diakritiky, `horni-lhota`): `name`, `kind` (obec, osada,
bod…), `parentSlug`, `lat`, `lon`, `osm`, `query` (dotaz pro OpenStreetMap), `pattern` (regulární výraz pro hledání
v textech – kmen slova kvůli skloňování: „Holic“ najde Holice i v Holicích; pozor na kolize, `(?<!Nový )Hradec`),
`hypothesis` (místo jen tušené), `description`, `parish` (farnost), `estate` (panství), `district` (okres),
`modernName` (dnešní obec / část obce). Úprava jen některých polí: `PATCH /mista/<slug>`. **Staré, německé, latinské názvy** a tvary ze zápisů:
`rdb.py misto nazev <slug> "Ober-Lhota" --jazyk de --pozn "matrika 1790"` (omyl: `… --smaz`); hledání `rdb.py misto hledej <tvar>` je
najde. Souřadnice dohledá `tools/mista.py` (OSM); u víceznačných názvů (Podolí, Dub, Lhota) zadej dotaz se sousední
obcí (`mista.py pridej "Podolí" "Podol" "Podolí, Odlochovice"`) a ve výpisu zkontroluj okres. Místopis nejlíp zná
rodina – když si nejsi jistý, zeptej se. Události obce: `rdb.py misto udalost`.

**Varianty příjmení** (`rdb.py prijmeni pridej Novák Nowak --pozn "…"`, `rdb.py prijmeni hledej nowak`).

**Domy** – `reference-dum/data.md` (`rdb.py dum pridej <json>` podle `HouseIn`).

## Vodítka, deník, úkoly
**Vodítko** (`rdb.py voditko pridej`): údaj od rodiny nebo zvěst – `kind` `od_rodiny` | `zvest` | `oprava` | `napad`,
`text` (co přesně kdo řekl), `personIds` (koho se týká), `toldByPersonId` / `toldByName`, `channel`, `sensitive`.
Je to **fronta nezpracovaných stop**, ne fakt. Stav (`rdb.py voditko stav`): `nezpracovano` → `overuje_se` →
`potvrzeno` | `vyvraceno` | `nelze_overit` | `rozdeleno` (rozsekáno na menší vodítka; v poznámce „rozděleno do #…“)
+ `resolutionNote` + zápisy, které ho rozhodly. Jako zdroj údaje s jistotou `fam`: `{"tipId": …}`. Členové rodiny
posílají vodítka i z webu. **1 tvrzení = 1 vodítko s osobami** (podle osob se řadí k rodu).

**Deník** (`rdb.py denik pridej|hledej|posledni`): každé hledání **i neúspěšné** – `title` (svazek a co), `textMd`,
`volumeKey`, `pages` (rozsah snímků/stran/let), `result` `nalezeno` | `nenalezeno` | `castecne` | `nedostupne` (portál/kniha nejde otevřít – zkusit později) | `jine`,
`personIds`, `recordKeys`, `tipIds`. Id přiděluje DB (žádná čísla řádků). Před každým hledáním `denik hledej`.

**Úkoly** (`rdb.py ukol …`) = stav projektu a rozpracované věci (dřív `STAV.md`, `archivni_dotazy.md`, fronta úkolů):
`title`, `body`, `kind` (`badani`, `archiv`, `web`, `pribeh`…), `status` `otevreny` | `rozpracovany` | `ceka` |
`hotovy` | `zruseny`, `priority` 1–3, `personIds` (vždy vyplň – podle nich se úkol řadí k rodu).

**Rody u vodítek, deníku a úkolů** se dopočítají z jejich osob: API vrací u každé položky `lines` (slugy rodů)
a filtruje `?rod=<slug>` (`?rod=bez` = žádná osoba v rodu): `GET voditka|ukoly|denik?rod=…`, v `rdb.py` volba
`--rod`. Výpis `voditko seznam` a `ukol seznam` bez `--rod` je seskupený po rodech.
**Větve prarodičů**: `?vetev=<kořen>` přidá `branches` (Kekule prarodičů 4–7, do jejichž větve položka patří),
`&prarodic=<4–7>` filtruje. Větev prarodiče = on, jeho předci a všichni jejich potomci kromě kořene, jeho rodičů
a jejich potomků (ti jsou společní); přiženění k bočním liniím do větve nepatří. `rdb.py … --vetev <kořen> [--prarodic k]`.

## Výklad
- **Hypotézy** (`rdb.py hypoteza`): `title`, `text`, `items` `[{name, text}]` (kandidáti), `personId`, `recordKeys`.
- **Otázky** (`rdb.py otazka`): „Co hledáme“ – `question`, `answer`, `state` `otevrene` | `hypoteza` | `vyreseno`.
  Jde na web – nepiš sem citlivé věci (příčiny úmrtí, rodinné spory) bez souhlasu.
- **Rody** se počítají z grafu, stejně pro všechny přihlášené (`src/server/rody.ts`):
  - **Vrchol** osoby: nahoru po otci; bez otce po matce jen tehdy, když nese její příjmení (nemanželské dítě).
  - **Rod existuje** pro každý vrchol, ke kterému vede předek některé žijící osoby do pradědů (Kekule 2–15) a jehož
    linie má aspoň 2 osoby (přivdaná žena bez známých rodičů vlastní rod nemá). Slug dopočítaného rodu
    `rod-<id vrcholu>`, jméno z příjmení (`Novákové`), `auto: true`. Plus uložené rody (tabulka `line`).
  - **Členství**: osoba patří do rodu svého vrcholu (dcery do rodu otce, manželky do svého); jinak (staří předci
    přes ženské linie, přivdaná bez rodičů) do rodu nejbližšího potomka; jinak „bez rodu“.
  - **Moje rody** osoby = její rod a rody všech jejích předků: `GET rody?pro=<id>`, `rdb.py rod seznam --pro <id>`.
  - **Pojmenování / popis / barva**: `rdb.py rod pridej <slug> --nazev "Novákové" --zakladatel <kdokoli z linie>
    --popis … --barva …`. Dopočítaný rod se tím uloží (slug můžeš zvolit hezčí, např. `janatovi`; starý `rod-…` zmizí).
    Zakladatel může stát kdekoli na linii; dva uložené rody na jedné linii ohlásí `rdb.py kontrola` jako chybu.
- **Příběhy** (`rdb.py pribeh uloz <slug> <soubor.md> --titulek … --perex … --druh pribeh|pribeh_domu|zajimavosti|jine
  --rod <slug> --dum <klíč>`; příběh rodu má druh `pribeh`, jinak chybí v seznamu „Příběhy“; v API navíc `yearFrom`/`yearTo` = období a `coverSha` = titulní obrázek z `/media`): markdown s kapitolami `##`, odkazy na osoby `[Jan Novák](/osoba/<id>/)`. Jak psát:
  `pribehy.md`.
- **Boční příbuzní** bez vlastních osob: `rdb.py osoba bocni <id> --titulek … --text soubor.md`.
- **Rodinné dokumenty a fotky**: `rdb.py api POST dokumenty '{"title": …, "personIds": […], "houseKeys": […]}'`,
  obrázek `rdb.py api PUT dokumenty/<id>/obrazek --binarni <soubor>`. **Staré mapy**: `POST mapy` + `PUT mapy/<id>/obrazek`
  (Praha: `ipr_praha.py … --zapsat`).
- **Nastavení webu** (`GET nastaveni`, `PUT nastaveni/<klíč> {"value": …}`, admin): `nazev`, `vychozi_koren`, `kontakt`…

## Jistota (`certainty`)
`doc` přečteno sám na snímku · `prob` pravděpodobné (v poznámce proč) · `fam` od rodiny (i strom, který si rodina vede
sama, např. její GEDCOM) · `mh` cizí strom z internetu · `unk` neznámé · `lit` literatura (se stranou).

## Soukromí
Žijící osoby: ukládej jen jméno a rok narození (podrobnosti nanejvýš do `notePrivate`). Web je ořezává sám – člen rodiny
vidí u žijících jen jméno a rok narození. Citlivé vodítko `--citlive`. Pravidla: `soukromi.md`.
