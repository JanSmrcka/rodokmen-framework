# Data dějin domu (databáze přes API)

Všechna data jsou v databázi a čtou se a zapisují **jen** přes `python3 -I tools/rdb.py …` (nebo nástroje v `tools/`,
které API volají samy). Žádné datové soubory (`domy.py`, `*.json`, `*.md` v `data/`) se už neupravují; web (aplikace
`aplikace/`) čte DB přímo. Větší vstupy napiš jako JSON nástrojem Write do `pracovni/` a předej cestu (nebo `-` = stdin).
Po větší změně `python3 -I tools/rdb.py kontrola`. Celý datový model: `reference/data.md`.

## Jistota (`certainty`)
| hodnota | význam |
|---|---|
| `doc` | přečteno přímo na snímku pramene (matrika, gruntovní kniha, sčítání, katastr, mapa). Vždy se zápisem (`recordKey`) |
| `lit` | z literatury (kniha, článek, vlastivěda) – zápis druhu `L` se stranou a odkazem |
| `prob` | pravděpodobné (shoda jména, doby a čísla, ale ne přímý doklad, třeba před ztotožněním přečíslování), v `note` proč |
| `fam` | od majitele, pamětníka nebo z domovního dokumentu (vodítko, `rdb.py voditko pridej`) |
| `mh` | z cizího rodokmenu (MyHeritage, Geni…) – jen vodítko |
| `unk` | neznámé |

## Obec (místo)
```
rdb.py misto pridej horni-lhota --nazev "Horní Lhota" --druh obec --popis "…" --lat 49.43 --lon 15.22
rdb.py misto nazev horni-lhota "Ober-Lhotta" --jazyk de
rdb.py misto udalost horni-lhota "Ves poprvé zmíněna v listině…" --rok 1352 --jistota lit --zaznam <klic literatury>
```
Farnost, panství a dnešní obec patří do `--popis` (vlastní pole API nemá). Souřadnice dohledá `mista.py`/`mista_domy.py`.

## Dům – `rdb.py dum pridej <soubor.json>` (JSON podle HouseIn; uvedené seznamy se nahradí). Jen pár polí: `rdb.py dum uprav <klíč> <json>`
```json
{"placeSlug": "horni-lhota", "cp": "12", "name": "", "kind": "chalupa", "certainty": "doc",
 "description": "…", "lat": 49.432, "lon": 15.219, "note": "",
 "numbers": [{"period": "1771–1827", "number": "čp. 21 (?)"}, {"period": "od 1827", "number": "čp. 12"}],
 "events": [{"year": 1890, "text": "Sčítání lidu: 7 osob, hospodář …", "certainty": "doc", "recordKey": "lhota_scitani_cp12_1890"}],
 "holders": [{"name": "Jan Novák", "personId": "jan-novak-1760", "fromText": "1786", "toText": "1820",
              "how": "koupě od otce za 300 zl.", "certainty": "doc", "recordKey": "lhota_grunt_cp12_novak_1786", "note": ""}],
 "inhabitants": [{"name": "Anna Nováková", "personId": null, "yearsText": "1857–?", "role": "dcera hospodáře",
                  "facts": "* 1857 Horní Lhota 12", "certainty": "doc", "recordKey": "…"}]}
```
- Klíč domu = `<slug místa>-<čp>` (`horni-lhota-12`); bez `--klic` ho API odvodí. Stránka domu je v aplikaci.
- **Pozor:** uvedené seznamy (`numbers`, `events`, `holders`, `inhabitants`) se **celé nahradí**. Před úpravou
  `rdb.py dum ukaz <klic> --json`, uprav a pošli celé (vynechaný seznam zůstane beze změny).
- `fromText` / `toText` / `yearsText` jako text: „1352“, „22. 7. 1352“, „asi 1600“, „před 1654“; řadí se podle prvního roku.
- `events`: stavba, požár, přestavba, dělení gruntu, prodej, sčítání (shrnutí domácnosti), válka, elektrifikace…
- `holders`: jeden řádek = jeden držitel (u manželů „Jan a Marie Novákovi“), `how` = koupě / dědictví / přiženění / dražba / přídělem.
- `inhabitants`: lidé, kteří v domě žili (i výměnkáři, čeleď, nájemníci), `facts` krátká fakta (`*`, `×`, `†`).
  **Žijící jen jméno** (soukromí). Je-li člověk v grafu osob, vyplň `personId` a k osobě přidej bydliště
  (`rdb.py bydliste pridej <osoba> --dum <klic> --cp 12 --od … --do … --zaznam …`).
- `numbers`: všechna čísla domu v čase (období, číslo). Ztotožnění doložit v `events` nebo `note`.
- Otevřené otázky: `rdb.py otazka pridej "Kdy dům dostal číslo 12?"`.

## Zápisy z pramenů a svazky
Zápis i se svazkem nejlépe jedním `rdb.py nalez <json>` (tvar v `reference/data.md`), jinak:
```
rdb.py svazek pridej trebon_123456 --archiv "SOA Třeboň – SOkA Pelhřimov" --portal digi.ceskearchivy.cz \
  --nazev "Sčítání lidu 1890, Horní Lhota" --popis "Horní Lhota" --url "…"
rdb.py zaznam pridej lhota_scitani_cp12_1890 pracovni/zaznam.json
```
```json
{"volumeKey": "trebon_123456", "imageNo": 65, "kind": "S", "dateText": "1890",
 "title": "Sčítání lidu 1890, Horní Lhota čp. 12", "summary": "Hospodář Jan Novák (* 1830), manželka Marie, 4 děti, čeledín…",
 "url": "https://digi.ceskearchivy.cz/…", "transcriptOrig": "[Číslo domu] 30\n[Jméno] …", "transcriptCs": "Překlad celou větou…",
 "review": "ke_kontrole"}
```
- Klíč zápisu: malá písmena bez diakritiky, `obec_druh_cp_kdo_rok` (druh: krest, snatek, umrti, scitani, grunt, katastr,
  mapa, kronika, kniha…).
- `kind`: N křest, O sňatek, Z úmrtí, I rejstřík, S sčítání, G gruntovní / pozemková kniha, K katastr, M mapa,
  C kronika (cizí pramen), L literatura, J jiný. U literatury (`L`) je `imageNo` strana a `url` odkaz do Krameria / Google Books.
- Svazky matrik registrují stahovače (`trebon.py svazek`, `mza.py svazek`…). Gruntovní knihy: „Velkostatek Kamenice,
  gruntovní kniha Horní Lhota 1650–1780, inv. č. …“.
- Přepis `transcriptOrig` po sloupcích s `[Názvem sloupce]`, nejisté „(?)“, nečitelné „[…]“; u gruntovních knih vysvětli
  staré pojmy (kopa, vejrunk, výminek, závdavek) v `transcriptCs`. Úprava: `rdb.py zaznam uprav <klic> --prepis <soubor>`.
- Výřez ke každému zápisu: `vyrez.py <snímek> <klic> x0,y0,x1,y1` (nahraje ho), rámeček `ramecek.py`.

## Staré mapy a letecké snímky
Mapa = `rdb.py api POST mapy '{"title": "Stabilní katastr – císařský otisk", "year": 1827, "source": "ČÚZK, Archiv ČÚZK,
císařský otisk B2/a/6C 570, list 4", "url": "https://ags.cuzk.gov.cz/archiv/", "description": "Čp. 12 je dřevěný dům…",
"groupName": "ves"}'` a obrázek `rdb.py api PUT mapy/<id>/obrazek --binarni pracovni/vyrezy/<soubor>.jpg`
(obrázek nejdřív zmenši/ořízni přes `vyrez.py <soubor> <klic> … --bez-nahrani`). Série IPR Praha založí `ipr_praha.py --zapsat`.
- `groupName`: mapy se **stejným výřezem krajiny** (stejná oblast, sever nahoře, stejné měřítko) mají stejnou
  skupinu – web je umí prolínat. Mapy s jiným výřezem skupinu nemají. **Snímky obrazovky od uživatele (geoportál,
  Mapy.cz) skupinu nedostávají** (jiný výřez a měřítko). Pro porovnání stáhni sérii se stejným bbox
  (WMS/ArcGIS export, `cuzk_archiv.py mapa` se stejným poloměrem).
- `source` povinně (autorská práva); je vidět na webu – žádné TODO ani pracovní poznámky.
- `year` jako číslo (1827); „asi 1840“ → 1840 a „asi“ do popisu.
- Úprava existující mapy (popis, skupina) API zatím neumí – zatím v aplikaci.

## Další body na mapě (kaple, mlýn, sousední ves)
`mista_domy.py pridej "Kaple na návsi" ["dotaz"] ["popis"]` – založí místo (druh `bod`) a dohledá polohu; jinak
`rdb.py misto pridej <slug> --nazev … --druh vira|pamatka|remeslo|verejne|ves|jine --popis … --lat … --lon …`.
- `--druh` – barva a skupina v legendě: `vira` (kaple, kostely), `pamatka` (kříže, pomníky), `remeslo` (mlýny, hamry,
  kovárny), `verejne` (škola, hospoda), `ves` (sousední vsi), jinak `jine`.
- `--popis` 1–3 věty pro hosta: co to je a proč to patří k dějinám obce. Nejistotu přiznej. Je-li poloha jen odvozená,
  napiš do popisu, odkud je (zvláštní příznak „přibližně“ ani odkaz z bubliny API zatím nemá).
- Okolní místa jen do ~5 km. Přejmenovat = `rdb.py misto pridej <slug> --nazev "Nový název"` (slug zůstává).

## Fotky a dokumenty
`rdb.py api POST dokumenty '{"title": "Čp. 12 kolem 1935", "description": "Fotka od paní X.", "houseKeys": ["horni-lhota-12"],
"groupName": "tehdy", "sort": 1, "hidden": false}'` → id, pak obrázek `rdb.py api PUT dokumenty/<id>/obrazek --binarni <soubor.jpg>`
(max 4 MB; zmenši přes `vyrez.py … --bez-nahrani`). `hidden: true` = na web nedávat. Dvojice „tehdy – dnes“ a úprava
existujícího dokumentu API zatím nemá – zatím v aplikaci.

## Texty, deník, vodítka
- Deník bádání (i neúspěšné hledání): `rdb.py denik pridej "<co>" --vysledek nalezeno|nenalezeno|castecne|nedostupne --svazek <klic>
  --snimky "snímky 30–45" --text "rozsah, hledané varianty"`; před hledáním `rdb.py denik hledej <text>`.
- Zajímavosti a příběhy: `rdb.py pribeh uloz <slug> pracovni/<slug>.md --titulek … --druh zajimavosti|pribeh_domu|pribeh --dum <klic>`
  (`pribehy.md`). Odkazy v textu: `[čp. 12](/dum/<klic>/)`, `[zápis](/zdroj/<klic>/)`.
- Pamětníci a majitelé: `rdb.py voditko pridej "<co řekl>" --od-jmena "<kdo>" --kanal "rozhovor"` (jistota `fam`).
- Co jde jen v badatelně: `rdb.py ukol pridej "Badatelna: <archiv> – <co>" --druh badatelna --text "fond, inv. č., co hledat"`.
