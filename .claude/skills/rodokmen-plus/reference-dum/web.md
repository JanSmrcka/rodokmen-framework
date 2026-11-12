# Web – dějiny domu

Web je Next.js aplikace `aplikace/`, která čte data **přímo z databáze** – žádný export, co zapíšeš přes `rdb.py`,
je na webu hned. Příkazy, nastavení, účty a zveřejnění jsou společné s rodokmenem: `reference/web.md`.
Starý Astro web `web/` (`domy.py`, `mista.json`, `export_web*.py`) je zastaralý.

Co web o domech ukazuje a odkud to bere:
- **Obec** – místo (`rdb.py misto ukaz <slug>`): názvy v čase, popis, časová osa (`rdb.py misto udalost`).
- **Dům** – `rdb.py dum ukaz <klic>`: čísla v čase, časová osa, držitelé, obyvatelé, bydliště osob, fotky a prameny.
- **Staré mapy** – mapy se stejnou skupinou (`groupName`) jdou prolínat (`data.md` → Staré mapy).
- **Mapa** – domy a místa se souřadnicemi (`lat`/`lon`), barva podle druhu místa (`--druh`). Polohu domu najde
  `mista_domy.py hledej` / `ruian`, uloží se do domu (`rdb.py dum pridej`, pole `lat`/`lon`) nebo místa (`rdb.py misto pridej`).
- **Příběhy a zajímavosti** – `rdb.py pribeh …` (`pribehy.md`), **prameny** – zápisy s výřezem, rámečkem, přepisem
  a překladem, **deník** a **otázky** z DB.

Vzhled aplikace upravuj jen na přání uživatele (kód v `aplikace/`) a po úpravě zkontroluj web na mobilu i počítači.
