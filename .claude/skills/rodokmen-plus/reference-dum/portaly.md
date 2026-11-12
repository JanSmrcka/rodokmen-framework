# Portály archivů a jak z nich dostat snímky

Matriky jsou online u osmi státních archivů – podle toho, **kde dům stojí** (u lidí odjinud: kde žili; dnešní kraje zhruba odpovídají):

| Archiv | Oblast | Portál s matrikami | Vyzkoušeno se skillem |
|---|---|---|---|
| SOA Zámrsk | východní Čechy (Hradecký a Pardubický kraj) | ARON – aron.vychodoceskearchivy.cz | **ano – hotové nástroje** |
| SOA Praha | střední Čechy | eBadatelna – ebadatelna.soapraha.cz | **ano – nástroj `ebadatelna.py`** (i urbáře a gruntovní knihy) |
| SOA Plzeň | západní Čechy | Porta fontium – portafontium.eu | **ano – nástroj `portafontium.py`** |
| SOA Třeboň | jižní Čechy | digi.ceskearchivy.cz | **ano – nástroj `trebon.py`** |
| SOA Litoměřice | severní Čechy | Digitální badatelna – digi.soalitomerice.cz | **částečně – `soal_zoomify.py`** (knihu najdi v prohlížeči) |
| AHMP | hl. m. Praha | katalog.ahmp.cz (Pragapublica) | **ano – `ahmp_search.sh`, `ahmp_scan.py`** |
| MZA Brno | jižní Morava, Vysočina z části | Acta Publica – www.mza.cz/actapublica | **ano – nástroj `mza.py`** |
| ZA Opava | severní Morava a Slezsko, Olomoucko a Litovelsko | Digitální badatelna – digi.archives.cz/da/ | **částečně – `soal_zoomify.py`** (jen s prohlížečem, CAPTCHU řeší uživatel) |
| Národní archiv | židovské matriky (HBMa), soupisy; pražské policejní přihlášky 1850–1914 | badatelna.eu; digi.nacr.cz/prihlasky2 | přihlášky **ano – `policie_prihlasky.py`** |

Pro **20. století** (městské domy, adresáře, stavební povolení) jsou hlavní **IPR Praha** (staré plány a letecké snímky
Prahy) a **DNNT na ndk.cz** (neveřejný tisk čitelný po přihlášení) – sekce níže.

**Nástroj dostane HTTP 403, ale v Chromu uživatele portál jde?** Blokovaný je nástroj (User-Agent, ochrana proti
robotům), ne IP – VPN nepomůže a další pokusy nástrojem taky ne. Přejdi do prohlížeče (skill `matriky-v-prohlizeci`).
Vyzkoušeno u eBadatelny, digi.ceskearchivy.cz (Třeboň) i Porta fontium.

**Nástroj selže nebo vrátí nesmysl?** Nejdřív `python3 -I tools/zdravi.py --jen <portál>`: zkusí pevný známý svazek. Selže-li i ten, změnil se portál (nebo má výpadek) – nehledej chybu v datech, zapiš to do `poznamky_pro_skill.md`.
Adresy u nevyzkoušených portálů ověř při prvním použití (portály se mění). Pro pohraničí a mimo ČR viz `playbook.md` §2
(Matricula pro Rakousko/Německo, Geneteka pro Polsko, FamilySearch pro Slovensko) a níže.

## ARON (SOA Zámrsk) – hotové nástroje
- **Hledání svazků:** `python3 -I tools/aron_search.py "Holice"` → řádky `apu_id | signatura, roky | druh, obce`.
  Popis obsahuje druh knihy (NAROZENÝCH / ODDANÝCH / ZEMŘELÝCH, index) a všechny obce farnosti.
- **Informace o svazku:** `python3 -I tools/aron_img.py <apu_id> info` → název a počet snímků.
- **Stažení snímku:** `python3 -I tools/aron_img.py <apu_id> <snímek> 1 pracovni/holice_n_57.jpg`
  (úroveň 1 = poloviční rozlišení – stačí na orientaci; 0 = plné rozlišení – na čtení a výřez).
  Jen část stránky v plném rozlišení: `… <snímek> 0 pracovni/detail.jpg 0.0,0.4,1.0,0.7`.
- **Odkaz na snímek** (pole `url` zápisu): `python3 -I tools/aron_img.py <apu_id> link <snímek>`.
- **Svazek do dat:** `python3 -I tools/aron_img.py <apu_id> svazek` (klíč = prvních 8 znaků apu_id → pole `svazek` v zápisu).
- V ARON jsou i další fondy (sčítání lidu, některé gruntovní knihy, kroniky) – `aron_search.py "Obec" "název fondu"`.
- Stejnojmenných obcí bývá víc (Vinice u Hořic × Vinice u Velké Jesenice). Výsledky jsou seřazené podle farnosti;
  zúžit jde víc slovy oddělenými čárkou, která musí být v popisu všechna: `aron_search.py "Vinice,Hořice"`
  (nebo hledej sousední obec či farní obec).
- U starých far hledej nejdřív **souhrnné indexy** (popis „index NAROZENÝCH…“ přes mnoho let), často sahají do 17. století.
- Obec nenalezena? Zkus název **bez přívlastku** („Lhota“ místo „Horní Lhota“) a starý název. Starší matriky
  (před ~1784) bývají ve faře sousedního města; indexy fary mají oddíly po vesnicích
  („Copulati Gross Lhota“).
- Rejstříky uvnitř knih N/O někdy končí ~1890 – mladší léta jen listováním (~6 snímků na rok). Knihy pro víc obcí
  bývají řazené po obcích (oddíly) – nejdřív najdi oddíl obce, pak rok.
- **Sčítání 1921** (fond Okresní úřad): názvy souborů snímků obsahují číslo domu (`…-cp-001.jpg`) – dům najdeš bez listování.
- Ber ohled na server: stahuj jen to, co čteš; žádné hromadné stahování celých svazků. Limit rychlosti hlídá
  `tools/slusne.py` (SKILL.md → Co nikdy).

## SOA Třeboň (digi.ceskearchivy.cz) – `tools/trebon.py`, bez prohlížeče
- `trebon.py misto "Obec"` → id místa. Diakritiku a mezery nástroj odstraní sám (portál zná jen „RatiborskeHory“).
  Portál vrátí vždy jen jedno místo – **zkontroluj vypsaný název a okres**: u stejnojmenných obcí jinou (Buk → Bukovka),
  u měst i okres nebo synagogu (Jindřichův Hradec → okres 1949–1960). Správné id pak najdi na portálu a pracuj s ním.
  Malé osady portál jako místo nezná vůbec (Malá Chyška) – hledej farní nebo sousední obec (Chyšky) a osadu v popisu knih.
  Občasná chyba 500 bývá výpadek portálu – nástroj zkouší znovu; když trvá, zkus to později.
- `trebon.py svazky <id|"Obec">` → knihy místa (id knihy, druh, roky, obce).
- `trebon.py rejstrik <id_knihy> <písmeno>` → **dobrovolnický jmenný rejstřík** knihy se snímkem, obrovská úspora.
  Ne každá kniha ho má; prázdný výsledek = rejstřík chybí, ne „osoba tam není“.
- `trebon.py snimek <id_knihy> <snímek> pracovni/x.jpg [nahled]`, `trebon.py svazek <id_knihy>` (svazek do databáze přes API).
- Trvalý odkaz: `https://digi.ceskearchivy.cz/<id_knihy>/<snímek>`.
- Nástroj vrací HTTP 403 (i dlouhodobě), Chrome jde → čti v prohlížeči (`matriky-v-prohlizeci` → DigiArchiv; přísný
  limit rychlosti, jmenný rejstřík celého archivu, e-rejstřík knihy).
- **Fara obce:** stránka fary na portálu (Průzkumník → Matriky → sídlo) má pole „Farní obvod (1862)“ se seznamem obcí –
  ověř tam, nehádej podle sousedních vsí.
- Obce Jihlavska, které historicky ležely v Čechách, mají matriky v **MZA Brno** (Acta Publica), ne v Třeboni.
- Některé fary mají knihy po vesnicích, které nejsou v seznamu svazků místa (Vacov → Žár) – hledej podle titulků knih fary.
- **Civilní matriky (1920–1945) lidí bez vyznání** jsou v knihách okresních úřadů (např. Tábor, kniha 12304) a mají
  dobrovolnický rejstřík (`trebon.py rejstrik 12304 N`). Dobrá cesta, když farní matrika mlčí. V `svazky "Obec"`
  se neukážou (patří okresu, ne obci) – id knihy najdi na portálu.

## SOA Plzeň (Porta fontium, portafontium.eu) – `tools/portafontium.py`, bez prohlížeče
- `portafontium.py fara <fara>` → knihy fary: kniha | obce | roky a druhy (`*` N, `oo` O, `+` Z, `i` index) | popis.
  `<fara>` je název římskokatolické fary („Dolní Bělá“, „Mýto“ – diakritiku nástroj odstraní) nebo přímo část
  její adresy (`dolni-bela` =
  `…/contents/register/soap-pn/cirkev-rimskokatolicka/dolni-bela`). Obec → faru nástroj nehledá: faru zjisti ve vyhledávání
  matrik na portálu (pole Místo, v prohlížeči) nebo v popisech knih okolních far. Bez prohlížeče: stránka
  `https://www.portafontium.eu/searching/register?search_api_views_fulltext_1=<obec>` vypíše odkazy
  `/register/soap-pn/<kniha>` – `<kniha>` (např. `kdyne-29`) rovnou použij v `portafontium.py info`.
- `portafontium.py info <kniha>` (`dolni-bela-17`) → signatura, druh, text desky a **obsah** – u knih psaných po vesnicích
  vypíše, na kterých foliích je která obec („Ves X z let 1862–1901 = fol. 121–200“).
- `portafontium.py snimek <kniha> <snímek> pracovni/x.jpg [nahled] [x0,y0,x1,y1]` → celá stránka v plném rozlišení jedním
  požadavkem (IIIF), `nahled` = 1/4. Číslo snímku = pořadí náhledu v prohlížeči; soubory nesou číslo folia
  (`dolni-bela-17_0951` = fol. 95), takže u knih se souvislou foliací je **snímek ≈ folio**.
- `link <kniha> <snímek>` → trvalý odkaz, `svazek <kniha>` → svazek do databáze přes API (klíč `pf_<kniha>`).
- Bez prohlížečového User-Agentu portál vrací 403 (nástroj ho posílá). Jmenné hledání portál nemá – indexy jsou jen uvnitř knih
  (`*i`, `ooi`, `+i` v seznamu knih fary).
- Fulltextové hledání (`searching/register?…`) blokuje přísněji než snímky: po ~150 snímcích za sezení vrátilo hned 403
  → blokace 30 min. Hledej málo a dřív, než začneš stahovat.

## SOA Praha (eBadatelna, ebadatelna.soapraha.cz) – `tools/ebadatelna.py`, bez prohlížeče
- `ebadatelna.py hledat "Obec"` → celé názvy lokalit („Lhota - obec X - okres Y“); `matriky "Obec"` (nebo celý název)
  → matrikaId | kniha | druh | roky | fara | počet snímků. U stejnojmenných obcí vypíše možnosti.
- `ebadatelna.py info <matrikaId>` → obsah knihy včetně **rozvržení stran po vesnicích** (např. „1–48 Ves A, 49–82 Ves B,
  1–30 Ves C …“ – každá ves může mít vlastní stránkování) – u takových knih neodhaduj snímek podle roku, ale podle stran
  dané vsi (číslo strany je nahoře na snímku). Takové knihy bývají řazené po vsích, ne chronologicky – je-li rejstřík,
  začni jím. Rejstřík bývá **na konci knihy** (písmena po 1–2 snímcích).
- `ebadatelna.py snimek <matrikaId> <snímek> pracovni/x.jpg [nahled] [x0,y0,x1,y1]`; `link`, `svazek` (klíč `ebad_<id>`).
- **Archiválie** (urbáře, gruntovní a pozemkové knihy velkostatků – most přes 17. století): `a-info <archivalieId>`,
  `a-snimek`, `a-link`, `a-svazek` (klíč `ebad_a_<id>`). Archiválii nástroj nehledá – najdi ji na portálu v prohlížeči;
  id je v adrese `…/pages/ArchivaliePage/archivalieId/<id>`.
- Starší snímky bývají z mikrofilmu nebo silně vybledlé – čti se zvýšeným kontrastem:
  `magick x.jpg -colorspace Gray -contrast-stretch 2%x30% x_k.jpg` (výřez pak dělej z kontrastní verze a poznamenej to v přepisu).
- Portál dává vždy celý snímek (nedlaždicuje); náhled a výřez dělá nástroj po stažení přes ImageMagick (`magick`).
  Denní údržba kolem 4:44 (asi 2 minuty).
- `ebadatelna.py` dostal HTTP 403, ale portál v Chromu šel (seznam knih, snímky `/d/<id>/<n>`) → pokračuj v prohlížeči.

## AHMP Praha – `tools/ahmp_search.sh`, `tools/ahmp_scan.py`
- `bash tools/ahmp_search.sh "Smíchov"` → svazky Sbírky matrik: popis | farnost | (XID, id, počet snímků).
- `python3 -I tools/ahmp_scan.py <XID> <snímek> pracovni/x.jpg [1] [x0,y0,x1,y1]` → snímek (1 = poloviční rozlišení).
- Trvalý odkaz `https://katalog.ahmp.cz/pragapublica/permalink?xid=<XID>&scan=<N>`.
- Nový portál digi.ahmp.cz má ochranu proti robotům – nepoužívat. Pražské matriky 1890–1940 většinou **nemají rejstříky**
  a farností je mnoho – bez přesného data a farnosti (z úmrtí/sňatku nebo od rodiny) je hledání velmi drahé.

## SOA Litoměřice (severní Čechy) – `tools/soal_zoomify.py`
- Digitální badatelna digi.soalitomerice.cz má na vstupu automatické ověření (asi 15 s „počítání“) → knihu a snímek
  najdi v prohlížeči. V síťovém provozu pak najdi adresu `…/zoomify/cz/archives/CZ-214000010/matriky/<cesta>/ImageProperties.xml`.
- Snímky stahuj nástrojem: `python3 -I tools/soal_zoomify.py <cesta> 0 pracovni/x.jpg` (0 = plné rozlišení, 1 = poloviční).
  Obrázkový server neomezuje a cookies nepotřebuje.
- **POZOR: po zhruba 100 rychlých požadavcích na stránky aplikace (prohlížení snímků, detail výsledku) archiv zablokuje
  přístup na 30 minut.** V prohlížeči proto jen najdi knihu a cestu k obrázkům, pak už jen nástroj. Pomocníkům to napiš do zadání.

## ZA Opava (severní Morava, Slezsko, Olomoucko, Litovelsko) – `tools/soal_zoomify.py`
- Pozor na hranici: obce na Litovelsku a Olomoucku patří pod **ZA Opava**, ne pod MZA Brno.
- **Bez prohlížeče to nejde.** Badatelna `https://digi.archives.cz/da/` (stará adresa matriky.archives.cz jen přesměruje)
  má ochranu proti robotům – curl ani WebFetch se nedostanou ani na hledání. Potřebuješ připojený prohlížeč (Claude in
  Chrome – uživatel ho připojí příkazem `/chrome` – nebo Playwright); jinak ať knihu najde a snímky uloží uživatel.
  Úvodní ověření projde samo, ale hledání často skončí **CAPTCHou: tu vyřeší uživatel** v okně prohlížeče, ty nikdy.
- Hledej obec a vyfiltruj Matriky (ikona, potom znovu lupa). Hledání vrací i civilní matriky (u obce stovky svazků) –
  filtr „Datum od – do“ (podle začátku svazku, např. 1680–1873) nechá jen církevní. Knihy bývají řazené po obcích
  a na konci mají rejstřík. Vedle farních knih bývají i **druhopisy** („T“ v signatuře, viz `matriky.md`).
- **Seznam svazků a ID snímků si hned ulož** do `pracovni/<svazek>/` – relace po pár hodinách vyprší a výsledky
  hledání platí jen v ní. Na detailu svazku: entita `document.querySelector('[entityuuid]').getAttribute('entityuuid')`
  (u svazků uložených v jiném archivu nemá tvar UUID – nehledej ji regexem), ID snímků jsou hodnoty
  `select.getScanSelect option` (tvar „N%20uuid“). Snímek pak otevřeš kdykoli bez hledání:
  `/da/showZoomifySeparate?imageNumberSeparate=N&myEntityUuid=<entita>&myImageUuid=<uuid>`.
- Adresa obrázku: `fetch('/da/showZoomify/<id svazku z URL>/<část option.value za „%20“>')` vrátí HTML s cestou
  `…/images/<složka>/<uuid>.jpg`. Cesta se u svazků liší (`…/CZ-217000010/NAD-165/dao/images/…`, `…/zao/matriky/dao/images/…`)
  a přípona bývá i `.JPG` – nástroji dej vždy **celou adresu z HTML**:
  `python3 -I tools/soal_zoomify.py "<adresa>" 2 pracovni/x.jpg` (2 = čtvrtinové rozlišení na orientaci podle záhlaví
  stránek, 0 = plné jen u nalezeného zápisu). Obrázkový server images.archives.cz neomezuje a cookies nepotřebuje.
- **POZOR na blokování** (jen stránky aplikace, obrázky ne): rychlé dotazy → CAPTCHA, „operace vyhodnoceny jako
  nestandardní“ nebo „Access blocked“ na 30 minut; po desítkách dotazů za den vrací showZoomify „Server Exception“
  (denní limit – pokračuj až další den). Pauza 3–6 s mezi stránkami, dávky do ~80 stránek, žádné rychlé `fetch` hned
  po hledání a stránky výsledků neprocházej za sebou. Delší smyčku pusť v prohlížeči na pozadí, výsledky ukládej do
  `window` nebo `localStorage` a vyzvedávej po částech (nástroj pro JavaScript má limit asi 45 s). Pomocníkům to napiš do zadání.

## MZA Brno (jižní Morava, Acta Publica) – `tools/mza.py`, bez prohlížeče
- `mza.py hledat "Obec"` → obec_id | název s německým názvem a okresem (bez diakritiky i podle začátku názvu).
  Stejnojmenných obcí bývá víc (Pohořelice u Brna × u Zlína) – vyber podle okresu.
- `mza.py matriky <obec_id>` → knihy obce: id | číslo knihy | původce (fara, typ) | roky N | O | Z (`i` = index) | obce | snímků.
  Jsou tam i knihy, které obec jen zmiňují (německé stavovské úřady 1938–45, sousední fary) – podívej se na původce.
- `mza.py info <id>` → kniha, původce, obce a **části knihy se snímky** („oddaní (1673–1716) 201–250“) – podle nich
  skoč rovnou na správný snímek, neodhaduj podle roku.
- `mza.py snimek <id> <snímek> pracovni/x.jpg [nahled] [x0,y0,x1,y1]` → celá stránka v plném rozlišení jedním požadavkem
  (IIIF); `link <id> <snímek>` → trvalý odkaz; `svazek <id>` → svazek do databáze přes API (klíč `mza_<id>`).
- `<id>` je číslo z adresy `…/actapublica/matrika/detail/<id>`, ne číslo knihy (to je ve druhém sloupci).
- Obrázkový server bere jen HTTP/2 – snímky stahuje nástroj přes `curl` (Python sám dostane HTTP 426). Starý curl
  bez HTTP/2 → nainstaluj novější.
- Adresa actapublica.eu bývá za Cloudflare zablokovaná („Sorry, you have been blocked“ – podle IP); nástroj jde na
  www.mza.cz. Když blokuje i ta, ať uživatel vypne VPN nebo zkusí jinou síť.

## Pražské policejní přihlášky 1850–1914 (Národní archiv) – `tools/policie_prihlasky.py`
- Karty pražských rodin: hlava rodiny, manželka s rokem a místem narození, děti s roky, adresy, někdy místo sňatku.
  Výborné, když rodina žila v Praze a nevíš farnost (pražské matriky nemají rejstříky).
- `python3 -I tools/policie_prihlasky.py Kolar [Jan] [1850] [1870]` – příjmení bez diakritiky (začátek jména), jméno a roky
  narození volitelně. Bez prohlížeče vrátí jen prvních 20 výsledků, proto hledej co nejúžeji.
  Kartu stáhni `policie_prihlasky.py karta <pořadí> pracovni/karta.jpg Kolar [Jan] [1850] [1870]` (stejné hledání; jde i pořadí
  nad 20) – vypíše citaci a trvalý odkaz (`index.php?action=link&ref=czarch:CZ-100000010:874&karton=K&folium=F`).
- **Nepokrývá Smíchov, Vinohrady, Žižkov, Karlín a další předměstí před 1922** (byla to samostatná města). Náboženství karty neuvádějí.

## Matricula (Rakousko, Bavorsko, Polsko…; data.matricula-online.eu) – `tools/matricula_*.sh`
- Bez přihlášení. Seznam knih: `…/de/oesterreich/<diecéze>/<farnost>/?page=N`; snímek knihy `…/<id>/?pg=<snímek>`
  (zároveň trvalý odkaz).
- URL obrázku obsahuje `csrf` a `ctrl` počítané JavaScriptem → je potřeba prohlížeč (Playwright / Claude in Chrome):
  otevři knihu, klikni na stránku (`.docview-pagelink`), URL obrázku vezmi z `performance.getEntriesByType('resource')`
  a stáhni `bash tools/matricula_dl.sh "<url>" pracovni/x.jpg`. Víc stránek: soubor řádků „<snímek> <url>“ → `matricula_batch.sh`.
- Rejstřík najdeš bez prohlížeče: HTML stránky knihy má seznam `labels` s popisky snímků („04-Index Taufe_0001“).
- Vojenské matriky (např. Štýrský Hradec) tam nejsou – jsou v Kriegsarchivu ve Vídni (offline).

## Polsko – Geneteka (geneteka.genealodzy.pl)
- Zdarma dobrovolnické indexy křtů, sňatků a úmrtí po farnostech; hledej ve webovém rozhraní (vojvodství → farnost →
  příjmení). Index je vodítko – skeny často online nejsou (farní nebo diecézní archiv), pak zápis žádej tam.
- **Farní příslušnost se měnila**: obec mohla patřit k sousední faře (Lipowa → Radziechowy do 1896) – hledej i tam.
- Nestahuj hromadně: PTG uvádí „linkujemy, nie pobieramy danych“ (odkazujeme, nestahujeme) a po desítkách rychlých dotazů
  server vrací nefiltrovaná data. Dotazy dávkuj, s pauzami, a výsledky si ověř.
- Jednotlivý dotaz jde i bez prohlížeče: `https://geneteka.genealodzy.pl/api/getAct.php?draw=1&start=0&length=10&bdm=B&rid=B&w=12sl&search_lastname=<příjmení>&search_name=&search_lastname2=&search_name2=&from_date=1850&to_date=1900&exac=1`
  (`bdm`/`rid` B křty, S sňatky, D úmrtí; `w` vojvodství, např. 12sl slezské, 08op opolské) → JSON. Past: `recordsTotal` > 0
  a prázdné `data` – zkus jen jedno příjmení bez křestního jména a užší roky. Stránkování opakuje řádky.
- Skeny některých polských far jsou i na Matricule (výše) nebo FamilySearch (níže).

## FamilySearch (přes uživatelův přihlášený prohlížeč)
- Přihlášení je potřeba i na hledání v indexech. České matriky tam skoro zindexované nejsou (Slovensko ano, hlavně křty).
- Jen když ho má uživatel otevřený a sám nabídne. Z kontextu stránky lze volat JSON API
  `https://www.familysearch.org/service/search/hr/v2/personas?q.surname=…&q.givenName=…&q.fatherGivenName=…&count=20`
  (`fetch(…, {credentials:'include'})`); výsledky v `entries[].content.gedcomx`.
- Užitečné na indexy matrik a hroby (BillionGraves, Find a Grave). Výsledek je vodítko – ověř v matrice.
- Neměň uživateli otevřené karty (po hledání vrať původní adresu). Stránky za Cloudflare neobcházej – ať je uživatel
  otevře sám a pošle snímek obrazovky.
- Snímky filmu (DGS): seznam přes `POST /search/filmdatainfo/image-data` s `{"type":"film-data","args":{"dgsNum":"00…","state":{"i":"0"},"locale":"cs"}}`
  (`images[]` = ARK). Snímek: `https://www.familysearch.org/service/records/storage/deepzoomcloud/dz/v1/<ARK 3:1:…>/$dist`
  (plné rozlišení), malé náhledy `…/image_files/8/0_0.jpg`. **Po ~1000 rychlých požadavcích přijde HTTP 429** a blokace
  na desítky minut – stahuj jen konkrétní snímky, nanejvýš pár za sekundu, hromadné procházení knih nedělej.

## Hroby a hřbitovy
- Kde jsou předci pohřbeni, víš z rozhovoru s rodinou (Fáze 1). Fotky náhrobků (jména, data, rodná příjmení) jsou
  cenný pramen hlavně pro 20. století, kde matriky ještě nejsou přístupné.
- Evidence hrobových míst: správa hřbitova (kdo je v hrobě uložen, kdo platí nájem – často žijící potomek);
  řada měst má online vyhledávání hrobů. Mezinárodně BillionGraves a Find a Grave.

## IPR Praha – staré plány a letecké snímky Prahy (gs-pub.praha.eu) – `tools/ipr_praha.py`, bez tokenu
Pro Prahu výrazně lepší než Archiv ČÚZK (jeho spojené vrstvy stabilního katastru Prahu nepokrývají). Vše georeferencované
v S-JTSK (EPSG 5514) → stejný výřez pro celou sérii = prolínání map na webu (mapy se stejnou skupinou `groupName`, `data.md`).
- `python3 -I tools/ipr_praha.py serie "Ulice čp/čo" 300 --zapsat okoli` (okolí) a `… 90 --zapsat dum` (detail domu) → celá
  série do `pracovni/ipr/`, s `--zapsat <skupina>` rovnou mapy v DB přes API; popisy zatím doplň v aplikaci. `ipr_praha.py vrstvy` = seznam.
Ruční dotazy, když nástroj nestačí:
- Plány: `https://gs-pub.praha.eu/imgs/rest/services/arch/<služba>/ImageServer/exportImage?bbox=x0,y0,x1,y1&bboxSR=5514&imageSR=5514&size=1200,1200&format=jpg&f=image`.
  Služby: `stabilni_katastr_cisarske_otisky_2880`, `stabilni_katastr_originaly_1440`, `plan_pav_1889`, `plan_orient_1909`,
  `plan_vysko_1920`, **`plan_orient_1938` (s čísly popisnými a orientačními)**, `plan_prahy_1944`, `byvaly_pozemkovy_katastr`.
  Herget 1791, Jüttner 1816, Mayr 1869, polohopisné 1884 a 1891 pokrývají jen centrum (mimo něj vrátí prázdný obrázek ~23 kB).
- Letecké snímky: `https://gs-pub.praha.eu/arcgis/rest/services/ort/ortofotomapa_archiv/MapServer/export?bbox=…&bboxSR=5514&imageSR=5514&size=…&format=jpg&f=image&layers=show:<id>`
  – id 0 = 1938, 4 = 1945, 8 = 1953, 150 = 1966, 12 = 1975, 16 = 1989, 20 = 1996, 36 = zaplavené území 2002 (seznam: `…/MapServer?f=json`).
- Střed výřezu = parcela domu v S-JTSK: `https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/5/query?where=KATASTRALNIUZEMI%3D<kód k. ú.>+AND+KMENOVECISLO%3D<parcela>&returnGeometry=true&outSR=5514&f=json`.
- **Všechny adresy domu a sousedů** (rohové domy, přečíslování): `mista.py okoli "Ulice čp/čo" 80`, ručně adresní místa v obálce
  `…/RUIAN/MapServer/1/query?geometry=x0,y0,x1,y1&geometryType=esriGeometryEnvelope&inSR=5514&outFields=*&f=json`.
- Zdroj mapy (`source`): „IPR Praha, Geoportál hl. m. Prahy (geoportalpraha.cz), <služba>“.

## DNNT – díla nedostupná na trhu (ndk.cz): tisk 20. století z domova – `tools/dnnt.py`
Adresáře, ročenky, odborné časopisy a noviny zhruba 1900–2000 jsou v Krameriu NK „private“. Většina z nich má ale
`dnnt: true` – kdokoli je přečte z domova po přihlášení na **ndk.cz**. Pro dějiny městských domů je to hlavní zdroj.
**POZOR – ndk.cz banuje IP:** ~10 dotazů `dnnt.py hledej`/`kontext` během pár minut skončilo
přesměrováním na `ndk.cz/bana` („Identita je zablokovaná“, odblokování jen e-mailem s IP adresou) – ban dopadl na IP
uživatele. Za sezení jen několik dotazů, s rozestupy, žádné dávky; před čtením po přihlášení už žádné hledání nástrojem.
- **Postup s nástrojem:** `dnnt.py hledej 'text_ocr:"Dlouhá 14"' --ulozit dl14` → `dnnt.py kontext <pid> 'slova'`
  (úryvky bez přihlášení) → `dnnt.py ocr pracovni/dnnt/dl14.tsv` (veřejné stránky) → pro DNNT stránky
  `dnnt.py js pracovni/dnnt/dl14.tsv [--obrazky]`, funkci spusť přes `evaluate_script` s `filePath` na přihlášené stránce
  ndk.cz (níže) → `dnnt.py rozbal <soubor>` → `dnnt.py adresa pracovni/dnnt/ocr "Dlouhá" 14 16` (najde i „Dlou-há“).
  Celý adresář nebo obor nejdřív `hledej` s `--titul`.
- **Bez přihlášení** je vyhledávání veřejné i pro DNNT stránky (úryvky, test výskytu slova na stránce). OCR text
  neveřejných stran bez přihlášení vrátí 403. Úryvek z vyhledávání je `lit` (čteno z OCR), ne `doc`.
- **Přístup:** uživatel musí být čtenářem zapojené knihovny. Seznam knihoven a kdo umí registraci na dálku:
  `https://ndk.cz/knihinst.json` (sloupce: knihovna, eduID / identity NDK, odkaz na vzdálenou registraci, kraj).
  Ověřeno (2026): Městská knihovna v Praze – levná registrace online přes Bank iD, pak přihlášení eduID. Na dálku
  dále např. NK ČR (bankovní identita), MZK Brno (Bank iD / MojeID, i krátkodobě) a několik krajských knihoven;
  ostatní chtějí jednu návštěvu. Ceny a možnosti ověř na webu knihovny.
- **Čtení po přihlášení (bez hesla v rukou Clauda):** otevři ndk.cz v **řízeném prohlížeči** (chrome-devtools MCP:
  `new_page`), uživatel se v tom okně přihlásí sám. Text a skeny pak čti v kontextu stránky funkcí z `dnnt.py js`
  (session cookie je httpOnly, curl ji nedostane). Metadata a nadřazené číslo: `/search/api/v5.0/item/<pid>`.
- Trvalý odkaz do `url` zápisu: `https://ndk.cz/uuid/<pid>`. Přepis ze skenu = `doc`; jen z OCR textu = `lit`.
- Užitečné tituly: Adresář Republiky československé pro průmysl, živnosti… (1927–1938, podle oborů), Adresář hl. m. Prahy
  1936, Orientační kniha Velké Prahy 1936/1937 (čp. → adresy), Stavitelské listy (stavební povolení), Právo lidu,
  Národní listy, Lidové noviny, ročenky spolků, Dílo družstevní svépomoci (1933).

## Noviny a ročenky – `tools/anno.py`, `tools/anno_snap.py`, `tools/kramerius.py`
**Kdy se vyplatí:** státní a vrchnostenští úředníci, soudci, učitelé, faráři, důstojníci, vojenští lékaři, notáři,
poštmistři, starostové, podnikatelé – noviny otiskovaly jmenování, přeložení, vyznamenání, penze, konkurzy, oznámení
sňatků a parte (zhruba od 1860). Z toho plyne, **kde člověk kdy žil** → kde hledat křty dětí, sňatek, úmrtí.
A když osoba „chybí“ v očekávaných matrikách (stěhovala se se službou). **Spíš ne:** sedláci a řemeslníci na vsi.
- ANNO (rakouské noviny 1700–1950, i Prager Zeitung, Wiener Zeitung): `python3 -I tools/anno.py '"Johann Nowak"' 1860 1915 [stran] [--snip]`
  – jména **německy** („Johann Nowak“, „Wenzel Dworschak“). Výřez místa: `tools/anno_snap.py <docId> "<dotaz>" pracovni/x.jpg`.
  ALEX a annoshow jsou za Cloudflare – neobcházet.
- Kramerius NK ČR (české noviny, ročenky, adresáře): `python3 -I tools/kramerius.py 'text_ocr:"Jan Novák" AND datum_begin:[1900 TO 1910]'`.
  Pozor: filtr `datum_begin` vyřadí část čísel periodik (u některých chybí) – při malém počtu nálezů hledej i bez něj.
  Neveřejné stránky 20. století čti přes DNNT (výše).
- Vojenské schematismy: fulltext na archive.org (např. `militrschematis13kriegoog` = 1850).
- **Rizika:** jména se opakují a fulltext šumí („Winter“ = i zima, „Novák“ = nový obyvatel). Ztotožni jen při shodě víc údajů (bydliště,
  funkce navazující na matriku, časová posloupnost). Zdroj je „J“ (jiný pramen) – vodítko a příběh, ne náhrada matriky.
- Výstřižky jsou skvělé na web: jako zápis druhu `J` (`rdb.py nalez`/`zaznam pridej`) s výřezem přes `vyrez.py`, nebo jako dokument (`data.md` → Fotky a dokumenty).
- Pořadí: nejdřív matriky; noviny, když chybí stopa kvůli stěhování, nebo když jde o úředníka/vojáka a chceme příběh.

## Ostatní portály – obecný postup
Nástroje pro ně hotové nejsou. Postupuj takto a postup zapiš do deníku (`rdb.py denik pridej …`), ať to příště víš:
1. Otevři portál v prohlížeči sám (Claude in Chrome, postup ve skillu `matriky-v-prohlizeci`).
   Uživatele žádej až ve chvíli, kdy je potřeba přihlášení nebo souhlas.
   Najdi fond „Sbírka matrik“ / „Matriky“ a svazek podle obce a let.
2. **Snímek:** většina prohlížečů má tlačítko ke stažení obrázku – ulož do `pracovni/`. Když ne, podívej se v síťovém
   provozu, odkud se načítají dlaždice/obrázky (IIIF, DeepZoom, Zoomify), a stáhni celý obrázek touto cestou – jednotlivě,
   jen snímky, které čteš. Krajní možnost: požádej uživatele, ať snímek uloží a dá do `pracovni/`.
3. **Trvalý odkaz** na snímek (tlačítko „trvalý odkaz“/permalink, jinak URL svazku + číslo snímku) dej do `url` zápisu.
4. Svazek založ ručně: `python3 -I tools/rdb.py svazek pridej <klic> --archiv "SOA Třeboň" --portal digi.ceskearchivy.cz
   --nazev "N Volary 1784–1820, sign. …" --popis "obce…" --url "<odkaz na svazek>"`.
5. Dál stejně jako u ARON: zápis (`rdb.py nalez` / `zaznam pridej`), `vyrez.py`, `ramecek.py`.
6. Když se postup osvědčí, napiš pro portál vlastní malý nástroj podle `trebon.py` (bez prohlížeče, pokud to jde)
   a postup zapiš do deníku. Poznatek zapiš i do `poznamky_pro_skill.md` (pro správce skillu).

## Starší prameny (17.–18. století)
- **Soupis poddaných podle víry 1651** – celé rodiny s věkem, po krajích; edice Národního archivu jako PDF
  (nacr.cz, hledej „Soupis poddaných podle víry“ + kraj). Fulltext v PDF, příjmení často bez diakritiky / s jinou ortografií
  (Šaršoun → „Šaroun“, dlouhé ſ jako f). Ves je v rámci panství; poznamenej si stránku edice.
- **Berní rula 1654** – jen hospodáři s půdou; edice a rejstříky v knihovnách (Kramerius/DNNT).
- **Gruntovní (pozemkové) knihy** – převody domů z otce na syna; online jen část (SOA Plzeň téměř vše, SOA Praha část,
  ostatní spíš badatelna). Fond „Velkostatek <panství>“.
- **Mapy stabilního katastru (1824–43)** – kde stál dům s číslem popisným: Archiv ČÚZK (ags.cuzk.gov.cz/archiv,
  nástroj `cuzk_archiv.py`, postup v `prameny.md`).
  Na **císařských otiscích** chybí u části listů barvy a čísla domů. Lepší jsou **indikační skici**: mají čísla domů
  a u pozemků jméno majitele („N. 13“ = patří k domu čp. 13). Dům bez pozemků mimo ves = domkář bez polí.
  Jméno majitele samotného domu bývá jen v písemném operátu (archiv, ne online). Výřezy map patří na web k domu (mapy přes API, `data.md`).
- **Dnešní adresa domu** podle čísla popisného: RÚIAN (`mista.py ruian "Osada čp"`: adresa, parcela, k. ú.). Pozor, staré centrum mívá od 19. století
  stejná čp., ale předměstí a vesnice čísla přečíslovávaly. Hodí se na procházku po místech, kde lidé z domu žili a pracovali.
  Stavbu podle obce a čísla popisného najde i nahlizenidokn.cuzk.gov.cz (ověření adresy z dokladu); vlastník je za
  CAPTCHou a je to údaj o žijícím člověku – nezjišťuj ho.

## Staré mapy a drobné památky (pro mapu na webu)
- **2. vojenské mapování (1836–52)**: WMS `https://gis.cenia.cz/mapcache/II_vojenske_mapovani/wms` (WMS 1.1.1, vrstva
  `II_vojenske_mapovani`, jen EPSG:5514). Výřez: střed převeď z lat/lon na S-JTSK přes
  `https://ags.cuzk.gov.cz/arcgis/rest/services/Utilities/Geometry/GeometryServer/project` (`inSR=4326`, `outSR=5514`,
  `geometries={"geometryType":"esriGeometryPoint","geometries":[{"x":lon,"y":lat}]}`, `f=json`), pak `GetMap` s `BBOX` ±1300 m,
  `WIDTH=1800&HEIGHT=1200`, a `vyrez.py <obrázek> mapa_<obec>_1845_2_vojenske_mapovani 0,0,1,1`. Na jednotlivé domy podrobnost
  nestačí, ale ukáže ves, cesty a mlýny. Starší adresa `geoportal.gov.cz/ArcGIS/services/CENIA/…` hlásí údržbu a oldmaps.geolab.cz
  místo stránek vrací zdrojový kód – nepoužívat.
- **Kříže, boží muka, pomníky dnes**: ZABAGED (`https://ags.cuzk.gov.cz/arcgis/rest/services/ZABAGED_POLOHOPIS/MapServer`,
  vrstva 24 „Kříž, sloup kulturního významu“, 25 „Mohyla, pomník, náhrobek“; `query` s `geometry` = obálka kolem obce,
  `inSR=outSR=4326`). Názvy nemají, jen polohu. OpenStreetMap (Overpass, `historic=wayside_cross|wayside_shrine|memorial`)
  bývá podobné; přetížený server zkus znovu za chvíli.
- **Pomístní jména** (tratě, lesy, rybníky – „U hamru“, „Na tvrzi“, „Hradiště“): GEONAMES
  `https://ags.cuzk.gov.cz/arcgis/rest/services/GEONAMES/Vyhledavaci_sluzba_nad_daty_GEONAMES/MapServer/0/query` (obálka kolem obce).
- **Co kde stálo a proč**: obecní kronika (kronikář obvykle vyjmenuje kříže a kaple i s místem a důvodem), opisy kronik na webech
  obce a místních. Spojení: kronika řekne „kříž před čp. 24“ → RÚIAN dá polohu dnešního čp. 24 → bod `priblizne` s popisem,
  ze kterého pramene je. Shoda s křížem v ZABAGED/OSM je `prob`, ne jistota.
- **Tvrze a hrady**: Sedláček, *Hrady, zámky a tvrze království Českého* – původní vydání (1882–1927) je v Krameriovi veřejně
  (`kramerius.py '(text_ocr:Obec*) AND root_title:"Hrady, zámky a tvrze" AND dostupnost:public'`, text stránky přes
  `…/item/<uuid>/streams/TEXT_OCR`, kódování UTF-16). Novější regionální soupisy tvrzí bývají jen v knihovně.

## Oběti 2. světové války
- **Arolsen Archives** (collections.arolsen-archives.org): dokumenty o vězních, nuceně nasazených a vysídlených. Vyhledávání
  v prohlížeči, vstupní prohlášení musí odsouhlasit uživatel.
- **Mauthausen – Raum der Namen** (raumdernamen.mauthausen-memorial.org): vězni zemřelí v Mauthausenu, s datem a místem
  narození i úmrtí. Takové údaje jsou citlivé – na web jen se souhlasem rodiny (`soukromi.md`).

## Příjmení dnes a DNA
- **Rozšíření příjmení dnes**: kdejsme.cz (počty nositelů po okresech). Rychle ukáže, jestli je příjmení vzácné a kde
  jsou jeho „hnízda“. Při hledání vzdálených příbuzných vyškrtni vlastní rodinu.
- **DNA** (jen když o to uživatel stojí, a jeho rozhodnutí): autosomální test (MyHeritage, Ancestry) najde bratrance
  do ~5. kolene. **Y-DNA** (FamilyTreeDNA, Y-37 až Big Y) se dědí po meči beze změny. Ověří, jestli dvě linie stejného
  příjmení mají společného předka, a u nemanželského dítěte může shoda s jiným příjmením ukázat otce. Kontakt se žijícími
  příbuznými vždy jen přes uživatele.
Všechno, co jde jen v badatelně, zapisuj jako úkol: `rdb.py ukol pridej "Badatelna: <archiv> – <co>" --druh badatelna --text "fond, inv. č., co hledat"`.
