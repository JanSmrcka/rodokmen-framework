# Prameny k dějinám domu a obce

Postup: **od dneška zpátky**. Každý pramen vám dá číslo domu, jméno držitele a odkaz na starší pramen.
Matriky (jak je číst, lhůty, písmo) → `matriky.md`. Portály a nástroje na stahování snímků → `portaly.md`.
Kde něco nevíš jistě (adresa portálu, co je digitalizované), ověř to. Co funguje, zapiš do `portaly.md` nebo `poznamky_pro_skill.md`.

## Mapa pramenů podle doby
| Doba | Pramen | Co dá k domu | Kde |
|---|---|---|---|
| dnes | katastr nemovitostí, RÚIAN | parcela, k. ú., dnešní obec | `mista.py ruian "Osada čp"` (hned ve Fázi 0 – dnešní obec a k. ú. bývají jiné, než se čeká), nahlizenidokn.cuzk.cz |
| 1950–dnes | letecké snímky | jak dům a dvůr vypadaly, kdy přibyly a zmizely stavby | ags.cuzk.gov.cz/archiv (Archiv ČÚZK), kontaminace.cenia.cz (snímky z 50. let), mapy.cz → „Letecká“ s volbou roku |
| 1880–1950 | pozemkový katastr (mapa ~1900–1950) | parcely a budovy, sedí na dnešní mapu | `cuzk_archiv.py mapa pk` |
| 1870–1950 | pozemkové knihy (vložky) a sbírka listin | vlastníci, kupní a svatební smlouvy, dluhy, výměnky | katastrální pracoviště (do 1950 často SOA / SOkA) – `archivni_dotazy.md` |
| 1857–1921 | sčítání lidu (1857, 1869, 1880, 1890, 1900, 1910, 1921) | **celá domácnost po číslech domů**: jména, roky a místa narození, vztahy, řemesla, dobytek | SOkA. Jižní Čechy jsou na digi.ceskearchivy.cz (stejný portál jako matriky, `trebon.py strom 1s`, `snimek`) |
| 1784–1900 | matriky (od 1784 se v nich uvádí číslo domu) | kdo se v domě narodil, oženil a zemřel. **Čti podle čísla domu, ne podle jména** | `matriky.md`, `portaly.md` |
| 1824–1843 | stabilní katastr: císařské otisky, indikační skici, písemný operát | půdorys domu a dvora, číslo domu, parcely. **Indikační skica má u parcel i jméno držitele** | `cuzk_archiv.py` (Archiv ČÚZK: originální mapy s reambulací, otisky, skici), písemný operát (parcelní protokoly) v Národním archivu |
| 1785–1789 | josefský katastr | držitel, výměra pozemků, číslo domu | Národní archiv (fond Josefský katastr). Často jen badatelna |
| 1748–1757 | tereziánský katastr | usedlíci podle kategorie (sedlák, chalupník), výměra | Národní archiv. Výtahy bývají v regionální literatuře |
| 1550–1850 | **gruntovní knihy** (pozemkové knihy vrchnosti) | **všichni držitelé gruntu za sebou**: koupě, dědictví, cena, splátky, výminky, sirotci | fond velkostatku (panství) v SOA. Některé jsou digitalizované na portálech SOA |
| 1654 | berní rula | jméno hospodáře, kategorie usedlosti, výměra, dobytek | tištěná edice po krajích (Kramerius / knihovny) |
| 1651 | soupis poddaných podle víry | celé domácnosti s věkem | edice po krajích |
| 1400–1700 | urbáře | povinnosti a platy jednotlivých usedlostí | fond velkostatku v SOA, edice |
| vše | literatura, vlastivědy, kroniky obce a školy, noviny | události obce (požáry, války, stavby), staré názvy | Kramerius (`kramerius.py`), ANNO (`anno.py`), Google Books, SOkA (kroniky bývají online) |
| 1764–1880 | vojenská mapování (1. 1764–68, 2. 1836–52, 3. 1876–80) | vzhled vsi a okolí, cesty, mlýny | 2. mapování: WMS CENIA (`portaly.md` → Staré mapy a drobné památky); oldmaps.geolab.cz (nespolehlivé), mapire.eu (jen prohlížení) |

## Městský dům 20. století (činžák, vila, 1890–1990)
Matriky a sčítání do roku 1921 tu skoro nepomohou (dům často stojí až po 1921; sčítací archy z roku 1930 a pozdější
bývají nedostupné – ověř v archivu).
Osvědčené pořadí:
1. **Dnešní adresy domu i sousedů** z RÚIAN: `mista.py okoli "Ulice čp/čo" 80`. Rohový dům má dvě adresy.
2. **Staré plány a letecké snímky stejného výřezu** – kdy na parcele poprvé stojí budova. V Praze IPR (plány 1889, 1909,
   1920, 1938 s čísly popisnými, 1944, ortofota 1938–2006: `ipr_praha.py serie … --zapsat`); jinde `cuzk_archiv.py mapa pk`.
3. **Adresní kniha čp. → ulice a č. or.** (Praha: Orientační kniha Velké Prahy 1936/1937) – jaká orientační čísla dům
   tehdy měl. Bez toho nejde hledat v adresářích.
4. **Adresáře živností** (Adresář Republiky československé 1927–1938, Adresář Prahy 1936, Adressbuch des Protektorates 1939,
   telefonní seznamy 1950) – obchody v přízemí, řemeslníci, lékaři. Řazené podle oborů – hlavička stránky řekne obor.
5. **Stavební povolení a soutěže:** Stavitelské listy (rubrika „Kde se bude stavěti?“ – stavebník, pozemek, počet pater),
   inzeráty „zadá práce na stavbu…“ v denících (Právo lidu, Národní listy). Stavebníkem bývá družstvo, stavitel nebo firma.
6. **Ročenky a seznamy členů spolků a zaměstnanců** (s adresami) – bydliště konkrétních lidí po letech; stejná osoba
   ve dvou ročnících s jinou adresou domu = doklad přečíslování.
7. **Družstva:** jubilejní sborníky („Dílo družstevní svépomoci“ 1933), výroční brožury – počty domů, sídlo, fotky.
   Nástupce (lidové / stavební bytové družstvo) může mít archiv stavební dokumentace.
8. **Archiv:** stavební spis (stavební úřad městské části, AHMP), pozemková kniha (katastrální úřad), archiv družstva →
   úkol `rdb.py ukol pridej "Badatelna: …" --druh badatelna`.
Většina tisku 1900–1990 je v Krameriu NK **neveřejná, ale v režimu DNNT** – čitelná z domova po přihlášení
(`portaly.md` → DNNT, nástroj `dnnt.py`: hledání, úryvky, hromadné čtení, `adresa` najde i rozdělená slova).
Bez přihlášení vidíš jen úryvky ve vyhledávání.

## Čísla domů – největší past
- Čísla popisná zavedla konskripce 1770–1771. **Ves se pak často přečíslovala** (typicky kolem 1805–1830 a znovu
  po 1900). Dnešní čp. 12 může být v roce 1800 jiné číslo.
- Jak to poznat: stejná rodina pod dvěma čísly v blízkých letech (matrika ↔ sčítání), stabilní katastr (číslo
  v 1827 + půdorys = dnešní parcela), indikační skica (jméno držitele). Do `cisla` u domu zapiš všechna čísla s roky
  a **doklad** (klíč zápisu).
- Nový dům na parcele starého (vyhořel, rozdělení gruntu) dostává často nové číslo. Rozdělený grunt má dvě čísla.
- Do ztotožnění starého a nového čísla je všechno starší `prob`, s poznámkou proč.
- **Města: orientační čísla se měnila** (i ve 20. století, celé ulice najednou) a rohové domy mají dvě adresy.
  Nejdřív sestav **tabulku adres domu v čase** (čp., všechna č. or. a ulice, rok změny) a zapiš ji do `numbers` domu
  (`rdb.py dum pridej`, `data.md`). Každý nález s adresou („Dlouhá 38“, 1946) převeď podle **data** přes tuto tabulku: stejná
  adresa v jiném roce může být jiný dům (sousední nebo naproti přes ulici). Rok přečíslování dolož „kotvou“ – stejnou
  osobou nebo firmou, která má v jednom roce starou a v dalším novou adresu. Údaj s adresou bez čp. a mimo
  ověřené období je `prob`.

## Gruntovní knihy – jak na ně
1. Zjisti **panství**, ke kterému ves (nebo dům!) patřila před 1848. Ves mohla patřit pod dvě panství (část domů
   jednomu, část druhému). Panství najdeš ve vlastivědě, v Sedláčkově Místopisném slovníku nebo v hlavičce matrik.
2. Fond „Velkostatek <panství>“ v příslušném SOA → inventář → gruntovní knihy pro danou ves (podle let).
   SOA Třeboň: `trebon.py strom 1q` (pozemkové knihy) → archiv → fond; `trebon.py strom <kód fondu> "Obec"` vypíše
   jen svazky, kde obec je (`svazky` je neukáže). Totéž urbáře (`1U`), vrchnostenská registra (`1t`), kroniky (`1k`).
3. Zápis o gruntu: „grunt N. N. … prodán … za … kop / zlatých“, splátky (vejrunky), výměnek pro rodiče, podíly
   sourozenců. Postupně ho čti od posledního držitele zpátky. U každé změny držitele vznikne řádek v `holders` domu.
4. Online nejsou všechny. Co není, zapiš jako úkol `rdb.py ukol pridej "Badatelna: …" --druh badatelna` (fond, signatura, roky) a navrhni návštěvu badatelny.

## Stabilní katastr (Archiv ČÚZK, `cuzk_archiv.py`)
Archiv ČÚZK je na https://ags.cuzk.gov.cz/archiv/ (staré archivnimapy.cuzk.cz už neexistuje). Nástroj ho čte bez prohlížeče.
1. `python3 -I tools/cuzk_archiv.py listy "Osada čp"` → katastrální obec v roce 1827 (**malá ves bývá součástí
   katastru sousední obce**) a předpony rastrů originální mapy, otisku a skici.
2. `cuzk_archiv.py rastry stable <om_SIGN_INV>` → listy; `export stable <id> pracovni/katastr/list.jpg 0,0,1,1 1500`
   → najdi ves na náhledu, pak výřez ve velkém (`export … x0,y0,x1,y1 5000`, podíly 0–1 jako u `vyrez.py`).
- **Originální mapa** (om) je nejcennější: zeměměřiči do ní **dokreslovali změny až do ~1880 (reambulace, změny
  červeně)**. Nová stavba nebo rozdělení parcely je tam i s číslem. Rok reambulace vypíše `listy`.
- **Císařský otisk** (cio, barevný, 1824–43) = podoba vsi. Domy zděné červeně, dřevěné žlutě, s čísly popisnými
  (u části listů barvy a čísla chybí).
- **Indikační skica** (služba `skici`, předpona S0X) = pracovní mapa se jmény držitelů a změnami.
- **Pozemkový katastr** (`mapa pk "Osada čp" výstup.jpg`) je georeferencovaný v S-JTSK: sedí na dnešní mapu, takže
  přes RÚIAN budovy jde ztotožnit starou parcelu s dnešním domem. Spojené vrstvy `originalni_mapy`
  a `cisarske_otisky` malé obce často nepokrývají (bílý obrázek) – pak `listy` + `export`.
- Výřez se vsí a s domem ulož jako mapu přes API (`data.md` → Staré mapy; zdroj „ČÚZK, Archiv ČÚZK,
  <mapa, signatura, list>“, url https://ags.cuzk.gov.cz/archiv/). Na stránce domu se ukáže v galerii, porovnání viz `web.md`.
- Mapy ČÚZK jsou pro nekomerční užití volné s uvedením zdroje. U map z jiných zdrojů (Mapy.cz, oldmaps) vždy uveď zdroj.
  Na neveřejném webu to stačí.

## Sčítání lidu
- Archy jsou **po domech**: hlavička s číslem domu, pak všichni obyvatelé (i výměnkáři, čeledíni, podruzi).
- Na digi.ceskearchivy.cz má každá obec a rok svazek. Číslo snímku domu najdeš listováním (archy jdou podle čp.).
  Stahuj `python3 -I tools/trebon.py snimek <id_svazku> <snímek> pracovni/scitani_<rok>/<snímek>.jpg`
  (`id` = parametr `id=` v odkazu `DA?…&id=123456&page=65`).
- Svazky sčítání najdeš `trebon.py strom 1s` (sčítání lidu po archivech a okresech). Sčítání 1857–1880 nemusí být
  pro každý soudní okres online, 1890–1921 obvykle ano.
- **Údaje o domě a obyvatelé bývají na různých snímcích.** 1910: titulní list s vlastníkem domu, na dalším snímku
  osoby; 1921: sběrný arch domovní → prázdný list → sčítací arch. **Vždy stáhni i 1–3 následující snímky.**
  Vlastníka domu uvádí až 1910 a 1921; v 1890/1900 je „majitel bytu“ = hlava domácnosti, ne vlastník domu.
- Ze sčítání vznikne: událost domu („1890: v domě 9 osob, hospodář Jan Novák, rolník…“), obyvatelé s `r` a podklad
  pro hledání v matrikách (roky narození).

## Matriky podle čísla domu
- Od 1784 je u každého zápisu číslo domu. V knize hledej **všechny** zápisy z daného čísla (křty, sňatky, úmrtí).
  Tak poznáš, které rodiny v domě žily a kdy se střídaly (přiženění, prodej).
- Rejstříky jsou podle jmen. U domu proto nejdřív získej jména ze sčítání nebo z gruntovní knihy, pak teprve rejstřík.
- Pomocníkům dej konkrétní knihu, rozsah snímků a číslo domu: „vypiš všechny zápisy z Horní Lhoty čp. 12“.

## Obec
- Literatura: vlastivědy okresu, dějiny panství (např. „Geschichte der Herrschaft …“), Sedláček (Hrady, zámky a tvrze;
  Místopisný slovník), Profous (Místní jména v Čechách – původ názvu), Statistický lexikon obcí (počty domů a obyvatel).
- Do `OBEC_UDALOSTI` se stavem `lit` a `zdroj` (kniha, strana). Údaj z literatury, který jde ověřit v prameni,
  ověř a změň na `doc`.
- Kroniky obce a školy: bývají digitalizované u SOkA (na stejných portálech jako matriky). Čti zápisy o požárech,
  válkách, elektrifikaci a stavbách, často jsou tam i jména a čísla domů.
- Noviny: požáry, dražby („exekuční dražba usedlosti čp. …“), soudní zprávy.

## Lidé
- Pamětníci a majitelé: kdy a od koho dům koupili, přestavby, staré fotky. Zapiš jako vodítko `rdb.py voditko pridej "…" --od-jmena "<kdo>" --kanal rozhovor` (stav `fam`).
- Domovní dokumenty (kupní smlouvy, stavební povolení, plány) přečti celé, bývají nejcennější.
