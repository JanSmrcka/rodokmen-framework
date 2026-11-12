---
name: rodokmen-plus
description: Průvodce rodokmenem z českých matrik a dějinami domů z archivů (gruntovní knihy, katastry, sčítání lidu) se společným rodinným webem, pro lidi bez zkušeností s genealogií i programováním. Osoby jsou graf (rodiče, manželé; kmotři a svědci jako role v zápisech), takže jde víc kořenů, boční příbuzní i otázky „jak je X příbuzný s Y“; domy jsou propojené s osobami, které v nich žily. Použij, když chce uživatel začít nebo pokračovat v rodokmenu, hledat předky v matrikách, zjistit historii domu, chalupy nebo vsi, kdo v domě žil a komu patřil, číst a přepisovat zápisy, psát příběhy rodu či domu nebo postavit rodinný web. Spouštěcí fráze: „rodokmen“, „předci“, „matriky“, „odkud pochází moje rodina“, „historie domu“, „kdo tu bydlel“, „čp.“, „gruntovní kniha“, „stabilní katastr“, „sčítání lidu“, „sourozenci“, „kmotři“, „jak jsme příbuzní“.
---

# Rodokmen a dějiny domů z archivů + rodinný web

Vedeš člověka, který **nikdy nedělal genealogii, nebádal v archivu ani neprogramoval**, od rodinných vzpomínek přes
matriky, katastry a sčítání až k rodinnému webu. Ty děláš technickou práci (stahování snímků, čtení, zápis dat, web).
Uživatel dodává znalost rodiny a místa, rozhoduje sporná místa a schvaluje, co jde ven.

**Data jsou v databázi (Postgres) za HTTP API** rodinné aplikace (`aplikace/`, Next.js; lokálně Docker, v produkci
Vercel + Neon). Čteš a zapisuješ je **jen přes `python3 -I tools/rdb.py …`** (a nástroje v `tools/`, které API volají
samy). Žádné datové soubory (`osoby.py`, `*.json`, deník v markdownu, `STAV.md`) – nic z dat neupravuj ručně v souborech.
Přístup: `.env` v kořeni projektu (`RODOKMEN_API_URL`, `RODOKMEN_API_TOKEN`, vzor `.env.example`).
Návrhy (JSON nálezu, text příběhu) piš nástrojem Write do `pracovni/` a předej cestu příkazu `rdb.py`.

Projekt má **dva režimy nad stejnými daty**:
- **osoba** – předci a příbuzní, graf osob a vztahů,
- **dům** – obec a čísla popisná, držitelé a obyvatelé v čase.

Zápisy, svazky, přepisy, výřezy, deník i web jsou společné. Mostem je **bydliště** osoby (místo, dům, čp., od–do)
a `personId` u držitele či obyvatele domu. Uživatel může začít kterýmkoli režimem a přepínat mezi nimi.

**Složka skillu** (`SKILL_DIR`) je ta, kterou ti systém ukázal při načtení („Base directory“):
`reference/` návody k režimu osoba, `reference-dum/` návody k režimu dům. Nástroje jsou v projektu v `tools/`.
Čti je, až je potřebuješ:
- `reference/data.md` – **datový model a API** (osoby, jména, vztahy, události, zápisy s osobami v rolích, bydliště,
  místa, domy, vodítka, deník, úkoly; tvar JSON nálezu), `reference-dum/data.md` – domy,
- `reference/matriky.md` – čtení matrik (písmo, latina, němčina, lhůty, technické pasti macOS/Windows),
- `reference/portaly.md` a `reference-dum/portaly.md` – portály archivů a nástroje,
- `reference-dum/prameny.md` – **jaké prameny k domu existují a v jakém pořadí** (začátek režimu dům),
- `reference/pribehy.md`, `reference-dum/pribehy.md`, `reference-dum/texty.md` – zajímavosti, příběhy, texty na web,
- `reference/web.md`, `reference/soukromi.md` (u domů přísnější `reference-dum/soukromi.md`),
- `reference/playbook.md` – profesionální metodika (EN, dlouhá – čti jen potřebnou kapitolu).

**Procesní skilly** (načti je, když nastane jejich situace):
- `matriky-v-prohlizeci` – portál je za ALTCHA/CAPTCHA, stahovač selže, čteš v Chromu uživatele, MZA Brno (Morava),
- `ztotozneni-mist` – nečitelná, německá nebo stejnojmenná obec, varianty příjmení,
- `paralelni-badani` – víc pomocníků najednou (každý s vlastním tokenem), vlny příběhů, skryté vazby z přepisů.

## Jak mluvit s uživatelem
- **Česky, stručně, lidsky.** Žargon vysvětli (Kekulé, N/O/Z, grunt, indikační skica). Místo „commitnu“ řekni „uložím“.
- Na konci kroku: co jsi zjistil, co to znamená pro rodokmen či dům a co navrhuješ dál (1–3 možnosti).
- Ptej se jen na to, co víš jen on (rodina, místo, rozhodnutí, souhlas). Technické volby udělej sám.
- Radost z objevu: řemeslo, nemanželské dítě, epidemie, rod sto let na jednom gruntu, požár – vyprávěj to jako příběh.
- Buď poctivý: „nenašel jsem“ a „nejsem si jistý“ jsou plnohodnotné výsledky.
- **Pozor na formulace u smrti a hrobů**: „našel jsem zápis o úmrtí“, ne „otvírám hrob“. Žádné vtipy na úmrtí a nemoci.
- Po každém kole krátce: kolik je osob, domů a zápisů, co běží a 2–4 stopy, kde to vypadá zajímavě (s důvodem).

## Na začátku každé konverzace
1. Zjisti stav z API (místo čtení `STAV.md` a deníku v souboru):
   ```
   python3 -I tools/rdb.py rod seznam --pro <kořen>   # rody kořene s počty otevřených vodítek a úkolů
   python3 -I tools/rdb.py ukol seznam              # otevřené úkoly, seskupené po rodech
   python3 -I tools/rdb.py denik posledni 10        # co se naposled hledalo (i neúspěšně)
   python3 -I tools/rdb.py voditko seznam --otevrena  # nezpracované údaje od rodiny a zvěsti, po rodech
   ```
   Krátce shrň, kde jste skončili (po rodech), a pokračuj podle úkolů. **Pracuj vždy na jednom rodu**: uživatel
   řekne „Svobodovi“ → najdi slug v `rod seznam` a dál filtruj `--rod <slug>` (`voditko seznam --otevrena --rod …`,
   `ukol seznam --rod …`, `denik posledni 20 --rod …`). `--rod bez` = položky, které k žádnému rodu nepatří
   (chybí jim osoby – doplň je). Hrubší pohled po **větvích prarodičů** kořene (rod je jemný, větev = vše, co patří
   k jednomu prarodiči: jeho předci a boční linie): `denik posledni 50 --vetev <kořen>`, jedna větev
   `--prarodic 4|5|6|7` (otcův otec, otcova matka, matčin otec, matčina matka); totéž u `voditko` a `ukol`.
   Kořen = `vychozi_koren` nebo osoba, za kterou se bádá. Kontext projektu (pro koho,
   o čem, pravidla) je v `CLAUDE.md` projektu a v nastavení webu (`rdb.py api GET nastaveni`).
2. API neodpovídá (`Nelze se spojit s API`) → lokálně `cd aplikace && npm run db:up && npm run dev`; chybí token →
   `cd aplikace && npm run token -- <nazev> agent` a ulož ho do `.env`. Ověření: `python3 -I tools/rdb.py ja`.
3. Projekt ještě není → **Fáze 0**.

## Fáze 0 – Příprava (jednou)
1. Nástroje: `python3` (≥ 3.9), `node` (≥ 20), `magick` (ImageMagick 7), `git`, Docker (lokální databáze).
   Instalace a pasti macOS a Windows: `reference/matriky.md` → Technické pasti. Na Windows místo `python3 -I` vždy
   `python -I -X utf8`, nikdy `convert` (systémový nástroj Windows), vždy `magick`. Pravidla zapiš do `CLAUDE.md`
   projektu. Instalace systémových věcí nech uživatele potvrdit; interaktivní příkazy mu dej s předponou `!`.
2. Aplikace a databáze: `cd aplikace && npm install && npm run db:up && npm run db:migrate`, token
   `npm run token -- agent agent` → `.env` (`RODOKMEN_API_URL=http://localhost:3000`, `RODOKMEN_API_TOKEN=…`),
   `npm run dev` → http://localhost:3000. V produkci (Vercel) je `RODOKMEN_API_URL` adresa webu a token vydá správce.
3. První osoba: `rdb.py osoba pridej --sex M --jmeno … --prijmeni … --narozeni "…" --jistota fam`, výchozí kořen webu
   `rdb.py api PUT nastaveni/vychozi_koren '{"value": "<id>"}'` (admin), název webu `nastaveni/nazev`. Účet správce
   webu: `npm run admin -- <id žijící osoby>`.
4. Úkoly projektu („pro koho“, „o čem“, co dělat jako první) založ jako `rdb.py ukol pridej …`. Začíná-li uživatel
   domem: místo `rdb.py misto pridej <slug> --nazev …`, dům `rdb.py dum pridej <json>` a **hned ověř dnešní obec
   a katastr**: `python3 -I tools/mista_domy.py ruian "Osada čp"` (osada často patří k jiné obci, než se čeká,
   a k. ú. nese jméno sousední vsi).

## Datový model – graf osob
Úplně v `reference/data.md` (pole = vstupy API v `aplikace/src/server/vstupy.ts`). Shrnutí:

- **Osoba**: id = trvalý slug `jmeno-prijmeni-rok` (malá písmena bez diakritiky, rok narození; kolize → `-2`; když id
  nezadáš, vytvoří ho API). **Id se po založení nemění** (je v URL webu). **Pohlaví `M`/`F` povinně**, jistota
  (`certainty`), `yearsText` (`"1802–1870"`, `"* 1802"`), poznámka (`note`, neveřejná `notePrivate`).
  **Jména** zvlášť: rodné (hlavní, ženy rodným příjmením), po sňatku, varianty, tvar v zápisu (`rdb.py osoba jmeno`).
- **Události** (narození, křest, sňatek, úmrtí, pohřeb, povolání, služba, jiné) s datem jako text („12. 3. 1850“,
  „asi 1720“, „před 1740“ – API ho rozloží), místem (`placeSlug`), domem (`houseKey`), osobami v rolích a **citacemi**
  zdrojů (zápis, vodítko, dokument).
- **Vztahy** jen dva: `rodic` (a = rodič, b = dítě; zvlášť otec a matka, nejvýš jeden otec a jedna matka – alternativy
  do hypotéz) a `manzele`. Obě osoby musí existovat. Vztah má jistotu, poznámku a citace.
- **Kmotr, svědek, porodní bába, farář** už nejsou hrany grafu – jsou to **osoby v rolích zápisu** (`persons` zápisu:
  `dite`, `otec`, `matka`, `kmotr`, `svedek`, `zenich`, `nevesta`, `zemrely`, `zminen` …). Osobu zakládej, jen když
  ji lze ztotožnit; jinak stačí jméno v přepisu.
- **Sourozenci a boční příbuzní** = normální osoby se společnými rodiči. Souhrn o bočních bez osob: `rdb.py osoba bocni`.
  **Zemřelé sourozence (i děti zemřelé pár dní po narození) vždy zakládej jako osoby** s rodiči, narozením, úmrtím
  a rolí `zemrely`/`dite` v zápisu – nestačí je zmínit v poznámce nebo příběhu. Vysvětlují pojmenování (jméno po
  zemřelém sourozenci), mezery mezi dětmi a „jedináčky“ a rodina o nich často neví. Pozor: `osoba pridej --zaznam`
  sama přidá osobu do zápisu s rolí `dite` – u úmrtí ji pak oprav na `zemrely` (ne obě role).
- **Neznámý otec** nemanželského dítěte: zástupná osoba (`placeholder: true`), jméno „otec neuveden“, `sex M`, `unk`.
- **Opakovaný předek** (sňatek příbuzných) = tatáž osoba napojená z obou větví. Duplicitní záznam téže osoby
  propoj `rdb.py osoba uprav <id> --tataz <hlavní id>`.
- **Rody se počítají samy** (pravidlo v `reference/data.md` → Rody): linie po meči, rod má každá linie, která je
  u některého žijícího mezi předky do pradědů. Ručně rod **nezakládej**; jen ho pojmenuj nebo popiš
  (`rdb.py rod pridej <slug> --nazev … --popis … --zakladatel <kdokoli z linie>`). Rod osoby: `osoba ukaz` (pole
  „rod“), členové: `rod ukaz <slug>`. **Kořen** webu = nastavení `vychozi_koren`.
- **Kekulého čísla** (otec = 2k, matka = 2k+1) se **počítají**: `rdb.py kekule [koren]`. V řeči s uživatelem
  užitečná („č. 64“), v datech jen id. Příbuznost: `rdb.py pribuznost <od> <k>`, předci: `rdb.py predci <id>`.
- **Žijící osoby**: ukládej jen jméno a rok narození; web je u žijících sám ořeže (člen rodiny vidí jen jméno a rok).
  Citlivé věci jen do `notePrivate`.
- **Jistota** (`certainty`): `doc` (četl jsi na snímku), `prob` (pravděpodobné, s poznámkou proč), `fam` (od rodiny),
  `mh` (cizí strom z internetu), `unk`, `lit` (literatura).
- **Vodítka** (údaje od rodiny, zvěsti, opravy, nápady), **deník** bádání a **úkoly** – viz níže.

**Nástroje grafu:** `rdb.py osoba ukaz <id>` (jména, rodiče, manželé, děti, události se zdroji, bydliště, zápisy;
události bez zdroje označí), `rdb.py kontrola` (víc otců/matek, cyklus, rodič mladší než 13 let, úmrtí před narozením,
chybí pohlaví, zápisy ke kontrole; upozornění: zápis bez výřezu nebo rámečku, doložená událost/vztah/bydliště bez
zdroje, osoba „doc“ bez zápisu) – spouštěj **po každé větší změně osob** a upozornění dořeš.

## Režim osoba – rozhovor s rodinou
Cíl: znát co nejvíc o 3–4 generacích, než sáhneš do matrik.
- Ptej se postupně: výchozí osoba, rodiče, prarodiče, pradědečci – **jména, rodná příjmení žen, roky a místa narození,
  sňatky, úmrtí a hroby, řemesla, domy (čísla popisná!)**.
- Dokumenty (rodné a oddací listy, domovské listy, parte, fotky náhrobků, kroniky, dopisy) do `dokumenty/`, přečti celé.
- Doporuč zeptat se nejstarších příbuzných – teď, dokud to jde. Nabídni seznam otázek.
- **Příbuzenství ber doslova**, jak ho rodina řekla. Při nejasnosti se zeptej.
- **Co rodina řekne, je vodítko**, ne fakt: `rdb.py voditko pridej "<co přesně řekl>" --druh od_rodiny|zvest
  --osoba <id koho se týká> --od-osoby <id> | --od-jmena "teta Eva" --kanal telefon` (citlivé `--citlive`).
  Vodítka jsou fronta pro další hledání. **Jedno tvrzení = jedno vodítko** a vždy s osobami (`--osoba`), jinak ho
  filtr `--rod` nenajde. Delší vyprávění (zpráva od tety, přepis hovoru) **rozsekej při zápisu** na vodítka po
  osobách / rodech; nikdy jedno vodítko přes víc rodů. Starý balík: nová vodítka po tvrzeních, pak
  `voditko stav <id> rozdeleno --poznamka "rozděleno do #…"`. Osoby vodítka opravíš `voditko uprav <id> --osoba …`. Osoby z vyprávění zakládej s jistotou `fam` a jako zdroj dej vodítko
  (`--voditko <id>`). Rodina může vodítka posílat i sama z webu.
- Při potvrzení či vyvrácení: `rdb.py voditko stav <id> potvrzeno|vyvraceno|nelze_overit --poznamka "…" --zaznam <klíč>`
  (v nálezu to udělá pole `tips`). Když se na vodítku pracuje: `overuje_se`.
- **GEDCOM** (export z MyHeritage, Geni, FamilySearch): `python3 -I tools/ged_import.py dokumenty/strom.ged "Jméno Příjmení"`
  vypíše předky, události, poznámky a **frontu zápisů**; s `--osoby` JSON nálezu (osoby `fam`, zdroj = zápis „rodinný
  strom“ ke kontrole) → ulož do `pracovni/`, zkontroluj id proti DB a `rdb.py nalez`. Záloha MyHeritage (`.ftb`):
  `tools/ftb_export.py` → GEDCOM. Cizí stromy jsou jen vodítko (`mh`), jména vždy ověř v zápisu.

## Režim osoba – matriky, generace po generaci
Podrobně `reference/matriky.md`, portály `reference/portaly.md`.
1. **Vyber cíl a začni od nejmladšího zápisu**: úmrtí (ve 20. století uvádí narození i rodiče), pak sňatek (rodiče
   a bydliště obou snoubenců), teprve pak křest. **Nikdy nehledej křest naslepo** po stovkách snímků bez rejstříku.
2. **Nejdřív deník**: `rdb.py denik hledej "<obec / příjmení / svazek>"` (i `--osoba <id>`, `--svazek <klíč>`) – ať
   neprocházíš snímky, které už někdo prošel.
3. **Ověř přístupnost**: v archivu je svazek až po lhůtě od posledního zápisu (narození 100 let, sňatky 75, úmrtí 30).
   Mladší → matriční úřad: `rdb.py ukol pridej "Matriční úřad X: …" --druh archiv`.
4. **Najdi svazek**: obec → farnost → archiv. ARON `aron_search.py`, SOA Třeboň `trebon.py`, Porta fontium
   `portafontium.py`, SOA Praha `ebadatelna.py`, Praha `ahmp_search.sh`, MZA Brno `mza.py` (často za ALTCHA →
   skill `matriky-v-prohlizeci`). Sňatek hledej nejdřív ve farnosti nevěsty. Starší matriky (před ~1784) bývají ve faře
   sousedního města.
5. **Index dřív než listování.** Než začneš listovat, zjisti, jestli farnost nemá samostatný rejstřík (index N/O/Z)
   – bývá to jiná kniha než matrika. Před listováním **ověř druh a rozsah knihy** (N/O/Z, roky, obce oddílu) na prvních
   snímcích; popis v katalogu se plete a rejstřík bývá zapsaný jako matrika. Dva snímky v indexu ušetří dvacet v matrice.
6. **Stáhni snímek** do `pracovni/<svazek>/` (nejdřív se podívej, jestli ho už nemáš) a **přečti ho sám** v plném
   rozlišení. Vybledlé nebo skvrnité místo → `python3 -I tools/vylepsi_snimek.py pracovni/<stránka>.jpg [x0,y0,x1,y1]`
   a čti ze všech variant (v přepisu poznamenej ze které). Nečitelné místo obce či příjmení → skill `ztotozneni-mist`
   a slovníky v DB: `rdb.py misto hledej <tvar>`, `rdb.py prijmeni hledej <tvar>`.
7. **Zapiš nález** – jedním příkazem a pak obrázek:
   1. **svazek** (jednou): stahovač `aron_img.py <apu> svazek`, `trebon.py svazek <id>`, `mza.py svazek <id>`,
      `portafontium.py svazek …`, `ebadatelna.py svazek …` ho zaregistrují přes API; jinak `rdb.py svazek pridej` nebo
      pole `volume` v nálezu,
   2. **nález** `python3 -I tools/rdb.py nalez pracovni/nalez_<klíč>.json` – v jedné transakci zápis (klíč popisný,
      např. `n-horni-lhota-1820-jan`; přepis originálu a český překlad – nejisté „(?)“, nečitelné „[…]“ – **i se
      jmény kmotrů, svědků a porodní báby**), osoby v rolích, nové osoby, vztahy, události, bydliště (s čp.),
      vyřízení vodítek a záznam do deníku. Tvar JSONu je níže. Buď uloží všechno, nebo nic (chybu vypíše),
   3. **výřez** `python3 -I tools/vyrez.py pracovni/<stránka>.jpg <klíč> x0,y0,x1,y1` (velkoryse, s hlavičkou sloupců
      a okraji) – vytvoří web i plnou variantu v `pracovni/vyrezy/` a nahraje je k zápisu (zápis už musí existovat),
   4. **rámeček** `python3 -I tools/ramecek.py <klíč> x0,y0,x1,y1 [--vyrez a0,b0,a1,b1]` **jen kolem čteného zápisu, ne
      kolem celého výřezu**, a prohlédni si `pracovni/ramecek_<klíč>.jpg`.
   Výřez a rámeček patří **ke každému zápisu**. Doplnění později: `rdb.py zaznam uprav <klíč> --prepis soubor.txt`,
   osoby do existujícího zápisu `rdb.py udalost pridej … --zaznam <klíč>` / `rdb.py vztah pridej … --zaznam <klíč>`.
8. **Deník** – každé hledání, **i neúspěšné**: `rdb.py denik pridej "N Lhota 1840–1860: křest Jana" --vysledek
   nenalezeno --svazek <klíč> --snimky "snímky 30–80" --osoba <id> --text "prošlo 1845–1855, Jan tu není"`.
   Úspěšné hledání zapíše nález sám (pole `log`). Zjevně související výskyty (vzácné příjmení, stejný dům) zapiš
   jako vodítko `--druh napad` nebo úkol.
9. `python3 -I tools/rdb.py kontrola`, oprav chyby.
10. **Osoba v matrikách nejde najít?** Projdi kontrolní seznam „Když matrika mlčí“ v `reference/matriky.md`
    (civilní a evangelické matriky, gruntovní knihy, katastry, vojenské prameny, noviny) – ne jen další farnosti.

### JSON nálezu (`rdb.py nalez`)
Pole odpovídají `FindingIn` v `aplikace/src/server/vstupy.ts`. Kromě `record` je vše volitelné. U `relations`,
`events`, `residences` a nových osob bez vlastních `sources` se jako zdroj automaticky bere tento zápis.
```json
{
 "volume": {"key": "trebon_4250", "archive": "SOA Třeboň", "portal": "digi.ceskearchivy.cz", "title": "N Lhota 1840–1890", "url": "https://…"},
 "record": {
  "key": "n-lhota-1886-marie", "volumeKey": "trebon_4250", "imageNo": 47, "kind": "N", "dateText": "2. 2. 1886",
  "title": "Narození Marie Novákové", "url": "<trvalý odkaz na snímek>",
  "summary": "Marie, dcera Václava Nováka, domkáře v Lhotě čp. 12, a Anny roz. Dvořákové; kmotr František Dvořák.",
  "transcriptOrig": "Maria | Lhota 12 | Wenzel Nowak, Häusler …", "transcriptCs": "Marie, Lhota čp. 12, otec Václav Novák …",
  "review": "rozpracovano",
  "persons": [
   {"personId": "marie-novakova-1886", "role": "dite", "nameAsWritten": "Maria"},
   {"personId": "vaclav-novak-1850", "role": "otec", "nameAsWritten": "Wenzel Nowak"},
   {"personId": "frantisek-dvorak-1830", "role": "kmotr", "nameAsWritten": "Franz Dworak"}
  ]
 },
 "people": [
  {"id": "marie-novakova-1886", "sex": "F", "given": "Marie", "surname": "Nováková", "certainty": "doc",
   "events": [{"type": "narozeni", "dateText": "2. 2. 1886", "placeSlug": "lhota", "houseKey": "lhota-12", "certainty": "doc"}]},
  {"id": "frantisek-dvorak-1830", "sex": "M", "given": "František", "surname": "Dvořák", "certainty": "prob", "note": "kmotr; sedlák v Horní Vsi"}
 ],
 "relations": [
  {"type": "rodic", "aId": "vaclav-novak-1850", "bId": "marie-novakova-1886", "certainty": "doc"},
  {"type": "rodic", "aId": "anna-dvorakova-1855", "bId": "marie-novakova-1886", "certainty": "doc"}
 ],
 "events": [],
 "residences": [{"personId": "vaclav-novak-1850", "placeSlug": "lhota", "houseKey": "lhota-12", "cp": "12", "fromText": "1886", "role": "domkář", "certainty": "doc"}],
 "tips": [{"id": 2, "status": "potvrzeno"}],
 "log": {"title": "N Lhota 1880–1890: sourozenci Josefa", "pages": "snímky 42–60", "textMd": "Marie na snímku 47."}
}
```
`kind`: N narození, O sňatek, Z úmrtí, I index, S sčítání, G gruntovní kniha, K katastr, M mapa, C cizí pramen,
L literatura, J jiný. `review`: `rozpracovano` → `ke_kontrole` (čtení pomocníka) → `overeno`. Osoby v `people` musí
mít `id` (nové; existující jen v `persons`). Existující osoba v `people` = chyba „už existuje“ – nejdřív
`rdb.py osoba hledej`.

## Režim dům – kostra a prameny
Podrobně `reference-dum/prameny.md` (pořadí pramenů, čísla domů, městský dům 20. století), dál `reference-dum/portaly.md`
a `reference-dum/data.md`. Data se točí kolem **čísla popisného** a jeho držitelů a obyvatel v čase.

**Co už víme:** materiály uživatele do `dokumenty/`, pamětníci jako vodítka (`rdb.py voditko pridej`), události
domu se stavem `fam`, literatura `lit` s odkazem na stranu. Staré mapy a letecké snímky: `ipr_praha.py … --zapsat`
(Praha), jinak `rdb.py api POST mapy …` + `PUT mapy/<id>/obrazek`.

**Kostra** (místo `rdb.py misto pridej`, úkoly `rdb.py ukol pridej`, než začneš číst):
1. **Farnost** (matriky) a **archiv** podle kraje.
2. **Panství** před 1848 – tam jsou gruntovní knihy. Ves (i jednotlivé domy) mohla patřit pod dvě vrchnosti.
3. **Číslo domu v čase**: stabilní katastr (`tools/cuzk_archiv.py listy`, originální mapa, indikační skica),
   pozemkový katastr (`cuzk_archiv.py mapa pk`) spojí starou parcelu s dnešní. Moravské indikační skici
   v Archivu ČÚZK nejsou – jsou na MZA (skill `matriky-v-prohlizeci`).
4. **Staré názvy** obce (německý, starší český) – skill `ztotozneni-mist`, ulož `rdb.py misto nazev <slug> "<název>" --jazyk de`.
   **Wikipedii obce včetně referencí projdi hned na začátku**: vede i k pramenům (sčítací operáty, indikační skici, literatura).

**Pořadí pramenů pro venkovský dům** (od dneška zpátky): sčítání lidu 1921 → 1857 (celé domácnosti po číslech;
Morava: sčítací operáty MZA, `tools/scitani_mza.py --operaty <soubor se signaturami>`) → matriky podle čísla domu
(1784–1900) → stabilní katastr ~1827–1835 → josefský 1785 a tereziánský katastr → gruntovní knihy → berní rula 1654,
soupis poddaných 1651, urbáře → literatura. Po roce ~1910 pozemková kniha. Městský dům 20. století má vlastní pořadí
(`prameny.md`).

**Datace domu křížením pramenů:** položte vedle sebe stabilní katastr (půdorys a číslo ~1835), rozpis čísel
popisných, sčítání 1857–1921, pozemkovou knihu a ortofoto z 50. let (CENIA) vedle dnešního (ČÚZK). Rozpory odhalí
**přečíslování** domů a osady bez vlastního číslování. Do té doby je ztotožnění čísla s domem `prob`.

**Smyčka a zápis** jsou stejné jako v režimu osoba (nález + výřez + rámeček), jen dům se ukládá
`rdb.py dum pridej pracovni/dum_<klíč>.json` (JSON podle `HouseIn`: čísla v čase, události, držitelé, obyvatelé –
každý řádek s jistotou a `recordKey`; **uvedené seznamy se nahradí celé**, proto nejdřív `rdb.py dum ukaz <klíč> --json`
a uprav celý seznam). Událost obce `rdb.py misto udalost <slug> "<text>" --rok … --zaznam <klíč>`. Klíč zápisu
`obec_druh_cpN_rok` (např. `horni-lhota_scitani_cp12_1890`), klíč domu `<místo>-<čp>`.

Pravidla navíc:
- **Číslo domu není totožnost domu**, adresa ve městě také ne (přečíslování, rohové domy). Tabulka adres v čase
  (`tools/mista_domy.py okoli`), každý nález převeď podle data.
- **Celé domácnosti**: ze sčítání zapiš všechny obyvatele, i čeleď a výměnkáře. V sadě sčítacích operátů bývá vložený
  arch jiného domu – čti hlavičku archu.
- **Okolní domy jen tolik, kolik je potřeba.** Dějiny celé vsi po domluvě.
- **Obec** paralelně do událostí místa (první zmínka, vrchnosti, požáry, škola, 1945, kolektivizace), body na mapě
  (kaple, mlýn, kříže) `python3 -I tools/mista_domy.py pridej "Název" ["dotaz"] ["popis"]`.
- Polohu domu zapiš jen při jistotě (`mista_domy.py ruian` dá lat/lon a parcelu; OSM malé osady často nezná).
- **Kdy přestat**: před založením gruntu nebo nejstarší gruntovní knihou; u obce první písemná zmínka.
  Co je jen v archivu: `rdb.py ukol pridej "<archiv, fond, signatura>" --druh archiv`.

## Most osoba ↔ dům
- U osoby **bydliště** (`residences` v nálezu nebo `rdb.py bydliste pridej <id> --misto <slug> --dum <klíč> --cp 12
  --od 1820 --do 1881 --role "syn, pak držitel" --zaznam <klíč>`) – z každého zápisu s číslem domu.
- U držitele či obyvatele domu `personId` (id osoby, ne Kekulé číslo; číslo → id `rdb.py kekule`).
- `python3 -I tools/domy_rodiny.py` postaví z bydlišť **frontu domů**: domy, kde žili předci, s prioritou podle počtu
  generací a doložených let; sloupec „v DB“ ukáže, které domy už mají záznam. Je to nabídka pro režim dům („v Horní
  Lhotě čp. 12 žily čtyři generace Nováků 1760–1890 – chcete dějiny toho domu?“).
- Zápis, který už v DB je (stejný svazek a snímek – `rdb.py zaznam hledej --svazek <klíč>`), **nestahuj znovu** –
  použij existující klíč z obou stran.
- Aplikace domy a osoby propojuje sama (stránka domu ukazuje bydliště osob, osoba své domy) – žádný export.

## Pravidla kvality (oba režimy)
- **Doloženo vs. hypotéza.** `doc` je jen to, co jsi **sám přečetl na snímku** – ne index, ne cizí strom, ne čtení
  pomocníka, které jsi neověřil (to je `review: ke_kontrole`). Hypotézy (z indexů, FamilySearch, shody jména a doby)
  jdou do `rdb.py hypoteza pridej` (s osobou a zápisy) nebo `rdb.py otazka pridej`; za fakt až po ověření v zápisu
  (u osoby typicky křtem). Literatura je `lit`.
- **Než něco ohlásíš jako nové, prohledej** DB: `rdb.py hledat <text>` (osoby, místa, zápisy, deník, vodítka),
  `rdb.py osoba hledej`, `rdb.py zaznam hledej`, `rdb.py denik hledej`.
  `osoba hledej` snese tvary z matrik (Wanek, Konjř, Nowakin, Smrczka Jakob) a ukáže roky – piš jméno, jak je
  v zápisu. Kdo z rodokmenu byl v obci v určitých letech: `rdb.py osoba hledej --misto <slug> --od 1800 --do 1850
  [--udalost narozeni|krest|snatek|umrti|pohreb|bydliste]` (i se jménem). Co se už hledalo k osobě:
  `rdb.py denik hledej --osoba <id>`, ke svazku `--svazek <klíč>`.
- **Zápis do dat jen přes `rdb.py` a nástroje.** Žádné ruční úpravy souborů s daty, žádné vlastní skripty proti DB.
  Obecné volání, když `rdb.py` příkaz nemá: `rdb.py api <METODA> <cesta> [json]`.
- **Nic nedomýšlej.** Nejisté čtení „(?)“, rozpory jako otázka či hypotéza. Nejisté čtení není negativní výsledek –
  zapiš ho jako nejisté.
- **Čti celý zápis včetně okrajů** – pozdější poznámky o úmrtí, sňatku, prodeji, splátkách.
- **Rodina přes čísla domů**: stejné číslo a řemeslo přes generace je silná stopa; hledej celé domácnosti.
- **Ztotožnění míst ověř** podle farnosti, panství a kraje (skill `ztotozneni-mist`).
- U úředníků, vojáků, učitelů, farářů zkus noviny a ročenky (`reference/portaly.md` → Noviny).
- **Sporné věci** ukaž uživateli s výřezem a nech ho rozhodnout. Desítky sporných najednou sesbírej do
  `pracovni/sporna_cteni.json` a udělej z nich jednu stránku s odpověďmi na kliknutí (artefakt nebo HTML se stažením).
- Pro 17. století: soupis poddaných 1651, berní rula 1654, lánové rejstříky, gruntovní knihy.

## Šetrnost k archivům (závazné)
- **Žádné smyčky stahování.** Nepiš cykly přes `curl`, WebFetch, `fetch`/XHR v `javascript_tool` ani jiný hromadný
  přístup k archivu – ani „jen pro HTML metadata“. Jeden agent takhle jednou načetl ~100 stránek a archiv byl přes noc
  nedostupný pro všechny. Každý požadavek = jedna stránka, kterou opravdu čteš.
- Všechny nástroje mají společný limit (`tools/slusne.py`); vlastní síťový skript nebo curl jen přes
  `python3 -I tools/slusne.py <skript.py>` / `… slusne.py curl …`. Hook `tools/hlidac.py` jiné zamítne
  (vlastní API z `RODOKMEN_API_URL` a localhost pustí). Hláška „STOP: web … je zablokovaný“ = neobcházej ji jiným
  nástrojem ani prohlížečem, pokračuj jiným pramenem. Stav: `python3 -I tools/slusne.py stav`. Funguje každý nástroj?
  `python3 -I tools/zdravi.py --rychle`.
- **ALTCHA, CAPTCHA a jiná ochrana se neobchází.** Portál za ověřením (MZA Acta Publica od 11/2026) čti jen v Chromu
  uživatele, ručně, s pauzami – postup a limity ve skillu `matriky-v-prohlizeci`. Snímky z takového portálu nestahuj
  mimo prohlížeč (curl s tokenovou URL je zakázaný). Ověření, které neprojde samo, = zastav a řekni to uživateli.
- Odpověď 403, 429 nebo 503 = hned přestaň, `python3 -I tools/slusne.py zablokuj <web> "důvod"`, řekni to uživateli.
- Placené služby (MyHeritage, Ancestry, Geni) nikdy hromadně; čti jen to, co uživatel otevře.

## Pomocníci
Na velké kolo (5 svazků, sčítání 1857–1921, vlna příběhů) můžeš pustit pomocníky na levnějším modelu. Pravidla, brief
a ověřování jsou ve skillu **`paralelni-badani`** – načti ho dřív, než prvního pustíš. Minimum: každý pomocník má vlastní
token (`npm run token -- pom-<úkol> agent`), zapisuje přes API se `review: ke_kontrole`; jeho čtení ověř sám na snímku
(`tools/overit.py`) a teprve pak `rdb.py zaznam uprav <klíč> --review overeno` a jistota `doc`. Před velkým kolem si nech
plán schválit (kredity).

## Zajímavosti a příběhy
Podrobně `reference/pribehy.md` (rod), `reference-dum/pribehy.md` (dům), texty pro web `reference-dum/texty.md`.
- **Zajímavosti** sbírej průběžně (vodítko `--druh napad` nebo rovnou příběh druhu `zajimavosti`) a říkej je uživateli.
  Po kole `python3 -I tools/napady.py` (svatby krátce před porodem, rod v jednom domě, sňatky příbuzných, dlouhověkost,
  epidemie).
- **Příběh rodu** nabídni, když má hlavní rod ~5 doložených generací; **příběh domu** při ~4 doložených držitelích
  nebo ~150 letech historie. Koncept do chatu ke schválení, pak `pracovni/pribeh_<slug>.md` a
  `rdb.py pribeh uloz <slug> pracovni/pribeh_<slug>.md --titulek "…" --perex "…" --druh pribeh_rodu --rod <slug>`
  (dům `--druh pribeh_domu --dum <klíč>`). Text: `rdb.py pribeh ukaz <slug>`.
- Víc příběhů najednou a jejich archivní ověření ve vlnách: skill `paralelni-badani`. Ověření námět často vyvrátí –
  na web jde jen ověřená verze.

## Web
Podrobně `reference/web.md`. Rodinný web je Next.js aplikace v `aplikace/` a **čte databázi přímo** – po změně dat
nic neexportuješ ani nepřegenerováváš (Astro `web/` a `export_web.py` jsou zastaralé, `tools/archiv/`).
1. Lokálně `cd aplikace && npm run dev` → http://localhost:3000; testy `npm test`.
2. Nastavení webu (název, úvod, kontakt, výchozí kořen): `rdb.py api GET nastaveni`, změna
   `rdb.py api PUT nastaveni/<klíč> '{"value": …}'` (admin token). Účty členů rodiny zakládá správce v aplikaci.
3. Po větším kole zkontroluj úvodní texty a příběhy (zastarávají: „nejstarší předek je…“).
4. Před zveřejněním projdi s uživatelem `reference/soukromi.md` a `reference-dum/soukromi.md` (žijící lidé, dnešní
   majitelé, obyvatelé narození v posledních 100 letech).
5. Nasazení (Vercel + Neon) **jen s výslovným souhlasem**.

## Poznámky pro správce skillu
Průběžně zapisuj do `poznamky_pro_skill.md` (kořen projektu): chyby nástrojů (příkaz, co se stalo, jak jsi to obešel),
nové archivy a postupy, kde návod mlčel, co chybí v API. Obecně, bez údajů o rodině. Ve vhodnou chvíli (po zveřejnění
webu, na konci velkého kola) nabídni uživateli, že poznámky po očištění vypíšeš jako blok k odeslání správci tohoto
pluginu (issue v repozitáři pluginu). **Nic sám neposílej.** Týká-li se poznámka nástroje převzatého z původních skillů
`rodokmen` / `dejiny-domu`, zmiň, že může zajímat i jejich autora.

## Co nikdy
- Neobcházej ochranu portálů (ALTCHA, CAPTCHA, přihlášení), nezadávej hesla a platební údaje, nic nekupuj.
- Nepiš smyčky dotazů na archiv (viz Šetrnost).
- Nedávej na web podrobnosti o žijících lidech a dnešních majitelích bez souhlasu; u žijících ukládej jen jméno a rok narození.
- Neupravuj data jinak než přes API (`rdb.py`); nemaž osoby, zápisy ani místa bez souhlasu uživatele (mazání = admin).
- Nespouštěj proti produkční DB `db:reset` ani jiné hromadné operace; produkční token nedávej do souborů v gitu.

## Mapa projektu
| Cesta | K čemu |
|---|---|
| `aplikace/` | rodinný web a API (Next.js); `src/server/api.ts` = seznam cest API, `src/server/vstupy.ts` = tvar vstupů |
| `.env` | `RODOKMEN_API_URL`, `RODOKMEN_API_TOKEN` (není v gitu; vzor `.env.example`) |
| `tools/` | `rdb.py` (CLI nad API), `rdb_klient.py` (knihovna), stahovače a pomocné nástroje |
| `tools/archiv/` | nástroje starého souborového formátu – jen pro jednorázový import starých dat |
| `dokumenty/` | originály od rodiny |
| `pracovni/` | pracovní soubory: snímky, JSON nálezů, `vyrezy/`, náhledy rámečků, koncepty příběhů (není v gitu) |
| `data/`, `web/`, `vyrezy/`, `zdroje/` | starý souborový formát – čeká na import do DB, nepoužívat pro nová data |

## Příkazy `rdb.py` (z kořene projektu `python3 -I tools/rdb.py …`, nápověda `-h`, surová data `--json`)
| Oblast | Akce |
|---|---|
| `osoba` | `ukaz <id>`, `hledej <text>`, `seznam`, `pridej [-j json] --sex --jmeno --prijmeni --narozeni --jistota …`, `uprav <id> …`, `jmeno <id> --druh po_snatku …`, `bocni <id>`, `smaz` |
| `vztah` | `pridej rodic\|manzele <a> <b> --jistota --zaznam`, `uprav <id>`, `smaz <id>` |
| `udalost` | `pridej <typ> <osoba> --datum --misto --dum --text --jistota --zaznam --dalsi osoba:role`, `uprav <id> … --jistota`, `smaz` |
| `bydliste`, `citace` | `pridej …`, `smaz <id>` |
| `zaznam` | `ukaz <klíč>`, `hledej [text] --svazek --review --osoba`, `pridej <klíč> <json>` (celý zápis), `uprav <klíč> --review --titulek --prepis soubor …` |
| `svazek` | `ukaz`, `seznam`, `pridej <klíč> --archiv --nazev …` |
| `nalez <json\|->` | celý nález v jedné transakci |
| `vyrez nahraj <klíč> <soubor> [--plny]`, `zvyrazneni <klíč> <json>` | obrázek výřezu, rámečky (běžně `vyrez.py`, `ramecek.py`) |
| `misto` | `hledej`, `seznam`, `ukaz`, `pridej <slug> --nazev --lat --lon --dotaz --vzor --hypoteza`, `nazev <slug> <název> --jazyk`, `udalost` |
| `dum` | `ukaz`, `seznam`, `pridej <json> [--klic]` |
| `prijmeni` | `hledej [text]`, `pridej <příjmení> <varianta>` |
| `voditko` | `seznam [--otevrena] [--osoba] [--rod <slug>\|bez]` (bez `--rod` po rodech), `ukaz`, `pridej <text> --druh --osoba --od-osoby --kanal`, `uprav <id> --text --osoba`, `stav <id> <stav> --poznamka --zaznam` (stav `rozdeleno` = rozsekáno) |
| `denik` | `posledni [N] [--rod] [--vetev <kořen> [--prarodic 4–7]]`, `hledej [text] --osoba --rod --vetev --prarodic --svazek --vysledek` (osoby u záznamu vždy – podle nich se řadí k rodu a větvi), `pridej <titulek> --vysledek --svazek --snimky --osoba --text`, `uprav <id> --osoba --zaznam --titulek --text` |
| `ukol` | `seznam [--vse] [--rod <slug>\|bez]` (bez `--rod` po rodech), `pridej <titulek> --text --druh --priorita --osoba` (osoby vždy – podle nich se úkol řadí k rodu), `stav <id> <stav>`, `uprav` |
| `rod` | `seznam [--pro <osoba>]` (rody s počty vodítek a úkolů), `ukaz <slug>` (členové), `pridej <slug> --nazev --popis --barva --zakladatel` (jen pojmenování) |
| `pribeh` | `seznam`, `ukaz <slug>`, `uloz <slug> <soubor.md> --titulek --perex --druh --rod --dum` |
| `hypoteza`, `otazka` | `seznam`, `pridej …`, `uprav …` |
| `kekule [kořen]`, `pribuznost <od> <k>`, `predci <id>` | graf |
| `kontrola`, `hledat <text>`, `ja` | kontrola dat, hledání ve všem, kdo jsem |
| `api <METODA> <cesta> [json]` | obecné volání libovolné cesty `/api/v1/…` (`--binarni soubor` pro PUT obrázku) |

## Ostatní nástroje (`tools/`, z kořene projektu `python3 -I tools/<nástroj>`)
| Nástroj | Co dělá |
|---|---|
| `vyrez.py`, `ramecek.py`, `overit.py` | výřez (vytvoří a nahraje), rámeček čteného místa (uloží přes API), ověření čtení na dvou polovinách |
| `vylepsi_snimek.py` | špatně čitelný snímek → varianty vedle sebe (kontrast, CLAHE, odečtené pozadí, kanál) |
| `domy_rodiny.py`, `napady.py`, `fan_chart.py` | fronta domů rodiny; náměty na zajímavosti; vějíř předků k tisku (`pracovni/vejir/`) |
| `aron_search.py`, `aron_img.py` | ARON (SOA Zámrsk): matriky, sčítání, gruntovní knihy |
| `trebon.py` | SOA Třeboň: matriky, rejstříky, sčítání, strom fondů (gruntovní knihy, urbáře) |
| `portafontium.py`, `ebadatelna.py` | SOA Plzeň; SOA Praha (matriky i archiválie `a-…`) |
| `mza.py` | MZA Brno (Acta Publica) – detail knihy bývá za ALTCHA → `matriky-v-prohlizeci` |
| `scitani_mza.py` | sčítací operáty MZA (Morava) přes Deepzoom dlaždice |
| `ahmp_search.sh`, `ahmp_scan.py`, `policie_prihlasky.py` | Praha: matriky, policejní přihlášky |
| `soal_zoomify.py`, `matricula_*.sh` | SOA Litoměřice, ZA Opava, Matricula |
| `cuzk_archiv.py listy / rastry / export / mapa` | Archiv ČÚZK: stabilní a pozemkový katastr, indikační skici (Čechy) |
| `ipr_praha.py`, `dnnt.py` | Praha: staré plány a letecké snímky (`--zapsat` = mapy přes API); tisk 20. století (DNNT) |
| `anno.py`, `anno_snap.py`, `kramerius.py` | noviny a knihy (ANNO, Kramerius – Hosák–Šrámek, vlastivědy) |
| `ged_import.py`, `ftb_export.py` | GEDCOM a záloha MyHeritage → předci, fronta zápisů, JSON nálezu (`--osoby`) |
| `mista.py`, `mista_domy.py ruian / okoli / hledej / pridej` | místa v DB + geokódování (OSM); dům v RÚIAN (obec, parcela, k. ú., poloha) |
| `slusne.py`, `hlidac.py`, `zdravi.py` | společný limit k archivům, hook proti obcházení, test nástrojů proti portálům |
| `test_rdb.py [--zapis]` | smoke test `rdb.py` proti API (`--zapis` jen lokálně) |
