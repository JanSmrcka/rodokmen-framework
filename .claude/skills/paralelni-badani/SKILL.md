---
name: paralelni-badani
description: Orchestrace víc pomocníků (subagentů) při bádání v archivech pro rodokmen a dějiny domů – fronta úkolů v databázi, levnější model pro pomocníky, každý s vlastním API tokenem a zápisy „ke kontrole“, deník bez kolizí (id přiděluje DB), šablona briefu (doloženo vs. hypotéza, limity portálů), ověřovací vlna, hledání příběhů ve vlnách a hledání skrytých vazeb z hotových přepisů (kmotři, svědci, sousedé). Použij, když chce uživatel „velké kolo“, pustit víc agentů najednou, projít víc svazků nebo rodů souběžně, autonomní noční bádání, najít příběhy pro web nebo skryté příbuzenské vazby. Spouštěcí fráze: „pusť pomocníky“, „paralelně“, „velké kolo“, „projdi všechny“, „najdi příběhy“, „kdo byl kmotr“, „skryté vazby“.
---

# Paralelní bádání s pomocníky

Pomocníci zrychlí velké kolo, ale bez pravidel tlučou do stejného archivu a jejich nejistá čtení se dostanou do dat
jako fakta. Tenhle skill to drží v pořádku. Patří ke skillu `rodokmen-plus` (data jsou v databázi za API, zápis jen
přes `python3 -I tools/rdb.py …`).

Před velkým kolem řekni uživateli, co plánuješ (kolik pomocníků, na co, odhad času) a nech si to schválit. Pomocníci
stojí kredity.

## Role
- **Koordinátor (ty, hlavní model)**: fronta úkolů, briefy, tokeny, ověření čtení na snímku, převod na `doc`
  a `overeno`, komunikace s uživatelem.
- **Pomocník** (Agent s levnějším modelem, např. `model: "sonnet"`): hledání a první čtení. Zapisuje přes API **s vlastním
  tokenem** a vše jako `review: ke_kontrole` – nebo vůbec (varianta „jen pracovni“ – viz níže). Nikdy nemaže,
  nenasazuje, neposílá ven, nemění cizí zápisy a nepřevádí nic na `overeno`.
  Uživateli vysvětli: pomocník nečte hůř, je to princip čtyř očí – nemá kontext (dvě rodiny téhož jména ve vsi).

## Tokeny
- Každý pomocník dostane **vlastní token s rolí `agent`**: `cd aplikace && npm run token -- pom-<úkol> agent`
  (stejný název = nový token, starý přestane platit). Token dej pomocníkovi v briefu jako proměnnou prostředí
  `RODOKMEN_API_TOKEN=<token>` před příkazy (proměnné prostředí mají přednost před `.env`) – **nezapisuj ho do souborů
  v gitu**. V auditu a v deníku je pak vidět, kdo co zapsal (`createdBy: token:pom-<úkol>`).
- Po kole token zneplatni (vydej nový pod stejným názvem a zahoď ho).

## Fronta úkolů – v databázi
- Úkoly: `rdb.py ukol seznam [--rod <slug>]` / `ukol pridej "<otázka a kde hledat>" --text "…" --druh badani --priorita 1 --osoba <id>`.
  **Osoby u úkolu vždy** – podle nich se úkol řadí k rodu (`rdb.py rod seznam` ukáže počty po rodech; `--rod bez` =
  úkoly bez osob, doplň je `ukol uprav <id> --osoba …`).
  Stav `otevreny` → `rozpracovany` (pomocník při převzetí) → `hotovy` | `ceka` (zaseknuto, důvod v těle) | `zruseny`
  (slepá ulička – důvod nech v textu, ať se nezkouší znovu). Co je jen v archivu: `--druh archiv`.
- Bod fronty = jedna otázka + kde hledat: „křest Jana Nováka ~1820, N Horní Lhota sv. 3, nejdřív index N“.
  **U každého bodu ověř druh knihy** (matrika × rejstřík, N/O/Z, roky) – fronta zapsaná podle katalogu se plete
  (rejstřík zapsaný jako matrika pošle pomocníka listovat nesprávnou knihu).
- Pomocník na konci nastaví stav svého úkolu a nové stopy přidá jako nové úkoly nebo vodítka (`voditko pridej --druh napad
  --osoba <id>` – jedno tvrzení = jedno vodítko, osoby z jednoho rodu).

## Rozdělení práce
- **Rod nebo větev jako rozsah briefu**: pomocník dostane jeden rod (`--rod <slug>`) nebo větev prarodiče
  (`--vetev <kořen> --prarodic <4–7>`) a jeho vodítka/úkoly
  (`voditko seznam --otevrena --rod …`, `ukol seznam --rod …`, `denik posledni 30 --rod …`), ne celý projekt.
- **Po portálech, ne po osobách.** Pomocníci na stejném portálu sdílí jeho limit – tři pomocníci na jednom archivu
  nejsou rychlejší než jeden. Pro portály za ověřením v prohlížeči nejvýš 2 současně (`matriky-v-prohlizeci`).
- Limit rychlosti nástrojů (`tools/slusne.py`) je společný všem pomocníkům na stejném webu; DigiArchiv Třeboň v prohlížeči
  (≥ 20–30 s mezi snímky) a ndk.cz (jen pár dotazů za sezení, ban IP) jsou přísnější – takový portál jen jednomu pomocníkovi.
- Offline úkoly (čtení už stažených snímků, analýza přepisů) jdou souběžně bez limitu.
- Rozsah jednoho briefu ~1–2 h práce. Typicky 3–4 pomocníci najednou.
- Pomocníci pracují ve stejném pracovním adresáři, ale každý jen ve své `pracovni/pom_<úkol>/` (snímky, JSON nálezů,
  screenshoty). Git větve a integrace kvůli datům **nejsou potřeba** – zápisy jdou do DB transakčně a nekolidují.

## Kolize a duplicity
- **Deník**: id přiděluje databáze – žádné předem přidělené řádky. Každý pomocník píše `rdb.py denik pridej` sám.
- **Id nových osob**: před založením `rdb.py osoba hledej`; když dva pomocníci založí tutéž osobu, druhý dostane chybu
  „už existuje“ (stejné id) nebo vznikne duplicita pod jiným id – koordinátor ji při ověření sloučí
  (`rdb.py osoba uprav <dup> --tataz <hlavní>` nebo smazání duplicity adminem).
- **Zápisy**: klíč zápisu je jednoznačný; stejný zápis pod dvěma klíči odhalí `rdb.py zaznam hledej --svazek <klíč>`
  (stejný svazek a snímek).
- Po kole: `rdb.py kontrola` (chyby grafu + seznam zápisů ke kontrole).

## Šablona briefu
Brief je jediný kontext, který pomocník má. Vlož do něj:
```
Úkol: <otázka>, úkol #<id> (rdb.py ukol stav <id> rozpracovany na začátku).  Rozsah: ~1–2 h.
Projekt: <cesta>. Pracovní složka: pracovni/pom_<úkol>/.
Přístup k datům: jen přes python3 -I tools/rdb.py …, každý příkaz s RODOKMEN_API_TOKEN=<token> na začátku.
Přečti: CLAUDE.md; rdb.py denik hledej "<obec / svazek / příjmení>"; rdb.py osoba ukaz <id> u dotčených osob.
Skilly: rodokmen-plus (zápis nálezu, JSON nálezu, datový model), matriky-v-prohlizeci (je-li portál za ověřením), ztotozneni-mist.
Kde hledat: <portál, kniha, snímky / index nejdřív>. Co už víme: <fakta s klíči zápisů>. Co je vyloučené: <…>.

Pravidla:
- Všechny tvé zápisy mají "review": "ke_kontrole". doc dáváš jen tomu, co sám přečteš na snímku; ověří to koordinátor.
  Neověřené a vše, co z něj plyne, označ prob/fam a „(?)“; hypotézy rdb.py hypoteza pridej.
  Index (rejstřík, FamilySearch) = jen hypotéza do ověření ve zdroji.
- Nejisté čtení není negativní výsledek – zapiš ho jako nejisté. Neúspěšné hledání zapiš do deníku s rozsahem:
  rdb.py denik pridej "…" --vysledek nenalezeno --svazek <klíč> --snimky "…".
- U každého prošlého snímku poznamenej (deník, text), co na něm skutečně je (rok, první jméno, čp.).
- Ke každému nálezu: rdb.py nalez pracovni/pom_<úkol>/nalez_<klíč>.json (zápis s přepisem + překladem i s kmotry
  a svědky v persons, osoby a vztahy podle datového modelu, bydliště s čp.), pak vyrez.py a ramecek.py (rámeček
  jen kolem zápisu).
- Nikdy: rdb.py … smaz, zaznam uprav --review overeno, úpravy cizích osob kromě přidání vztahu/události se zdrojem.
- Limit <portál>: 1 snímek / <N> s. Čekej: python3 -c "import time; time.sleep(<N>)". Kratší mezery nejsou OK.
- ZAKÁZÁNO: smyčky fetch/XHR/curl, hromadné načítání stránek (ani HTML), obcházení ALTCHA/CAPTCHA, stahování snímků
  mimo prohlížeč z portálu za ověřením. 403/429/503 nebo ověření, které neprojde → přestaň a napiš to v reportu.
- Prohlížeč: vlastní nová záložka, tabId si pamatuj, před každým snímkem ověř URL, cizí záložky nech, svou zavři.
- Na konci: rdb.py kontrola bez nových chyb; rdb.py ukol stav <id> hotovy|ceka; nové stopy jako úkoly/vodítka.
Report: klíče zápisů (doloženo × pravděpodobné), nové osoby, počet snímků, id záznamů deníku, otevřené otázky, nové stopy.
```
Doplň technické pasti prostředí (macOS zsh; Windows `python -I -X utf8`, `magick`) z `reference/matriky.md`.

Varianta **„jen pracovni“** pro méně zkušené prostředí nebo citlivá data: pomocník nemá token a do DB nepíše vůbec,
výsledky dává do `pracovni/pom_<úkol>/nalez_*.json` (JSON nálezu) a `vysledky.md` (snímky, souřadnice zápisu, co
prošel) a zapisuje koordinátor po ověření.

## Ověřovací vlna
Žádné čtení pomocníka nezůstane jako `doc` bez ověření koordinátorem:
1. `rdb.py kontrola` vypíše zápisy `ke_kontrole`; `rdb.py zaznam ukaz <klíč>` ukáže přepis, osoby v rolích, výřez a rámeček.
   Otevři výřez (`pracovni/vyrezy/<klíč>.jpg`, případně `tools/overit.py <snímek> x0,y0,x1,y1 pracovni/over`) a přečti
   jména, data a čísla domů sám.
2. Zkontroluj rámeček (jen kolem zápisu), správnost svazku a snímku, a že ztotožnění osoby není jen shoda jména.
3. Sedí → `rdb.py zaznam uprav <klíč> --review overeno` a teprve teď jistota `doc` u osob, vztahů a událostí
   (`rdb.py osoba uprav <id> --jistota doc`, `rdb.py vztah uprav <id> --jistota doc`, `rdb.py udalost uprav <id> --jistota doc`).
   Nesedí → sniž na `prob` s poznámkou, oprav zápis, nebo vrať pomocníkovi (nový brief s přesným snímkem).
4. Do deníku zapiš ověření: `rdb.py denik pridej "Ověření kola <datum>" --zaznam <klíč> … --text "ověřeno koordinátorem"`.

## Hledání příběhů ve vlnách
Pro web (příběh rodu, domu, zajímavosti):
1. **Vlna námětů** – 4–5 pomocníků offline nad daty (jen čtení přes `rdb.py`), každý jinak: podle rodů, podle domů,
   podle témat (války, epidemie, řemesla, migrace, nemanželské děti, dlouhověkost, sňatky příbuzných). Výstup: náměty
   s klíči zápisů, co je doložené a co by bylo potřeba ověřit. Pomůže `tools/napady.py`.
2. **Vlna archivního ověření** – na nejlepší náměty pusť pomocníky do pramenů (úmrtí, noviny, sčítání).
   **Ověření původní námět často vyvrátí** – „voják z Itálie“ je jmenovec, „vyhořelý statek“ je jiné čp.
   Na web jde jen ověřená verze, vyvrácené náměty zapiš do deníku (`--vysledek nenalezeno`), ať se nevracejí.
3. Koncept příběhu dej uživateli ke schválení (viz `rodokmen-plus` → Zajímavosti a příběhy), uložení `rdb.py pribeh uloz`.

## Skryté vazby z přepisů
Hotové zápisy obsahují kmotry, svědky, porodní báby a sousedy (přepisy a osoby v rolích). Porovnané s osobami v grafu
odhalí vazby, které rodina nezná: kmotr = strýc z matčiny strany, svědek = budoucí tchán, soused = příbuzný z jiné větve.
- Jde to **offline a souběžně** (žádný archiv) – vhodný úkol pro pomocníka.
- Postup: `rdb.py zaznam hledej …` + `rdb.py zaznam ukaz <klíč> --json` → jména s rolí, rokem, obcí a čp.
  (`persons`, `transcriptCs`) → porovnej s osobami (`rdb.py osoba hledej`, jména a varianty, bydliště s čp., věk v době
  události z `rdb.py osoba ukaz`) → kandidáti na shodu. `rdb.py pribuznost <id> <id>` ukáže, jak jsou dva lidé příbuzní.
- **Výstup jsou hypotézy** (`rdb.py hypoteza pridej … --osoba <id> --zaznam <klíč>`), ne nové vazby. Kmotra či svědka
  jako existující osobu připoj do zápisu (role v `persons` – `rdb.py zaznam pridej` celý zápis, nebo v nálezu) jen při
  jasném ztotožnění (jméno + bydliště nebo vztah uvedený v zápisu), jinak hypotéza s tím, co by ji ověřilo.
- Ztotožnění kontroluj věkem: kmotr či svědek v době události žil a byl dospělý (data narození a úmrtí z `osoba ukaz`).

## Po kole
- Shrň uživateli: kolik nových osob, domů a zápisů, co je doložené a co jen pravděpodobné, kolik snímků, co se vyvrátilo,
  2–4 další stopy. Aktualizuj úkoly (`rdb.py ukol …`).
- Výstupy pomocníků v `pracovni/` nemaž, dokud nejsou vytěžené. Tokeny pomocníků zneplatni.
- Poznatky o nástrojích, portálech a API zapiš do `poznamky_pro_skill.md`.
