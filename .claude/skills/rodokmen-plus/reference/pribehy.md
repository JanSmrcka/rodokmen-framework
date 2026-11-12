# Zajímavosti a příběh rodu

Kvůli tomuhle rodina web čte. Tabulka jmen a dat nikoho nechytí, ale „prapradědeček se narodil 267 dní po svatbě“
nebo „rod žil sto let v jednom domě“ ano. Nečekej s tím až na konec výzkumu.

## Zajímavosti („fun facts“) – sbírej průběžně
Kdykoli při čtení zápisu narazíš na něco neobvyklého, **hned** to napiš jako krátký odstavec
do zajímavostí (návrh v `pracovni/zajimavosti.md`, uložení `python3 -I tools/rdb.py pribeh uloz zajimavosti
pracovni/zajimavosti.md --titulek "Zajímavosti" --druh zajimavosti`; nejdřív `rdb.py pribeh ukaz zajimavosti`, ať nic
nepřepíšeš) a řekni to uživateli jako příběh. Po každém větším kole spusť `python3 -I tools/napady.py`. Nástroj projde data
a vypíše náměty (svatby krátce před porodem, rod v jednom domě, sňatky příbuzných, dlouhověkost, epidemie…).
Každý námět si ověř v zápisu, než ho napíšeš.

Co bývá zajímavé (všechno z jednoho skutečného rodokmenu):
| Typ | Příklad, jak to napsat |
|---|---|
| Svatby na poslední chvíli | tabulka: svatba – dítě – za kolik dní (spočítej přesně); „přesná trefa“: narozen 267 dní po svatbě – počat nejspíš o svatební noci |
| Nemanželské děti, legitimace | „Jméno přežilo díky svobodné matce“ – příjmení se dědilo po matce; poznámka o legitimaci na okraji zápisu |
| Sto let v jednom domě | stejné číslo popisné přes 3–5 generací, kdo se v něm narodil a zemřel |
| Předek v rodokmenu vícekrát | děda a babička byli vzdálení příbuzní (tatáž osoba na dvou místech, `rdb.py pribuznost`) – kde se větve potkaly |
| Neobvyklá jména | křestní jméno po světici (a jak se jméno v matrikách zkomolilo) |
| Významní svědci a kmotři | radní, rychtář, farář, vrchnostenský úředník na svatbě obyčejného řemeslníka |
| Dispense | svatba s povolením od biskupa (příbuzenství, zákaz ohlášek, adventní doba) |
| Řemesla v rodě | krejčí, puškaři, ranhojič, sládek… jako jeden odstavec přes všechny rody |
| Osudy žen | dvakrát vdova během deseti let; služka, která si vzala o 25 let staršího vdovce |
| Děti, které brzy přišly o rodiče | matka zemřela po porodu, otec v epidemii – kdo děti vychoval |
| Epidemie a války | cholera 1831/1855/1866, prusko-rakouská válka 1866, španělská chřipka 1918 (příčina úmrtí v zápisu!) |
| Moderní doba | civilní sňatek na úřadě a povolení soudu pro nezletilou nevěstu; přestěhování do pohraničí po 1945 |
| Rodinné vyprávění vs. matrika | „rodina říkala Marie, ve skutečnosti Anna“; potvrzená rodinná pověst („babička byla ze statku“) |
| Ztracený začátek | kde linie končí a proč (shořelé knihy, nemanželské dítě bez otce) |
| Noviny | výstřižek o jmenování, vyznamenání, penzi, parte – jako rodinný dokument (`rdb.py api POST dokumenty …`, obrázek `rdb.py api PUT dokumenty/<id>/obrazek --binarni <soubor>`) |

Styl: nadpis `## Krátký a zvědavý`, 2–5 vět, konkrétní data a místa, odkazy na osoby `[Jméno](/osoba/<slug>/)`.
Nejlepší 2–4 dej na začátek (úvod webu je bere z příběhů).
Citlivé věci z 20. století (sebevraždy, nemoci, rozvody, nemanželské děti u nedávno žijících) piš jen se souhlasem
uživatele (`reference/soukromi.md`).

## Příběh hlavního rodu
**Hlavní rod** je rod výchozí osoby (rodné příjmení; rody: `rdb.py rod seznam --pro <id>`). Když uživatel chce jiný, přiřaď
příběh tomu rodu (`--rod <slug>`). Příběh se jmenuje **„Příběh <rodu ve 2. pádě>“** (Příběh Novákových, Příběh Dvořáků).
Má vlastní položku v menu a je hlavní věcí na úvodní stránce.

**Kdy psát:** jakmile má hlavní rod zhruba 5 generací doložených matrikou. Nečekej, až bude „hotovo“, protože příběh
jde později doplnit. Uživateli to nabídni, i když dřív řekl „až bude víc dat“.

**Postup:**
1. Sesbírej materiál: osoby hlavního rodu (`rdb.py predci`, `rdb.py osoba ukaz`), boční příbuzní, zajímavosti,
   vodítka od rodiny (`rdb.py voditko seznam --rod <slug>`), rodinné paměti a dokumenty, novinové výstřižky.
2. Napiš **koncept do chatu** a nech si ho schválit (délka, tón, co ano/ne). Pod koncept připiš, co je z matrik
   a co od rodiny, a co jsi vynechal jako citlivé. Teprve po schválení ho ulož.
3. Napiš text do `pracovni/pribeh-novakovych.md` (jen markdown těla, bez hlavičky):
   ```markdown
   ## Prolog v mlze (1700–1750)
   …
   ## Kováři z čísla 112 (1777–1874)
   …
   ```
   a ulož: `python3 -I tools/rdb.py pribeh uloz pribeh-novakovych pracovni/pribeh-novakovych.md --titulek "Příběh Novákových"
   --perex "Jedna věta, která chytí – od koho k komu příběh vede." --druh pribeh_rodu --rod novakove`.
   Úprava = stejný příkaz znovu (titulek a perex zůstanou, když je nezadáš). Na úvodní stránce se ukáže název a perex.

**Jak má vypadat** (osvědčený tvar, asi 800–1500 slov):
- Kapitoly po generacích, od nejstaršího předka k dnešku. Nadpis = člověk nebo jeho role + roky
  („Krejčí z Holic (asi 1756–1812)“, „Služka, která zachránila jméno“).
- Každá kapitola 1–3 krátké odstavce: kde žil, čím se živil, svatba, děti, něco lidského (zápis, svědek, nehoda, stěhování).
- Konkrétně: data, místa, čísla domů, citace ze zápisu v uvozovkách. Odkazy na osoby `[Jméno](/osoba/<id>/)`
  (id osoby z `rdb.py osoba hledej`).
- Názvy obcí: archiv a OpenStreetMap píší třeba „Veliš“, rodina a dnešní úřední podoba „Velíš“. Zeptej se, jakou podobu
  rodina používá, a drž ji v celém textu.
- Poctivě: co nevíme, napiš jako otázku nebo domněnku („nejspíš“, „podle rodiny“). Nic nevymýšlej kvůli plynulosti.
- Na konci kapitola o dnešku: jen jména a vztahy žijících, bez podrobností.
- Ostatní rody dostanou svůj prostor na stránkách rodů (popis rodu `rdb.py rod pridej … --popis`, hypotézy
  `rdb.py hypoteza pridej`) a v zajímavostech.
