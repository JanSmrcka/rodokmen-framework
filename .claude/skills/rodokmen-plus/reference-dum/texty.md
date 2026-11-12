# Jak psát texty na web

Čtenář není badatel. Je to host na chalupě, soused nebo vnuk, který si to čte na mobilu u kávy.
Chce vědět, kde je, kdo tu žil a co se tu stalo. Zdroj ho zajímá až potom (a ten ukazují štítky a odkazy).

## Platí pro všechno, co jde na web
Úvod a nastavení webu, popis obce a domů (`description`), události časové osy (`text`), poznámky (`note`),
zajímavosti, příběh, popisky map a fotek, shrnutí a překlady zápisů (`summary`, `transcriptCs`).

## Pravidla
1. **Nejdřív to zajímavé, pak podrobnosti.** „V roce 1871 shořela skoro celá ves.“ – ne „Podle zprávy v novinách Budivoj
   z 31. 8. 1871, která uvádí…“. Zdroj patří do odkazu na zápis (`recordKey`), web ho ukáže jako štítek.
2. **Krátké věty.** Jedna myšlenka na větu, ideálně do 20 slov. Dlouhé souvětí rozděl.
3. **Konkrétně.** Jména, roky, čísla, věci: „koza, pět slepic a husa“, „za 138 zlatých i s párem volů“.
4. **Bez žargonu.** Archivní slova buď nahraď, nebo vysvětli hned v té větě:
   | místo | piš |
   |---|---|
   | grunt, usedlost | statek, chalupa (u prvního výskytu „grunt – usedlost s poli“) |
   | držitel | majitel, hospodář |
   | reambulace | doplnění mapy |
   | indikační skica | pracovní mapa katastru se jmény majitelů |
   | stavební parcela 62 | (vynech, nebo „pozemek domu“) |
   | majitel bytu (ve sčítání) | hlava rodiny |
   | podruhyně | nájemnice bez vlastního domu |
   | výměnek, výminek | domek / světnice pro staré hospodáře, kteří předali statek dětem |
   | sn., fol., inv. č., signatury | nikdy v textu – jen v pramenech |
5. **Bez opakování.** Co říká nadpis nebo rok vlevo na časové ose, neopakuj v textu („Sčítání lidu 1890: …“ → „Rodina zedníka…“
   a štítek ukáže, že jde o sčítání).
6. **Nejistotu řekni lidsky.** „nejspíš“, „asi“, „nevíme, kdy přesně“ – ne „prob“, „(?)“ v běžném textu. Otazník v závorce
   jen u nejistého čtení jména nebo data (Nováková?).
7. **Činný rod, slovesa.** „Jakub Novák převzal statek“ – ne „došlo k převzetí statku“.
8. **Oslovení hosta** (úvod, popisky pro návštěvníky): přirozeně, ne reklamně. Bez superlativů a vykřičníků.
9. **Délky:** událost na časové ose 1–2 věty (max ~35 slov). Popis domu 3–4 věty. Zajímavost 3–6 vět. Úvod 2–3 krátké odstavce.
10. **Metodiku a pochybnosti** („Ve sčítání 1890 ‚majitel bytu‘ = hlava domácnosti…“) nedávej do popisu – patří do `note`
    nebo do „Co hledáme“, a i tam srozumitelně.

## Vyprávění (inspirace: muzejní popisky a „A House Through Time“)
Osvědčené postupy z muzejní interpretace (Freeman Tilden, *Interpreting Our Heritage*; Beverly Serrell, *Exhibit Labels*)
a z dokumentárního seriálu BBC *A House Through Time*, který dějiny města vypráví přes obyvatele jednoho domu:
1. **Jedna hlavní myšlenka na stránku.** Než začneš psát, řekni jednou větou, o čem stránka je („Chalupa, kde se za 30 let
   vystřídaly čtyři rodiny“). Všechno ostatní ji rozvíjí. Co s ní nesouvisí, patří do pramenů.
2. **Příběh, ne výčet faktů.** Interpretace vypráví; seznam údajů je tabulka (ta už na webu je – držitelé, obyvatelé).
3. **Lidé jako vstupní brána.** Každé období otevři konkrétním člověkem a situací („V roce 1910 tu žije vdova Anna
   s pěti dětmi a jednou kozou“) – teprve pak obecné.
4. **Velké dějiny jen tam, kde se dotkly domu** – a vždy přes lidi z domu (válka = Josef Novák padl 1916, ne „vypukla
   první světová válka“).
5. **Věci, které si čtenář představí.** Koza ve chlévě, kachlová kamna, studna na dvoře. Text u konkrétní věci
   (fotky, mapy, výřezu) se čte víc než samotný text – odkazuj na obrázek.
6. **Vrstvy.** Nadpis (pár slov) → jedna věta, která chytí → podrobnosti → odkaz na pramen. Kdo přečte jen první větu,
   má odnést to hlavní. Úvodní text stránky 20–120 slov.
7. **Tehdy a dnes.** Kde to jde, ukaž rozdíl: kresba 1941 × fotka dnes, políčka 1950 × lány dnes, 164 obyvatel × 27.
8. **Čísla převeď na lidskou míru.** „138 zlatých – asi tolik jako dvě krávy a pár volů“; „dvanáct kusů dobytka – jeden
   z největších statků ve vsi“. Jen když to víš z pramene nebo z literatury, nevymýšlej kurzy.
9. **Nevíme = otázka.** Co nevíme, napiš jako otázku, která láká („Proč se mlynář v roce 1850 najednou
   odstěhoval do vedlejší vsi?“). Patří i do „Co hledáme“.
10. **Bez romantiky a bez soudů.** Bída, nemoc, dluhy, smrt – věcně, s respektem k lidem, kteří tu žili.

## Kontrola po napsání
1. Přečti text nahlas. Kde se zadrhneš, zkrať. Kde chybí „a co?“, doplň, proč je to zajímavé.
2. Proženi texty skillem **humanizer-czech** (styl „přátelský“, je-li nainstalovaný; jinak jeho hlavní pravidla: žádné
   nafouklé uvozování, nominální styl, trpný rod, nadbytečné spojky „navíc / kromě toho / a také“, výčty po třech,
   „představuje“ místo „je“). Výjimka: v češtině piš pomlčku jako „–“ (spojovník/en dash) s mezerami, nikdy „—“.
3. **Skloňování místních jmen ověř, nehádej.** Malé obce bývají pomnožné nebo mají místní tvar (Lhotky → ze Lhotek,
   ve Lhotkách). Zeptej se uživatele nebo ověř (Profous, web obce, internetová jazyková příručka)
   a tvary zapiš jako úkol/poznámku (`rdb.py ukol pridej "Tvary místních jmen" --druh pravidla --text …`), ať se píšou jednotně.
4. Zdroje a jistota (`recordKey`, `certainty`) se nemění – přepisuje se jen text. Nic nepřidávej, co není v pramenech.
