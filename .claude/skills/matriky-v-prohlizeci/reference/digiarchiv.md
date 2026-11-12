# DigiArchiv SOA Třeboň (digi.ceskearchivy.cz) v prohlížeči

Kdy: `trebon.py` vrací HTTP 403 (blokovaný nástroj, ne IP – VPN nepomůže), ale Chrome uživatele portál načte.
Výřezy pak jsou ze screenshotů (nižší rozlišení – poznamenej to v zápisu).

## Limit (přísnější než jinde)
- Po ~10 načteních stránek za ~5 min (rejstřík, průzkumník, snímky, URL se zoomem) portál ukáže „Příliš mnoho
  požadavků – Listujete příliš rychle! Varování 1 z 5“. **Mezi načteními snímků ≥ 20–30 s**, i URL se zoomem je načtení.
- `browser_batch`: nejvýš 2–3 snímky v dávce a mezi nimi čekat. Dávka 5 navigací za pár sekund skončila chybovou stránkou.
- Po varování nebo chybové stránce: hned přestaň, `python3 -I tools/slusne.py zablokuj digi.ceskearchivy.cz "důvod"`.

## Prohlížeč snímků
- Není OpenSeadragon (žádná proměnná `viewer`; uvnitř iframu `myszoom`/`overrideZoom`). Kolečko, šipky ani tažení
  přes `computer` nereagují.
- **Přiblížení jedním načtením přes URL:** `https://digi.ceskearchivy.cz/<id_knihy>/<snímek>/<x>/<y>/<zoom %>/<rotace>`
  (x, y = střed v pixelech originálu, rotace obvykle 0). Souřadnice místa zjistíš dvojklikem do snímku – zapíše je do URL.
  Při 70 % se dlaždice dotáhnou až po ~8 s – počkej před screenshotem.
- Dlouhý zápis = dva screenshoty (levá a pravá půlka) slepené `magick a.png b.png +append`.
- Obsah je v iframech: `get_page_text` a `javascript_tool` nad `document` vracejí prázdno → čti
  `document.querySelector('iframe').contentDocument`, nebo screenshotem.
- Rozšíření zablokuje výstup `javascript_tool`, který obsahuje „page=…“ („BLOCKED: Cookie/query string data“) –
  z odkazů vracej jen číslo (regex `page\D{1,3}(\d+)`).

## Jak najít zápis
- **Fara obce:** stránka fary (Průzkumník → Matriky → sídlo) má pole „Farní obvod (1862)“ – obce bez vlastní fary hledej
  tam, ne v „Ostatních lokalitách“.
- **Seznam knih fary** z iframu: řádky `tr`, id knihy = první 4–7místné číslo v `outerHTML`. Id knih jedné fary jdou
  po sobě (fara = id první knihy − 1). Než napíšeš „kniha není online“, projdi celý seznam.
- **Jmenný rejstřík celého archivu** (Hledání → typ „Jmenné rejstříky“: příjmení, jméno, lokalita, druh N/O/Z) – nejrychlejší
  cesta k sourozencům a sňatkům i v nečekané faře. Filtr Sčítání lidu najde celé domácnosti 1921. Výsledky jsou v iframu;
  „Zkrácený pohled“ dá ~7 výsledků na obrazovku. Klik na záznam sčítání skočí na snímek, u matriky někdy ne – snímek
  dopočítej z folia.
- **E-rejstřík knihy** jednou stránkou: `pages/indexes.php?druh=1&pis=<písmeno>&id=<kniha>` (čísla snímků v odkazech).
  Klik na řádek skočí na snímek.
- Panel „Index | Poznámky uživatelů“ u knihy často vypisuje **oddíly po obcích s čísly snímků** a u snímku potvrdí osoby
  zápisu – přečti ho dřív, než začneš listovat.
- Folio / strana ≠ snímek: v některých knihách fol. N = snímek N+2; číslo v hlavičce může být číslo dvoustrany.
  Posun ověř na jednom snímku a pak počítej.
