# UKÁZKOVÁ DATA – vymyšlený dům rodiny Novákových.
#
# Dějiny obce a jejích domů. Každý údaj má stav doložení `st`:
#   doc  = přečteno přímo v prameni (snímek matriky, gruntovní knihy, katastru, sčítání…)
#   lit  = z literatury (vlastivěda, kronika v knižním vydání, článek) – uvést kde v `note`/`zdroj`
#   prob = pravděpodobné (shoda údajů, ne přímý doklad) – v `note` proč
#   fam  = od majitele / pamětníka / rodiny (ústní podání, rodinné dokumenty)
#   unk  = neznámé (jen místo v přehledu)
# `r` = klíče zápisů z data/zaznamy.json, které údaj dokládají.
# `o` = u držitele / obyvatele id téže osoby z data/osoby.py, např. o="jan-novak-1890" (jen když jde doloženě o tutéž osobu).
#       tools/kontrola.py hlídá, že osoba existuje a má v `bydliste` tentýž dům (obec, čp.).
# Více obcí: OBEC je hlavní obec webu; její domy mají v `D` klíč = čp. ("12") a pole `obec` nemají.
#   Dům jiné obce má klíč „<Obec> <čp>“ a pole obec= a cp=, např. D["Lhotka 5"] = dict(obec="Lhotka", cp="5", …).
#   Web: /dum/<obec>-<čp>/; staré mapy (mapy.json) patří obci z pole „obec“ (chybí-li, OBEC). Události jiné obce jsou
#   jen u domu (OBEC_UDALOSTI = hlavní obec). Klíč v dokumenty.json „domy“ = klíč v D.

# Obec – vstupní stránka webu „Obec“
OBEC = dict(
    nazev="Holice",      # dnešní název („Horní Lhota“)
    jine_nazvy="",       # historické a německé názvy („Ober-Lhotta“)
    obec="Holice, okres Pardubice (vymyšlená ukázka)",# dnešní obec / katastr, okres („Dolní Lhota, okres Pelhřimov“)
    farnost="Holice",   # kam patřila farou (matriky!) („Dolní Lhota“)
    panstvi="",          # panství před 1848 („Kamenice / Pacov“)
    popis="Ukázková obec vymyšlené rodiny Novákových.",# 2–4 věty pro úvod stránky obce
    lat=50.066, lon=15.986,  # střed vsi (tools/mista.py hledej "Horní Lhota, Pelhřimov")
)

# Časová osa obce: dict(rok="1352", text="…", st="lit", r=[klíče], zdroj="vlastivěda okresu, s. 389")
# rok jako text („1352“, „22. 7. 1352“, „asi 1600“, „1618–1620“) – web podle prvního čtyřčíslí řadí.
OBEC_UDALOSTI = [
    dict(rok="1890", text="Ukázková událost: v obci se staví nová škola.", st="lit", zdroj="vymyšlená vlastivěda, s. 1"),
]

# Domy podle čísla popisného (klíč = číslo jako text, i „12a“, „ev. 3“).
# Pozor na přečíslování: čísla se zaváděla 1770–71 a obce se často přečíslovaly (hlavně 1805–1830 a po 1900).
# dict(
#   nazev="U Nováků",                   # jméno statku / chalupy (po domácku), může být prázdné
#   druh="selský dvůr",                 # selský dvůr / chalupa / domek / mlýn / hospoda / kovárna / škola…
#   st="doc",
#   popis="2–4 věty: co to je za dům dnes a čím je zajímavý",
#   lat=49.431, lon=15.221,             # poloha domu (tools/mista.py ruian "Horní Lhota 12" nebo ručně z mapy)
#   cisla=[("1771–1830", "čp. 7"), ("od 1830", "čp. 12")],   # starší a pozdější čísla téhož domu
#   udalosti=[dict(rok="1890", text="Sčítání lidu: v domě 7 osob…", st="doc", r=["lhota_scitani_cp12_1890"])],
#   drzitele=[dict(od="1786", do="1820", n="Jan Novák", jak="koupě od otce za 300 zl.", st="doc", r=[…], note="")],
#   obyvatele=[dict(n="Jan Novák", y="1790–1850", role="hospodář", f=["* 1790 Horní Lhota 12", "× 1815 Marie …"], st="doc", r=[…])],
#   note="rozpory, odkud údaj",
# )
D = {
    "112": dict(
        nazev="U Kovářů", druh="kovárna", st="doc",
        popis="Ukázkový dům: kovárna, ve které podle vymyšlených zápisů pracovali Václav a Jan Novákové.",
        lat=50.0662, lon=15.9861,
        udalosti=[dict(rok="1890", text="V domě se narodil Jan Novák, syn kováře Václava.", st="doc", r=["ukazka_krest_jan_novak_1890"])],
        drzitele=[dict(od="1884", do="1921", n="Václav Novák", o="vaclav-novak-1858", jak="převzal po otci", st="prob", note="vymyšleno pro ukázku"),
                  dict(od="1921", do="1944", n="Jan Novák", o="jan-novak-1890", jak="dědictví", st="prob", note="vymyšleno pro ukázku")],
        obyvatele=[dict(n="Jan Novák", y="1890–1944", role="kovář", f=["* 14. 2. 1890 Holice čp. 112"], st="doc", r=["ukazka_krest_jan_novak_1890"])],
        note="Celý dům je smyšlený – slouží jen k vyzkoušení webu.",
    ),
}

# Rozpory a otevřené otázky (na web do „Co hledáme“) jako dvojice (otázka, odpověď). Odpověď začněte
# „Vyřešeno: …“ (na webu se skryje), „Hypotéza: …“ nebo „Otevřené: …“. Jde na web – nic citlivého.
ISSUES = [
]
