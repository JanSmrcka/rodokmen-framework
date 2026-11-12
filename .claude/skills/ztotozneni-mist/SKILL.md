---
name: ztotozneni-mist
description: Ztotožnění obcí a příjmení ze starých zápisů (matriky v kurentu, latině, němčině; katastry, sčítání) s dnešními místy a tvary – cs/de Wikipedia přes API, hledání fragmentu názvu na portálu archivu, homonyma podle farnosti a panství, Hosák–Šrámek, Profous, Wolný, RÚIAN a OSM, projektové slovníky v databázi (rdb.py misto nazev / hledej, rdb.py prijmeni), matoucí písmena kurentu. Použij, když je v zápisu nečitelná, německá, zkomolená nebo stejnojmenná obec („Horschowitz“, „Langenau“, „in Wesseli“), když hledání obce na portálu nic nenajde, když se příjmení píše různě (Wanek/Vaněk, Nowakin), nebo před čtením matrik nové oblasti. Spouštěcí fráze: „co je to za obec“, „německý název“, „nečitelná obec“, „kde leží“, „stejnojmenná obec“, „jak se psalo příjmení“.
---

# Ztotožnění míst a příjmení

Špatně ztotožněná obec pošle celé hledání do jiné farnosti a další generace jsou pak cizí lidé. Ztotožnění je
proto samostatný krok s doložením, ne odhad. Patří ke skillu `rodokmen-plus`.

## Postup pro nejasnou obec
1. **Přečti, co v zápisu skutečně je**, i částečně: „Hor…owitz“, „in Wes(s)eli“. Zapiš všechny možné čtení a které
   písmeno je nejisté (viz Matoucí písmena níže). Porovnej tvar písmen s jinými slovy **na téže stránce** téhož písaře.
2. **Podívej se do slovníku projektu** – `python3 -I tools/rdb.py misto hledej "<tvar>"` hledá i ve starých a německých
   názvech míst (tvar už mohl být ztotožněn dřív); nejasné tvary `rdb.py hledat "<tvar>"` (deník, vodítka, úkoly).
3. **Kontext zápisu**: farnost knihy, panství, kraj, sousední obce v oddílu, řemeslo, „bey <město>“, „Herrschaft …“.
   Ves je skoro vždy do ~15 km od fary, kde se zápis dělal (u sňatku od fary nevěsty).
4. **Wikipedie přes API** (ne scraping, jeden dotaz po druhém):
   - **cs.wikipedia je primární** – u malých obcí uvádí německé a starší tvary v úvodu nebo v sekci Historie
     a de.wiki je jen doplněk (u malých obcí heslo často chybí). Heslo:
     `https://cs.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=<Obec>`
   - Hledání podle tvaru: `https://cs.wikipedia.org/w/api.php?action=query&list=search&format=json&srsearch="Horschowitz"`
     (stejně `de.wikipedia.org`; v de.wiki zkus i přesměrování z německého tvaru na heslo obce).
   - Projdi **i reference a externí odkazy hesla** – vedou k pramenům (sčítací operáty, indikační skici, literatura,
     místopisy) a vyplatí se hned na začátku projektu, ne až při potížích.
   - Síť jen přes `python3 -I tools/slusne.py curl …` nebo WebFetch.
5. **Fragment na portálu archivu.** Vyhledávání obcí na portálu (např. `tools/mza.py hledat "Horsch"`, ARON
   `aron_search.py`) najde obec i podle začátku a často i podle německého tvaru. Zkus kratší a kratší fragment
   a varianty nejistých písmen.
6. **Literatura** (Kramerius NK/MZK, `tools/kramerius.py`; po ~10 rychlých dotazech vrací 403 – zpomal):
   - Morava a Slezsko: **Hosák–Šrámek, Místní jména na Moravě a ve Slezsku** – primární zdroj historických tvarů
     včetně německých, s doklady a roky.
   - Čechy: **Profous, Místní jména v Čechách**.
   - Morava: **Wolný, Die Markgrafschaft Mähren** (panství, příslušnost vsí) a **Kirchliche Topographie von Mähren**
     (fary a přifařené obce).
   - Historický lexikon obcí ČR 1869–2011, Statistický lexikon obcí – příslušnost a počty domů.
7. **Dnešní poloha**: RÚIAN (`python3 -I tools/mista_domy.py ruian "Obec čp"` – i osady a části obcí, k. ú., parcela)
   a OSM (`mista_domy.py hledej "Obec, okres"`; malé osady často nezná). Vzdálenost od fary ověř na mapě.
8. **Zapiš ztotožnění**: místo `rdb.py misto pridej <slug> --nazev "<dnešní obec>"` (když v DB ještě není) a čtený
   tvar jako jeho název `rdb.py misto nazev <slug> "Horschowitz" --jazyk de --pozn "<jistota>, <zdroj>, zápis <klíč>"`;
   do shrnutí či poznámky zápisu (`rdb.py zaznam uprav <klíč> --shrnuti …`) a do deníku (`rdb.py denik pridej`). Nejisté ztotožnění = `prob` s důvodem; zápis o osobě z takové obce je nejvýš tak jistý jako ztotožnění.

## Homonyma (stejnojmenné obce)
- Lhota, Újezd, Petrovice, Langenau, Neudorf – stejný název je v jednom kraji i několikrát.
- **Rozhoduje farnost** (kam ves byla přifařená) a panství, ne vzdálenost na dnešní mapě. Ověř přifaření v Kirchliche
  Topographie nebo v seznamu obcí knihy na portálu (oddíly knihy uvádějí obce).
- Jedna farnost měla v různých obdobích různé fary (nová fara ~1785) – ověř pro rok zápisu.
- Na portálu archivu vyber obec podle okresu a fary, ne podle prvního výsledku.
- Části dnešních měst byly samostatné obce (předměstí, osady) a mají vlastní oddíly v matrikách.

## Příjmení
- Varianty příjmení v DB: jak se příjmení rodu skutečně psala. Před čtením nové knihy `rdb.py prijmeni hledej <příjmení>`,
  po čtení doplň tvar `rdb.py prijmeni pridej <příjmení> <tvar> --pozn "zápis <klíč>"`; tvar u konkrétní osoby
  `rdb.py osoba jmeno <id> --druh v_zapisu …`.
- Obecné vzorce: W = V (Wanek = Vaněk), cz = č, rz = ř, ss/sch = š, y = ý/í/j; ženy v němčině a kurentu -in
  (Nowakin), v latině -a; zdvojené souhlásky a vynechané délky nic neznamenají.
- Příjmení se v 18. století ještě ustalovala: syn může mít příjmení podle domu nebo řemesla. Ztotožnění přes číslo
  domu a jména rodičů je silnější než shoda příjmení.

## Matoucí písmena kurentu (a latinky písařů)
| zaměňuje se | pozor |
|---|---|
| S / D, L / C (velká písmena) | Sedlák × Dedlák – porovnej s jiným jménem na stránce |
| rn / rm / m / w | -rn- v němčině × -m- |
| e / n / r, u / n | kurentové e vypadá jako n; u má nad sebou oblouček |
| k / h, f / s (dlouhé ſ) | Horschowitz × Korschowitz; ſ × f se liší vodorovnou čárkou |
| -ík / -ák, -ek / -ik | koncovky jsou nejméně čitelné, rozhoduje jiný zápis téže rodiny |
| c / e / t, cz / tz | Wesseli × Wefseli, Lhotta × Chotta |
| zkratky | `fil.` (syn), `v.` (vdova), `p.m.` (zemřelý), `Inw.` (podruh), `ux.` (manželka) |

Nejisté písmeno dej v přepisu do závorky „Hor(s/f)chowitz (?)“ a uveď obě čtení v hledání. Tvary, které zatím
ztotožněné nejsou, zapiš jako úkol (`rdb.py ukol pridej "Nejasná obec „Hor(s/f)chowitz“ (zápis <klíč>)" --druh misto`)
– vrať se k nim, když najdeš jiný zápis téže rodiny.

## Výsledek
U každého ztotožnění uveď: čtený tvar, dnešní obec (a obec/část, okres), farnost v roce zápisu, zdroj (heslo
Wikipedie, Hosák–Šrámek s číslem dílu a stranou, oddíl knihy na portálu) a jistotu. Bez zdroje to není ztotožnění.
