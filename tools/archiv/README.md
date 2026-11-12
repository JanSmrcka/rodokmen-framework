# tools/archiv – nástroje starého souborového formátu

Projekt přešel na databázi (Postgres) a API (`tools/rdb.py`, `tools/rdb_klient.py`). Tyto nástroje pracují se starými
soubory v `data/` (`osoby.py`, `*.json`, `*.md`) a jsou tu **jen pro jednorázový import starých dat do DB** – pak smazat.

- `graf.py`, `graf_pravidla.pl`, `migrace_graf.py`, `prevod_odkazu_id.py` – čtení / převody grafu osob z `data/osoby.py`
- `kontrola.py`, `kontrola_domy.py` – kontrola starých dat (nová kontrola: `rdb.py kontrola`)
- `zapis.py` – zápis do `data/*.json` (nově `rdb.py …`)
- `export_web.py`, `export_web_domy.py` – export pro Astro `web/` (aplikace čte DB přímo)
- `novy_projekt.py` – založení projektu ze šablony skillu (starý formát; nepoužívat)

## Import do DB

```bash
python3 -I tools/archiv/export_pro_import.py            # data/, vyrezy/, zdroje/ → pracovni/import/data.json
cd aplikace && npm run import -- --nanecisto             # zkouška: vše proběhne, nic se neuloží, vypíše varování
npm run import                                           # import do prázdné DB (DATABASE_URL); lokálně opakovaně: --reset
```

Fakta osob (volný text) se převedou na události: původní text zůstane v `text`, k tomu se dopočítá rok, místo a dům.
Zápis osoby (`r`) se přiřadí k události stejného druhu a roku (N → narození, O → sňatek, Z → úmrtí), zbytek jako zmínka.
Kmotři a svědci jsou role v zápisu, údaje od rodiny jsou vodítka, deník jsou záznamy deníku, `STAV.md` a
`archivni_dotazy.md` jsou úkoly.

Cesta ke kořeni projektu je upravená o úroveň výš (`tools/archiv/` → kořen). Nic z toho nepoužívej pro nová data.
