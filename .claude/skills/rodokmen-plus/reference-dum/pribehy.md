# Zajímavosti a příběh domu

Tabulku držitelů nikdo číst nebude. „Dům třikrát vyhořel a pokaždé ho postavili znovu na stejném místě“ nebo
„chalupu koupil čeledín, který na ní dvacet let sloužil“ si přečte každý. Zajímavosti sbírej průběžně, ne až na konci.

## Zajímavosti – sbírej průběžně
Co najdeš při čtení, hned zapiš do zajímavostí (nadpis `##` + 2–5 vět) a řekni to uživateli jako příběh:
`rdb.py pribeh ukaz zajimavosti` → doplň v `pracovni/zajimavosti.md` → `rdb.py pribeh uloz zajimavosti pracovni/zajimavosti.md --titulek Zajímavosti --druh zajimavosti`.
| Typ | Příklad |
|---|---|
| Nejstarší zmínka | první písemná zmínka o vsi / o gruntu, co v ní stojí doslova |
| Jedna rodina, sto let | stejné příjmení na gruntu přes generace, a kdy a proč se to zlomilo |
| Přiženění | vdova se znovu vdala a grunt přešel na nové příjmení |
| Ceny | za kolik se grunt prodával (kopy, zlaté), co to znamenalo (kolik krav, kolik let práce čeledína) |
| Pohromy | požár, povodeň, mor, cholera (úmrtí v matrice za pár týdnů), válka, rekvizice |
| Dělení a slučování | grunt rozdělený mezi syny, nový domek na dílu pole |
| Řemesla | kovárna, hospoda, mlýn, hamr v domě |
| Dvě vrchnosti | ves rozdělená mezi dvě panství, roboty jinam |
| Přečíslování | „dům měl tři různá čísla“ |
| 20. století | odsun Němců, kolektivizace, chalupáři. Jen fakta, citlivé věci se souhlasem (`soukromi.md`) |
| Mapy | co ukazuje stabilní katastr 1827 a co zmizelo (stodola, rybník, cesta) |
| Ústní podání vs. prameny | co vypráví sousedé a co potvrdil (nebo vyvrátil) archiv |

Nejlepší 2–4 dej na začátek zajímavostí.

## Příběh domu
**Kdy:** když má hlavní dům zhruba 4 doložené držitele nebo pokrytí ~150 let.
**Postup:**
1. Sesbírej: události a držitele domu (`rdb.py dum ukaz <klic>`), obyvatele, zajímavosti, mapy, vodítka od pamětníků (`rdb.py voditko seznam`), dějiny obce (`rdb.py misto ukaz`).
2. Napiš **koncept do chatu**. Pod něj připiš, co je z pramenů a co z literatury nebo od pamětníků. Uložíš ho až po schválení.
3. Text do `pracovni/pribeh-cp12.md` (bez hlavičky), uložení `rdb.py pribeh uloz cp12 pracovni/pribeh-cp12.md
   --titulek "Příběh čp. 12" --perex "Jedna věta, která chytí." --druh pribeh_domu --dum horni-lhota-12 --poradi 1`:
   ```markdown
   ## Ves pod hradem (1352–1650)
   …
   ## Novákovi (1786–1870)
   …
   ```

**Víc příběhů** (dům, výměnek, ves, rodina): každý zvlášť přes `rdb.py pribeh uloz <slug> …` (`--druh pribeh_domu`
s `--dum <klic>` pro dům, `pribeh` pro ves a ostatní, `--poradi` = pořadí karet). Seznam: `rdb.py pribeh seznam`.
Období a obrázek karty API zatím nemá (dej období do perexu).

**Tvar** (800–1500 slov): kapitoly po obdobích nebo po rodinách držitelů. Nadpis = rodina nebo období a roky.
Začni krajinou a vsí (kdy vznikla, komu patřila), pak jednotliví držitelé a obyvatelé: kdo, odkud přišel, za kolik
koupil, kolik měl dětí, co je potkalo. Konkrétně: roky, ceny, citace z pramenů v uvozovkách, odkazy `[zápis](/zdroj/<klic>/)`.
Velké dějiny jen tam, kde se dotkly domu (robota, 1848, války, 1945, kolektivizace). Co nevíme, napiš jako otázku.
Poslední kapitola „Dnes“: jen to, co majitel na web pustí.
