# MZA Brno (Moravský zemský archiv) – matriky, sčítání, indikační skici

Stav k listopadu 2026. MZA mění servery – když něco nesedí, ověř to v prohlížeči a zapiš do `poznamky_pro_skill.md`.

## Acta Publica – matriky (www.mza.cz/actapublica)
- Pokrývá jižní Moravu a část Vysočiny. Obce na Litovelsku a Olomoucku patří pod ZA Opava.
- **Od 2. 11. 2026 je stránka `matrika/detail/<id>` za ověřením ALTCHA** (widget `altcha-widget`, POST `altcha/verify`,
  pak reload). `tools/mza.py info/snimek` pak hlásí „na stránce chybí seznam snímků“ (chybí `CreateSeadragon`).
  Čti v Chromu uživatele podle skillu `matriky-v-prohlizeci`. `mza.py hledat` a `mza.py matriky` (seznam knih obce)
  můžou dál fungovat – vyzkoušej jednou, při chybě do prohlížeče.
- Adresa actapublica.eu bývá za Cloudflare zablokovaná podle IP; používej www.mza.cz. Blokuje-li i ta, ať uživatel
  vypne VPN nebo zkusí jinou síť.
- **Id detailu není číslo knihy.** `<id>` v `…/matrika/detail/<id>` je interní; číslo knihy (signatura) je ve výpisu
  jinde. Odkaz „detail/<číslo knihy>“ vede na jinou knihu.
- **Skok na snímek URL:** číslo snímku je v názvu souboru (`…-0NNN0.jp2`, tedy snímek × 10, pět číslic); v prohlížeči
  jde snímek zvolit i v URL detailu, takže nelistuj po jednom.
- **Části knihy:** stránka detailu má seznam oddílů („oddaní (1785–1830) 201–250“, obce v oddílu). Skoč rovnou na
  správný snímek, neodhaduj podle roku. Ověř na prvním snímku oddílu druh knihy a roky.
- **Index dřív než listování.** Fary mají často samostatné indexy N/O/Z (v seznamu knih označené `i` nebo jako
  „index“). Bývají po písmenech a uvnitř chronologicky; odkaz v indexu typu „II 214“ = svazek II, pagina 214
  (pagina ≈ 2 × snímek). Dva snímky v indexu nahradí desítky v matrice a zároveň vyloučí, co tam není.
- Zoom: prohlížeč je OpenSeadragon (`g_viewer`), viz „Čtení snímku“ ve skillu.
- **Limit: 1 snímek / 30 s na agenta**, nejvýš 2 agenti, žádné smyčky. Noc s ~100 požadavky smyčkou = portál
  nedostupný do rána.

## Deepzoom – dlaždice obrazového serveru
Prohlížeč MZA tahá obrázky z `iipsrv` přes Deepzoom:
- Popis obrázku: `https://www.mza.cz/iipsrv/iipsrv.fcgi?Deepzoom=<cesta>.jp2.dzi` (`Width`, `Height`, `TileSize`).
- Dlaždice: `…?Deepzoom=<cesta>.jp2_files/<úroveň>/<x>_<y>.jpg` (nejvyšší úroveň = `ceil(log2(max(W,H)))`, dlaždice 256 px).
- Server vyžaduje **HTTP/2** (`curl --http2`; Python sám dostane HTTP 426). `FIF=…&CVT=jpeg` vrací 403,
  **IIIF od 2. 11. 2026 vrací 403** i v prohlížeči.
- Slepení: `magick` řádky `+append`, sloupce `-append`.
- **Jen pro sady, které nejsou za ověřením** (sčítací operáty, indikační skici). U matrik za ALTCHA dlaždice mimo
  prohlížeč nestahuj – bylo by to obcházení ověření. Vždy přes `tools/slusne.py` (limit), nikdy ve smyčce mimo nástroj.

## Sčítací operáty (www.mza.cz/scitacioperaty)
- Morava 1857–1921 (hlavně 1869, 1880, 1890, 1900, 1910, 1921), po obcích a číslech domů: celé domácnosti s roky
  a místy narození. Pomocníci často mylně tvrdí, že sčítání Moravy online není – je.
- Detail sady: `…/scitacioperaty/digisada/detail/<id>`; cesta k obrázkům je v `.dzi` odkazu v HTML.
- Nástroj: `python3 -I tools/slusne.py tools/scitani_mza.py …` (Deepzoom dlaždice jen pro požadovaný výřez, skládá
  `magick`); operát je svazek v DB (druh `S`, rok, obec, v `meta` údaje `cesta`, `prefix`, `signatura` přečtené z adresy
  snímku v prohlížeči MZA) – založení a použití viz hlavička `tools/scitani_mza.py`; volá se `scitani_mza.py <rok> <snímek> <out.jpg> --obec <slug>`.
- Pozor: v sadě bývá **vložený arch jiného domu**, který zakryje jména – čti hlavičku archu (obec, číslo domu) vpravo nahoře.
- Archy jdou podle čísel domů, ale ne vždy souvisle; číslo snímku domu najdeš z hlaviček sousedních archů.

## Indikační skici Moravy (www.mza.cz/indikacniskici)
- Detail: `…/indikacniskici/skica/detail/<id>`. Moravské indikační skici stabilního katastru (~1825–1835)
  **v Archivu ČÚZK nejsou** (`cuzk_archiv.py` je nenajde, i když `listy` vrátí kód skici) – jsou tady.
- Skica má čísla domů, půdorysy a **jména držitelů u parcel** – klíč k datování domu a k přečíslování.
- Odkazy na sčítací operáty i skici obce často uvádí článek o obci na cs.wikipedia (sekce Odkazy). Projdi ho hned na začátku.

## Další moravské zdroje
- Josefský katastr (1785–1789) a tereziánský katastr: MZA (část je online, hledej v katalogu archivu podle obce).
- Lánové rejstříky (1656–1679) a berní rula pro Moravu: edice v Krameriovi.
- Wolného „Die Markgrafschaft Mähren“ a „Kirchliche Topographie von Mähren“ (Kramerius, Google Books) – panství,
  fary, staré tvary obcí; Hosák–Šrámek – skill `ztotozneni-mist`.
