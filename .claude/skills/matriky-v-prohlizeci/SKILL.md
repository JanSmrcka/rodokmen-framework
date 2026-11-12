---
name: matriky-v-prohlizeci
description: Čtení snímků matrik, sčítacích operátů a map z archivních portálů, které jdou jen v prohlížeči (ALTCHA, CAPTCHA, přihlášení, JavaScriptový prohlížeč snímků) – v Chromu uživatele přes claude-in-chrome, šetrně a bez obcházení ochrany. Použij, když stahovací nástroj (mza.py, aron_img.py…) selže s „na stránce chybí seznam snímků“, 403 nebo ověřením, když portál ukáže ALTCHA/CAPTCHA, když se čte MZA Brno (Acta Publica, sčítací operáty, indikační skici Moravy), FamilySearch nebo digi.ceskearchivy.cz v prohlížeči, nebo když v jednom Chromu pracuje víc agentů. Spouštěcí fráze: „ALTCHA“, „CAPTCHA“, „MZA“, „Acta Publica“, „přečti to v prohlížeči“, „nástroj nefunguje“, „FamilySearch“.
---

# Matriky v prohlížeči uživatele

Některé portály od roku 2026 pouštějí ke snímkům jen prohlížeč, který projde ověřením (MZA Acta Publica: ALTCHA, proof-of-work).
Nástroje bez prohlížeče pak selžou. Řešení je **číst v Chromu uživatele jako člověk**: jedna stránka, zoom, screenshot,
pauza. Ochranu nikdy neobcházej. Ban dopadne na IP uživatele a často na všechny jeho agenty najednou.

Patří ke skillu `rodokmen-plus` (zápis nálezu, výřez, rámeček, deník). Portálová specifika: MZA `reference/mza.md`,
DigiArchiv SOA Třeboň `reference/digiarchiv.md`.

## Kdy přejít do prohlížeče
- Nástroj hlásí „na stránce chybí seznam snímků“, „ALTCHA“, HTTP 403 na stránku detailu, nebo HTML obsahuje `altcha-widget`.
- Nástroj dostává HTTP 403 hned od začátku, ale Chrome portál načte (eBadatelna, Třeboň, Porta fontium) = blokovaný je
  nástroj (User-Agent), ne IP; VPN nepomůže → prohlížeč.
- Portál nemá API ani nástroj (prohlížeč snímků v JavaScriptu, mapové aplikace).
- Uživatel je na portálu přihlášený (FamilySearch, DNNT) a ty potřebuješ jeho session.

Předtím zkus, jestli to nejde jinak: jiný nástroj nebo jiný endpoint, který portál **veřejně a bez ověření** nabízí
(u MZA dlaždice Deepzoom sčítacích operátů, viz `reference/mza.md`). „Jinak“ nikdy neznamená obejít ověření
(řešit ALTCHA skriptem, kopírovat cookie nebo tokenovou URL do curl).

## Příprava
1. Načti skill `claude-in-chrome` a nástroje jedním ToolSearch:
   `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__get_page_text,mcp__claude-in-chrome__tabs_close_mcp`.
2. **Správný profil.** Má-li uživatel víc profilů Chromu, každý se hlásí jako samostatný prohlížeč s vlastním `deviceId`.
   Názvům („Browser 1“) nevěř, vyber podle `deviceId`, který ti uživatel dal nebo který je zapsaný v `CLAUDE.md` projektu.
   Špatný profil = nepřihlášená session. Zeptej se, když nevíš.
3. **Souhlas.** Prohlížeč patří uživateli. Řekni mu, že budeš otevírat vlastní záložky a jak dlouho to zhruba potrvá.

## Záložky
- Vždy si otevři **vlastní novou záložku** (`tabs_create_mcp`), zapamatuj si `tabId` a pracuj jen v ní.
- **Před každým snímkem ověř URL záložky** (id knihy, číslo snímku). Je-li tam cizí kniha, záložku sdílíš s jiným
  agentem: v ní nepokračuj, založ novou.
- Cizí záložky nezavírej a nenaviguj. Svou na konci zavři.
- Screenshoty a pomocné soubory ukládej do svého pracovního adresáře (`pracovni/<úkol>/`), ne do sdíleného scratchpadu.

## Limity a čekání (závazné)
| portál | limit |
|---|---|
| MZA Acta Publica | **1 snímek / 30 s na agenta**, ~1 / 10 s za všechny agenty dohromady; nejvýš 2 agenti současně |
| FamilySearch | 1 dotaz / 15 s; výsledky se načítají ~5 s |
| digi.ceskearchivy.cz (DigiArchiv) | **1 načtení / 20–30 s** (po ~10 za 5 min „Listujete příliš rychle“), viz `reference/digiarchiv.md` |
| ndk.cz (DNNT) | jen pár dotazů za sezení, s rozestupy – dávka ~10 dotazů nástrojem skončila banem IP (`ndk.cz/bana`) |
| Porta fontium | fulltextové hledání: po ~150 snímcích za sezení 403 a blokace 30 min |
| ostatní (ČÚZK, RÚIAN, ZA Opava) | 1 požadavek / 2–5 s |

- „Snímek“ = každé načtení stránky nebo snímku, i jen kvůli metadatům (i nové URL se zoomem).
- `browser_batch`: nejvýš 2–3 snímky v dávce, mezi nimi `wait`. Celá dávka navigací bez pauz = chybová stránka.
- Čekej skutečně: `python3 -c "import time; time.sleep(30)"` (v některých prostředích je `sleep` v Bashi blokovaný),
  nebo `computer` s akcí `wait`. Kratší mezery nejsou v pořádku, ani „jen tentokrát“.
- Odpověď 403, 429, 503, stránka „blocked“ nebo opakovaná ALTCHA = **hned přestaň**, zapiš
  `python3 -I tools/slusne.py zablokuj <web> "důvod"` a řekni to uživateli. Pokračuj jiným pramenem.

## Zakázáno
- **Smyčky**: `fetch`/XHR ve `javascript_tool` ve smyčce, `Promise.all` na dotazy, hromadné načítání stránek
  (ani HTML bez obrázků), skripty, které listují samy. Každý požadavek je ruční krok s pauzou. Hook `hlidac.py`
  smyčky v prohlížeči nevidí – hlídáš je ty. (Skutečný případ: jeden agent načetl smyčkou ~100 stránek MZA a portál
  byl přes noc nedostupný pro všechny.)
- **Obcházení ověření**: řešení ALTCHA/CAPTCHA skriptem, klikání na CAPTCHA, přenos cookie nebo podepsané URL
  snímku do `curl`/Pythonu, stahování snímků mimo prohlížeč z portálu, který je za ověřením chrání.
- Zadávání hesel a přihlašování za uživatele.

ALTCHA, která neprojde sama (widget se točí, žádá kliknutí), = zastav a řekni uživateli, ať stránku otevře a ověří sám.

## Čtení snímku
1. Otevři stránku snímku (u MZA skok URL na číslo snímku, viz `reference/mza.md`). Počkej, až se snímek načte.
2. **Nejdřív přibliž, pak screenshot.** Celostránkový screenshot na jména nestačí. Prohlížeče snímků jsou většinou
   OpenSeadragon (DigiArchiv ne – tam zoom přes URL, `reference/digiarchiv.md`) – zoom jedním příkazem (bez nového požadavku na stránku, dlaždice se dotáhnou samy):
   ```js
   const v = (window.g_viewer || window.viewer).viewport;
   v.fitBounds(new OpenSeadragon.Rect(x, y, w, h));   // souřadnice v jednotkách obrázku: šířka = 1
   ```
   nebo `v.zoomTo(3); v.panTo(new OpenSeadragon.Point(0.3, 0.4))`. Jméno proměnné prohlížeče zjistíš
   `Object.keys(window).filter(k => /viewer/i.test(k))`. Počkej 2–3 s na dlaždice, pak `computer` → `screenshot`.
3. Na dlouhý zápis udělej 2–3 přiblížené screenshoty (levá a pravá půlka řádku) – nahrazuje `overit.py`.
4. U každého prošlého snímku si poznamenej, co na něm **skutečně** je (rok, první jméno, číslo domu). Bez toho se
   přehlédne, že se snímek nenačetl nebo že kniha skočila jinam.
5. Nejisté čtení není negativní výsledek – zapiš ho jako nejisté „(?)“ s výřezem.

## Výřez a rámeček ze screenshotu
Snímek v plném rozlišení z portálu za ověřením nemáš, výřez je ze screenshotu:
1. Ulož screenshot do `pracovni/<svazek>/sn<číslo>_zoom.png` (případně slep půlky `magick a.png b.png +append`).
   Screenshot se `save_to_disk` je zmenšený podle `scale` – pro výřez ho dělej **bez `scale`** (plné rozlišení obrazovky).
2. `python3 -I tools/vyrez.py pracovni/<svazek>/sn<číslo>_zoom.png <klíč> x0,y0,x1,y1` – velkoryse, s hlavičkou sloupců.
3. `python3 -I tools/ramecek.py <klíč> x0,y0,x1,y1` – **rámeček jen kolem čteného zápisu, ne kolem celého výřezu**.
   Prohlédni si `pracovni/ramecek_<klíč>.jpg`. Rámeček přes celý obrázek je chyba, kterou hlídej i při review.
4. V deníku (`rdb.py denik pridej`) a v zápisu (`summary` / poznámka, pole `url` = trvalý odkaz na snímek) uveď, že výřez je
   ze screenshotu prohlížeče (a zoom). Zápis musí v DB existovat dřív než výřez (`rdb.py nalez …`).

## Portály
- **MZA Brno** – Acta Publica (matriky, indexy), sčítací operáty, indikační skici: `reference/mza.md`.
- **digi.ceskearchivy.cz** (SOA Třeboň): primárně `tools/trebon.py`; když vrací 403 nebo knihu nezná, prohlížeč –
  `reference/digiarchiv.md` (zoom přes URL, iframy, jmenný rejstřík archivu, přísný limit).
  Trvalý odkaz `https://digi.ceskearchivy.cz/<id_knihy>/<snímek>`.
- **ZA Opava** (digi.archives.cz/da/): úvodní „Probíhá ověření přístupu“ projde samo (~10 s). Filtr Matriky + „Datum od“
  zabere až po novém hledání (Enter v poli dotazu), ne hned kliknutím na lupu. Velikost stránky výsledků (50) jde
  nastavit `form_input` na select. Snímky přepínej selectem čísla snímku vlevo nahoře (ref se po načtení mění –
  hledej ho znovu). „Technická poznámka: matrika je dosud uložena na matričním úřadě“ v detailu svazku = není online –
  čti ji dřív, než otevřeš snímky. Rejstříky ČS církve bývají samostatné knihy po písmenech (I-N/I-O/I-Z).
  Nástroj a limity: `rodokmen-plus/reference/portaly.md` → ZA Opava.
- **FamilySearch** (uživatel přihlášen): hledání
  `https://www.familysearch.org/search/record/results?q.surname=X&q.givenName=Y&q.anyPlace=Czech`
  (+ `q.birthLikeDate.from/to`, `q.marriageLikeDate.from/to`). Po otevření **počkej ~5 s** (`computer` → `wait`),
  teprve pak `get_page_text`. **Past falešné nuly:** dokud se výsledky načítají, stránka ukazuje „0 výsledků“ –
  nula zapsaná po 1 s není výsledek. Když je nula, počkej a přečti znovu.
  Užitečné sbírky: „Czech Republic, Marriages, 1654–1889“ (indexované sňatky), „Czech Republic, Church Books“.
  Pokrytí je nerovnoměrné – prázdný index nic nevylučuje. **Index je jen hypotéza**: nález ověř na snímku matriky
  a teprve pak `doc`; do té doby `HYPOTEZY` s odkazem na záznam FS.
- **Mapové a jiné aplikace bez API** (nahlizenidokn, gis.cenia.cz, staré mapy): stejná pravidla – jedna akce, pauza,
  screenshot. Velké mapy po dlaždicích obrazovky, ne skriptem.

## Brief pro pomocníka v prohlížeči
Pomocníky v prohlížeči pouštěj nejvýš dva naráz (sdílejí limit portálu i Chrome). Do zadání vlož celé sekce
„Záložky“, „Limity a čekání“, „Zakázáno“ a „Čtení snímku“ a konkrétní příkaz na čekání. Úplná šablona je ve skillu
`paralelni-badani`.
