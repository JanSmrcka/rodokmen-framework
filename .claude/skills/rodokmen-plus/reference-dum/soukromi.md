# Soukromí, etika a cizí služby

## Žijící lidé a dnešní majitelé
- Dům má dnešního majitele a sousedy. Na web **nedávej** jména žijících obyvatel, dnešní vlastníky z katastru,
  rodná čísla, dluhy a zástavy z listu vlastnictví bez souhlasu. Kdo dům koupil po ~1950, uveď jen se souhlasem.
- Obyvatelé posledních ~100 let: jen jméno a role, žádné podrobnosti (u osob ve stromu žijící ořeže aplikace; v `inhabitants` domu hlídej sám). Soukromé poznámky jen do `notePrivate`.
- Citlivé věci (konfiskace 1945, odsun, kolektivizace, soudní spory, dražby z 20. století) se týkají rodin, které
  možná ve vsi pořád žijí. Zeptej se uživatele, jestli a jak je zmínit.
- Ústní podání sousedů: zapiš, kdo to řekl, ale na web dej jméno pamětníka jen s jeho souhlasem.

## Mapy a fotky
- U každé mapy a fotky uveď zdroj (u mapy pole `source`). Mapy ČÚZK jsou volné s uvedením zdroje.
  Fotky od sousedů a z cizích webů jen se souhlasem autora nebo s uvedeným zdrojem a jen na neveřejný web.

## Před zveřejněním webu projdi s uživatelem
1. Co web říká o žijících lidech a dnešních majitelích.
2. Fotky (souhlasí ti, kdo jsou na nich, a autoři?).
3. Účty – kdo má přístup (`reference/web.md`).
4. Kontakt na webu.
Teprve pak zveřejnit.

## Placené a cizí služby (MyHeritage, Ancestry, Geni, FamilySearch)
- Přihlášení, platby a předplatné řeší **jen uživatel**. Zkušební verze se po skončení automaticky platí – připomeň,
  kdy končí a kde ji zrušit.
- **Žádné hromadné procházení ani stahování.** Skutečná zkušenost: automatické stažení ~180 záznamů z MyHeritage vedlo
  k zablokování účtu „kvůli možnému zneužití“ – uprostřed placené zkušební doby. Čti jen jednotlivé záznamy,
  které jsou potřeba, tempem člověka; raději požádej uživatele o export (GEDCOM) nebo o konkrétní stránky.
- Údaje z cizích rodokmenů jsou nanejvýš `prob` a vždy se ověřují v pramenech.

## Archivní portály
Jsou zdarma a veřejné, ale servery mají omezené síly: stahuj jen snímky, které opravdu čteš, žádné celé svazky naráz,
paralelně maximálně pár požadavků. Citace vždy až na úroveň snímku (aby to šlo zkontrolovat).

## Data a sdílení
Data jsou v databázi, ne v gitu. Repo přesto **jen soukromé (private)** – `pracovni/`, `.env` (token!) a zálohy DB do gitu nepatří.
