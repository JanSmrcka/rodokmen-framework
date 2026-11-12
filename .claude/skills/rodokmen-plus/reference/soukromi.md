# Soukromí, etika a cizí služby

## Žijící lidé
- Na webu jen jméno a rok narození – aplikace žijící osoby sama ořeže (bez přihlášení jako správce). Neukládej
  k žijícím do veřejných polí (`note`, příběhy) nic víc; soukromé věci jen do `notePrivate` (`rdb.py osoba uprav <id>
  --pozn-soukroma …`, vidí jen admin), citlivá vodítka s `--citlive`. Žádné adresy, telefony, rodná čísla,
  zdravotní údaje, rozvody, nemanželské děti u žijících či nedávno zemřelých bez souhlasu rodiny.
- Citlivé věci z nedávné minulosti (sebevraždy, věznění, nemoci) – zeptej se uživatele, jestli a jak je zmínit.
- Matriční údaje starší než lhůty jsou veřejné, ale ohleduplnost platí i pro ně (zbytečně nezesměšňovat).

## Před zveřejněním webu projdi s uživatelem
Projdi texty z posledních ~100 let (sebevražda, nemoc, rozvod, dluhy, nemanželské dítě…), které jdou na web –
poznámky osob, otázky, boční příbuzní, zajímavosti a příběhy (`rdb.py hledat <slovo>`, `rdb.py pribeh ukaz …`).
Co uživatel neschválí, přesuň do `notePrivate` nebo z textu vypusť. (`rdb.py kontrola` citlivé texty zatím nehlídá.)
Údaje z rodinného stromu (GEDCOM) a od rodiny bývají právě takové – pro výzkum ano, na web jen se souhlasem.
1. Seznam žijících osob na webu a co o nich web říká.
2. Rodinné fotky a dokumenty – souhlasí ti, kdo jsou na nich (nebo jejich rodina)?
3. Účty – kdo z rodiny má přístup (účty založí správce; hesla se ukážou jen jednou).
4. Kontakt na webu – chce tam uživatel svůj e-mail?
Teprve pak zveřejnit (`web.md`).

## Placené a cizí služby (MyHeritage, Ancestry, Geni, FamilySearch)
- Přihlášení, platby a předplatné řeší **jen uživatel**. Zkušební verze se po skončení automaticky platí – připomeň,
  kdy končí a kde ji zrušit.
- **Žádné hromadné procházení ani stahování.** Skutečná zkušenost: automatické stažení ~180 záznamů z MyHeritage vedlo
  k zablokování účtu „kvůli možnému zneužití“ – uprostřed placené zkušební doby. Čti jen jednotlivé záznamy,
  které jsou potřeba, tempem člověka; raději požádej uživatele o export (GEDCOM) nebo o konkrétní stránky.
- Údaje odtud jsou stav `mh` a vždy se ověřují v matrikách.

## Archivní portály
Jsou zdarma a veřejné, ale servery mají omezené síly: stahuj jen snímky, které opravdu čteš, žádné celé svazky naráz,
paralelně maximálně pár požadavků. Citace vždy až na úroveň snímku (aby to šlo zkontrolovat).

## Data a sdílení
Data jsou v databázi (ne v gitu); repo obsahuje jen aplikaci a nástroje. Přesto **jen soukromé (private) repo** –
`pracovni/`, `.env` (token!) a zálohy DB do gitu nepatří. Token nikomu neposílej a nevkládej do textů.
