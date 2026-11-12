# UKÁZKOVÁ DATA – vymyšlená rodina Novákových (všechna jména, data a zápisy jsou smyšlené). Slouží k vyzkoušení webu;
# formát viz template/data/osoby.py.
#
# Osoby a vztahy rodokmenu jako GRAF. Identita osoby = trvalé id (slug), ne Kekulého číslo.
# Kekulého čísla („č. 64“ v poznámkách) se počítají z grafu pro zvolený kořen (KORENY) – jen pro zobrazení
# (vějíř, rody, přehled předků). Výpis čísel: python3 tools/graf.py cisla [koren]
#
# OSOBY = {id: dict(n=…, sex="M"/"F", y=…, st=…, f=[…], r=[…], note=…, bydliste=[…])}
#   id   malými písmeny bez diakritiky: jmeno-prijmeni-rok (např. "jan-novak-1890"); po založení se NEMĚNÍ
#        (je v URL /osoba/<id>/). Kolize → přidat pomlčku a číslo.
#   n    jméno; ženy rodným příjmením („Anna Dvořáková“), u nejistého čtení otazník („Marie Špalková (?)“)
#   sex  "M" / "F" – povinné (dřív plynulo z čísla)
#   y    roky života pro přehledy: "* 1931" (žije / úmrtí neznámé), "1850–1910", "asi 1720–1785", "1680 – před 1740"
#   st   stav doložení:  doc  = doloženo matrikou (čteno přímo ze snímku)
#                        prob = pravděpodobné (shoda údajů, ale ne přímý doklad)
#                        fam  = údaj od rodiny / z rodinného dokumentu
#                        mh   = jen z cizího rodokmenu na internetu (MyHeritage, Geni…) – neověřeno
#                        unk  = neznámé (jen místo v rodokmenu)
#   f    fakta jako krátké věty: "* 12. 3. 1873 Hořice čp. 477", "kovář", "× 28. 1. 1897 Anna Stejskalová", "† 14. 5. 1902"
#        (* narození, × sňatek, † úmrtí – podle těchto značek web pozná sňatky a místa pro mapu)
#   r    klíče zápisů z data/zaznamy.json, které osobu dokládají
#   note poznámka: proč je údaj nejistý, rozpory, odkud se vzal
#   bydliste  volitelně: kde osoba žila – seznam dict(obec, cp, od, do, role, zdroj=[klíče ze zaznamy.json]);
#        jen z doložených faktů, nejisté s (?); zdroj "rodina" = údaj od rodiny (udaje_od_rodiny.md).
#        Klíč (obec, cp) propojuje rodokmen s dějinami domů (tools/domy_rodiny.py).
#   druh "bocni" = souhrnný záznam o bočních příbuzných (dřív SIDE): n = nadpis, t = text; na webu
#        se ukáže u osoby, ke které vede vztah t="pribuzny". Lepší je zakládat boční příbuzné jako
#        normální osoby s hranami rodic/manzele (sourozenec = stejní rodiče).
#   tataz id jiné osoby: tentýž člověk zapsaný podruhé (předek v rodokmenu vícekrát, dřív SAME) –
#        nese jen údaje k druhému výskytu; hrany vedou z hlavní osoby.
# Žijící lidé: jen jméno a rok narození (soukromí), note="Žijící – údaje jen základní."
# Neznámý otec nemanželského dítěte: osoba n="otec neuveden", st="unk" s hranou rodic (na webu bez stránky).

KORENY = {
    "hlavni": "petr-novak-1980",   # výchozí osoba rodokmenu (č. 1)
    # "manzelka": "<id>",            # druhý kořen – doplní se, až budou data o manželce
}

OSOBY = {
    "petr-novak-1980": dict(n="Petr Novák", sex="M", y="* 1980", st="fam", f=["* 1980 Pardubice"], note="Žijící – údaje jen základní."),  # č. 1
    "josef-novak-1952": dict(n="Josef Novák", sex="M", y="* 1952", st="fam", f=["* 1952 Holice"], note="Žijící – údaje jen základní."),  # č. 2
    "eva-dvorakova-1955": dict(n="Eva Dvořáková", sex="F", y="* 1955", st="fam", f=["* 1955 Chrudim", "provd. Nováková"], note="Žijící – údaje jen základní."),  # č. 3
    "frantisek-novak-1921": dict(n="František Novák", sex="M", y="1921–1990", st="fam", f=["* 3. 5. 1921 Holice čp. 112", "zámečník, poslední z rodu, kdo se ještě učil v otcově kovárně", "× 1948 Holice Marie Králová", "† 1990 Pardubice"]),  # č. 4
    "marie-kralova-1925": dict(n="Marie Králová", sex="F", y="1925–2011", st="fam", f=["* 2. 3. 1925 Holice", "švadlena", "× 1948 Holice František Novák", "† 2011 Holice"]),  # č. 5
    "karel-dvorak-1927": dict(n="Karel Dvořák", sex="M", y="1927–1999", st="fam", f=["* 1927 Chrudim", "železničář, výpravčí v Chrudimi", "× 1953 Chrudim Anna Šimková", "† 1999 Chrudim"]),  # č. 6
    "anna-simkova-1930": dict(n="Anna Šimková", sex="F", y="1930–2015", st="fam", f=["* 1930 Chrudim", "× 1953 Chrudim Karel Dvořák", "† 2015 Chrudim"]),  # č. 7
    "jan-novak-1890": dict(n="Jan Novák", sex="M", bydliste=[dict(obec="Holice", cp="112", od=1890, do=1944, role="kovář, majitel kovárny", zdroj=["ukazka_krest_jan_novak_1890"])], y="1890–1944", st="doc", f=["* 14. 2. 1890 Holice čp. 112", "kovář v Holicích", "× 20. 6. 1919 Holice Josefa Pokorná", "† 1944 Holice"], r=["ukazka_krest_jan_novak_1890", "ukazka_snatek_jan_novak_josefa_pokorna_1919"]),  # č. 8
    "josefa-pokorna-1895": dict(n="Josefa Pokorná", sex="F", y="1895–1972", st="doc", f=["* 1895 Dolní Roveň čp. 7", "× 20. 6. 1919 Holice Jan Novák", "† 1972 Holice"], r=["ukazka_snatek_jan_novak_josefa_pokorna_1919"]),  # č. 9
    "vaclav-kral-1893": dict(n="Václav Král", sex="M", y="1893–1961", st="doc", f=["* 1893 Holice čp. 41", "rolník v Holicích", "× 8. 11. 1924 Holice Ludmila Hrubá", "† 1961 Holice"], r=["holice_umrti_vaclav_kral_1961"]),  # č. 10
    "ludmila-hruba-1898": dict(n="Ludmila Hrubá", sex="F", y="1898–1980", st="doc", f=["* 1898 Vysoké Mýto čp. 260", "× 8. 11. 1924 Holice Václav Král", "† 1980 Holice"], r=["holice_umrti_ludmila_hruba_1980"]),  # č. 11
    "antonin-dvorak-1899": dict(n="Antonín Dvořák", sex="M", y="1899–1968", st="doc", f=["* 1899 Chrudim čp. 318", "železničář, strojvedoucí", "× 1925 Chrudim Františka Kučerová", "† 1968 Chrudim"], r=["chrudim_umrti_antonin_dvorak_1968"]),  # č. 12
    "frantiska-kucerova-1902": dict(n="Františka Kučerová", sex="F", y="1902–1985", st="doc", f=["* 1902 Slatiňany čp. 5 (mlýn)", "× 1925 Chrudim Antonín Dvořák", "† 1985 Chrudim"], r=["chrudim_umrti_frantiska_kucerova_1985"]),  # č. 13
    "josef-simek-1901": dict(n="Josef Šimek", sex="M", y="1901–1975", st="doc", f=["* 1901 Chrudim čp. 77", "truhlář, vlastní dílna v Chrudimi", "× 1928 Chrudim Marie Vondráčková", "† 1975 Chrudim"], r=["chrudim_umrti_josef_simek_1975"]),  # č. 14
    "marie-vondrackova-1905": dict(n="Marie Vondráčková", sex="F", y="1905–1990", st="doc", f=["* 1905 Luže čp. 88", "× 1928 Chrudim Josef Šimek", "† 1990 Chrudim"], r=["chrudim_umrti_marie_vondrackova_1990"]),  # č. 15
    "vaclav-novak-1858": dict(n="Václav Novák", sex="M", bydliste=[dict(obec="Holice", cp="112", od=1858, do=1921, role="kovář", zdroj=["ukazka_krest_jan_novak_1890"])], y="1858–1921", st="doc", f=["* 1858 Holice čp. 112", "kovář", "× 1884 Holice Barbora Malá", "† 1921 Holice"], r=["ukazka_krest_jan_novak_1890", "holice_snatek_vaclav_novak_barbora_mala_1884"]),  # č. 16
    "barbora-mala-1862": dict(n="Barbora Malá", sex="F", y="1862–1930", st="doc", f=["* 1862 Ostřetín čp. 23", "× 1884 Holice Václav Novák", "† 1930 Holice"], r=["ukazka_krest_jan_novak_1890", "holice_snatek_vaclav_novak_barbora_mala_1884"]),  # č. 17
    "josef-pokorny-1865": dict(n="Josef Pokorný", sex="M", y="1865–1931", st="doc", f=["* 1865 Dolní Roveň čp. 7", "sedlák v Dolní Rovni čp. 7", "× 2. 3. 1894 Horní Roveň Barbora Sládková", "† 1931 Dolní Roveň"], r=["ukazka_snatek_jan_novak_josefa_pokorna_1919", "horni_roven_snatek_josef_pokorny_barbora_sladkova_1894"]),  # č. 18
    "barbora-sladkova-1868": dict(n="Barbora Sládková", sex="F", y="1868–1950", st="doc", f=["* 9. 2. 1868 Horní Roveň čp. 83", "× 2. 3. 1894 Horní Roveň Josef Pokorný", "† 15. 7. 1950 Dolní Roveň"], r=["horni_roven_snatek_josef_pokorny_barbora_sladkova_1894"]),  # č. 19
    "josef-kral-1860": dict(n="Josef Král", sex="M", y="1860–1918", st="doc", f=["* 21. 1. 1860 Holice čp. 41", "rolník", "× 8. 5. 1892 Ostřetín Johana Marková", "† 27. 9. 1918 Holice"], r=["ostretin_snatek_josef_kral_johana_markova_1892"]),  # č. 20
    "johana-markova-1867": dict(n="Johana Marková", sex="F", y="1867–1943", st="doc", f=["* 25. 9. 1867 Ostřetín čp. 56", "× 8. 5. 1892 Ostřetín Josef Král", "† 18. 10. 1943 Holice"], r=["ostretin_snatek_josef_kral_johana_markova_1892"]),  # č. 21
    "josef-hruby-1871": dict(n="Josef Hrubý", sex="M", y="1871–1926", st="doc", f=["* 6. 10. 1871 Vysoké Mýto čp. 260", "soukeník", "× 6. 6. 1897 Uhersko Johana Dušková", "† 25. 1. 1926 Vysoké Mýto"], r=["uhersko_snatek_josef_hruby_johana_duskova_1897"]),  # č. 22
    "johana-duskova-1873": dict(n="Johana Dušková", sex="F", y="1873–1935", st="doc", f=["* 28. 9. 1873 Uhersko čp. 67", "× 6. 6. 1897 Uhersko Josef Hrubý", "† 6. 4. 1935 Vysoké Mýto"], r=["uhersko_snatek_josef_hruby_johana_duskova_1897"]),  # č. 23
    "jan-dvorak-1869": dict(n="Jan Dvořák", sex="M", y="1869–1917", st="doc", f=["* 21. 7. 1869 Chrudim čp. 318", "železničář", "× 11. 11. 1897 Hlinsko Karolína Bartošová", "† 13. 1. 1917 Chrudim"], r=["hlinsko_snatek_jan_dvorak_karolina_bartosova_1897"]),  # č. 24
    "karolina-bartosova-1870": dict(n="Karolína Bartošová", sex="F", y="1870–1928", st="doc", f=["* 22. 4. 1870 Hlinsko čp. 53", "× 11. 11. 1897 Hlinsko Jan Dvořák", "† 11. 12. 1928 Chrudim"], r=["hlinsko_snatek_jan_dvorak_karolina_bartosova_1897"]),  # č. 25
    "josef-kucera-1866": dict(n="Josef Kučera", sex="M", y="1866–1930", st="doc", f=["* 28. 5. 1866 Slatiňany čp. 5", "mlynář", "× 17. 3. 1899 Nasavrky Anna Vávrová", "† 27. 3. 1930 Slatiňany"], r=["nasavrky_snatek_josef_kucera_anna_vavrova_1899"]),  # č. 26
    "anna-vavrova-1873": dict(n="Anna Vávrová", sex="F", y="1873–1946", st="doc", f=["* 24. 7. 1873 Nasavrky čp. 47", "× 17. 3. 1899 Nasavrky Josef Kučera", "† 27. 8. 1946 Slatiňany"], r=["nasavrky_snatek_josef_kucera_anna_vavrova_1899"]),  # č. 27
    "josef-simek-1865": dict(n="Josef Šimek", sex="M", y="1865–1923", st="prob", f=["* 9. 7. 1865 Chrudim čp. 77", "truhlář", "× 4. 8. 1899 Chrudim Rozálie Křížová", "† 16. 3. 1923 Chrudim"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 28
    "rozalie-krizova-1879": dict(n="Rozálie Křížová", sex="F", y="1879–1950", st="doc", f=["* 10. 6. 1879 Proseč čp. 63", "× 4. 8. 1899 Chrudim Josef Šimek", "† 28. 7. 1950 Chrudim"], r=["chrudim_snatek_josef_simek_rozalie_krizova_1899"]),  # č. 29
    "josef-vondracek-1875": dict(n="Josef Vondráček", sex="M", y="1875–1923", st="doc", f=["* 21. 4. 1875 Luže čp. 88", "hrnčíř", "× 19. 3. 1903 Skuteč Františka Benešová", "† 26. 5. 1923 Luže"], r=["skutec_snatek_josef_vondracek_frantiska_benesova_1903"]),  # č. 30
    "frantiska-benesova-1875": dict(n="Františka Benešová", sex="F", y="1875–1923", st="doc", f=["* 14. 3. 1875 Skuteč čp. 104", "× 19. 3. 1903 Skuteč Josef Vondráček", "† 19. 3. 1923 Luže"], r=["skutec_snatek_josef_vondracek_frantiska_benesova_1903"]),  # č. 31
    "jan-novak-1824": dict(n="Jan Novák", sex="M", y="1824–1880", st="doc", f=["* 1824 Holice čp. 112", "kovář", "× 26. 5. 1857 Holice Marie Urbanová", "† 1880 Holice"], r=["holice_snatek_jan_novak_marie_urbanova_1857"]),  # č. 32
    "marie-urbanova-1836": dict(n="Marie Urbanová", sex="F", y="1836–1905", st="doc", f=["* 13. 1. 1836 Holice čp. 134", "× 26. 5. 1857 Holice Jan Novák", "† 19. 1. 1905 Holice"], r=["holice_snatek_jan_novak_marie_urbanova_1857"]),  # č. 33
    "frantisek-maly-1827": dict(n="František Malý", sex="M", y="1827–1906", st="doc", f=["* 27. 2. 1827 Ostřetín čp. 23", "bednář", "× 22. 3. 1861 Ostřetín Josefa Ptáčková", "† 1. 10. 1906 Ostřetín"], r=["ostretin_snatek_frantisek_maly_josefa_ptackova_1861"]),  # č. 34
    "josefa-ptackova-1831": dict(n="Josefa Ptáčková", sex="F", y="1831–1893", st="prob", f=["* 14. 7. 1831 Ostřetín čp. 59", "× 22. 3. 1861 Ostřetín František Malý", "† 13. 12. 1893 Ostřetín"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 35
    "antonin-pokorny-1829": dict(n="Antonín Pokorný", sex="M", y="1829–1902", st="prob", f=["* 12. 9. 1829 Dolní Roveň čp. 7", "sedlák", "× 2. 6. 1862 Dolní Roveň Františka Lukešová", "† 22. 7. 1902 Dolní Roveň"], note="Jen ze zápisu sňatku dítěte; vlastní křest zatím nenalezen."),  # č. 36
    "frantiska-lukesova-1834": dict(n="Františka Lukešová", sex="F", y="1834–1903", st="doc", f=["* 18. 2. 1834 Dolní Roveň čp. 111", "× 2. 6. 1862 Dolní Roveň Antonín Pokorný", "† 26. 5. 1903 Dolní Roveň"], r=["dolni_roven_snatek_antonin_pokorny_frantiska_lukesova_1862"]),  # č. 37
    "josef-sladek-1842": dict(n="Josef Sládek", sex="M", y="1842–1924", st="doc", f=["* 27. 1. 1842 Horní Roveň čp. 83", "švec", "× 18. 2. 1867 Dolní Roveň Františka Pilařová", "† 12. 6. 1924 Horní Roveň"], r=["dolni_roven_snatek_josef_sladek_frantiska_pilarova_1867"]),  # č. 38
    "frantiska-pilarova-1839": dict(n="Františka Pilařová", sex="F", y="1839–1897", st="doc", f=["* 27. 9. 1839 Dolní Roveň čp. 53", "× 18. 2. 1867 Dolní Roveň Josef Sládek", "† 19. 3. 1897 Horní Roveň"], r=["dolni_roven_snatek_josef_sladek_frantiska_pilarova_1867"]),  # č. 39
    "tomas-kral-1832": dict(n="Tomáš Král", sex="M", y="1832–1903", st="doc", f=["* 8. 2. 1832 Holice čp. 41", "rolník", "× 13. 11. 1858 Dašice Anna Vacková", "† 25. 10. 1903 Holice"], r=["dasice_snatek_tomas_kral_anna_vackova_1858"]),  # č. 40
    "anna-vackova-1835": dict(n="Anna Vacková", sex="F", y="1835–1906", st="doc", f=["* 17. 4. 1835 Dašice čp. 114", "× 13. 11. 1858 Dašice Tomáš Král", "† 11. 1. 1906 Holice"], r=["dasice_snatek_tomas_kral_anna_vackova_1858"]),  # č. 41
    "karel-marek-1839": dict(n="Karel Marek", sex="M", y="1839–1910", st="doc", f=["* 22. 5. 1839 Ostřetín čp. 56", "kolář", "× 24. 10. 1866 Vysoké Chvojno Johana Veselá", "† 8. 3. 1910 Ostřetín"], r=["vysoke_chvojno_snatek_karel_marek_johana_vesela_1866"]),  # č. 42
    "johana-vesela-1836": dict(n="Johana Veselá", sex="F", y="1836–1912", st="doc", f=["* 24. 9. 1836 Vysoké Chvojno čp. 7", "× 24. 10. 1866 Vysoké Chvojno Karel Marek", "† 7. 1. 1912 Ostřetín"], r=["vysoke_chvojno_snatek_karel_marek_johana_vesela_1866"]),  # č. 43
    "vaclav-hruby-1841": dict(n="Václav Hrubý", sex="M", y="1841–1905", st="prob", f=["* 6. 6. 1841 Vysoké Mýto čp. 260", "soukeník", "× 16. 8. 1868 Choceň Johana Fialová", "† 4. 5. 1905 Vysoké Mýto"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 44
    "johana-fialova-1848": dict(n="Johana Fialová", sex="F", y="1848–1937", st="doc", f=["* 19. 1. 1848 Choceň čp. 82", "× 16. 8. 1868 Choceň Václav Hrubý", "† 10. 12. 1937 Vysoké Mýto"], r=["chocen_snatek_vaclav_hruby_johana_fialova_1868"]),  # č. 45
    "vincenc-dusek-1847": dict(n="Vincenc Dušek", sex="M", y="1847–1920", st="doc", f=["* 5. 1. 1847 Uhersko čp. 67", "chalupník", "× 2. 4. 1870 Vysoké Mýto Johana Holubová", "† 11. 11. 1920 Uhersko"], r=["vysoke_myto_snatek_vincenc_dusek_johana_holubova_1870"]),  # č. 46
    "johana-holubova-1845": dict(n="Johana Holubová", sex="F", y="1845–1927", st="doc", f=["* 10. 10. 1845 Vysoké Mýto čp. 33", "× 2. 4. 1870 Vysoké Mýto Vincenc Dušek", "† 18. 8. 1927 Uhersko"], r=["vysoke_myto_snatek_vincenc_dusek_johana_holubova_1870"]),  # č. 47
    "karel-dvorak-1836": dict(n="Karel Dvořák", sex="M", y="1836–1909", st="doc", f=["* 12. 11. 1836 Chrudim čp. 318", "tkadlec", "× 14. 4. 1867 Heřmanův Městec Karolína Pešková", "† 25. 10. 1909 Chrudim"], r=["hermanuv_mestec_snatek_karel_dvorak_karolina_peskova_1867"]),  # č. 48
    "karolina-peskova-1847": dict(n="Karolína Pešková", sex="F", y="1847–1920", st="doc", f=["* 27. 7. 1847 Heřmanův Městec čp. 93", "× 14. 4. 1867 Heřmanův Městec Karel Dvořák", "† 20. 3. 1920 Chrudim"], r=["hermanuv_mestec_snatek_karel_dvorak_karolina_peskova_1867"]),  # č. 49
    "jan-bartos-1838": dict(n="Jan Bartoš", sex="M", y="1838–1902", st="doc", f=["* 27. 12. 1838 Hlinsko čp. 53", "zedník", "× 3. 10. 1867 Heřmanův Městec Karolína Novotná", "† 27. 6. 1902 Hlinsko"], r=["hermanuv_mestec_snatek_jan_bartos_karolina_novotna_1867"]),  # č. 50
    "karolina-novotna-1840": dict(n="Karolína Novotná", sex="F", y="1840–1895", st="doc", f=["* 9. 1. 1840 Heřmanův Městec čp. 112", "× 3. 10. 1867 Heřmanův Městec Jan Bartoš", "† 19. 1. 1895 Hlinsko"], r=["hermanuv_mestec_snatek_jan_bartos_karolina_novotna_1867"]),  # č. 51
    "vincenc-kucera-1831": dict(n="Vincenc Kučera", sex="M", y="1831–1913", st="doc", f=["* 10. 7. 1831 Slatiňany čp. 5", "mlynář", "× 22. 12. 1864 Třemošnice Karolína Horáková", "† 19. 2. 1913 Slatiňany"], r=["tremosnice_snatek_vincenc_kucera_karolina_horakova_1864"]),  # č. 52
    "karolina-horakova-1838": dict(n="Karolína Horáková", sex="F", y="1838–1905", st="doc", f=["* 9. 8. 1838 Třemošnice čp. 100", "× 22. 12. 1864 Třemošnice Vincenc Kučera", "† 28. 4. 1905 Slatiňany"], r=["tremosnice_snatek_vincenc_kucera_karolina_horakova_1864"]),  # č. 53
    "jan-vavra-1843": dict(n="Jan Vávra", sex="M", y="1843–1905", st="doc", f=["* 9. 8. 1843 Slatiňany čp. 80", "krejčí", "× 13. 1. 1870 Nasavrky Kateřina Matějková", "† 9. 6. 1905 Slatiňany"], r=["nasavrky_snatek_jan_vavra_katerina_matejkova_1870"]),  # č. 54
    "katerina-matejkova-1852": dict(n="Kateřina Matějková", sex="F", y="1852–1907", st="doc", f=["* 25. 8. 1852 Nasavrky čp. 136", "× 13. 1. 1870 Nasavrky Jan Vávra", "† 16. 6. 1907 Nasavrky"], r=["nasavrky_snatek_jan_vavra_katerina_matejkova_1870"]),  # č. 55
    "karel-simek-1831": dict(n="Karel Šimek", sex="M", y="1831–1913", st="doc", f=["* 8. 10. 1831 Chrudim čp. 77", "truhlář", "× 24. 1. 1864 Chrudim Kateřina Doležalová", "† 5. 11. 1913 Chrudim"], r=["chrudim_snatek_karel_simek_katerina_dolezalova_1864"]),  # č. 56
    "katerina-dolezalova-1844": dict(n="Kateřina Doležalová", sex="F", y="1844–1902", st="doc", f=["* 7. 6. 1844 Chrudim čp. 65", "× 24. 1. 1864 Chrudim Karel Šimek", "† 26. 9. 1902 Chrudim"], r=["chrudim_snatek_karel_simek_katerina_dolezalova_1864"]),  # č. 57
    "otec-neuveden-rozalie-krizova-1879": dict(n="otec neuveden", sex="M", y="", st="unk", f=[], note="Dcera Rozálie se narodila jako nemanželská; otec v matrice není zapsán ani dodatečně."),  # č. 58
    "anna-krizova-1856": dict(n="Anna Křížová", sex="F", y="1856–1911", st="prob", f=["* 12. 10. 1856 Proseč čp. 63", "† 1. 10. 1911 Chrudim"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 59
    "tomas-vondracek-1848": dict(n="Tomáš Vondráček", sex="M", y="1848–1930", st="doc", f=["* 2. 7. 1848 Luže čp. 88", "hrnčíř", "× 11. 8. 1873 Luže Karolína Kubátová", "† 3. 11. 1930 Luže"], r=["luze_snatek_tomas_vondracek_karolina_kubatova_1873"]),  # č. 60
    "karolina-kubatova-1852": dict(n="Karolína Kubátová", sex="F", y="1852–1946", st="doc", f=["* 17. 8. 1852 Luže čp. 12", "× 11. 8. 1873 Luže Tomáš Vondráček", "† 18. 7. 1946 Luže"], r=["luze_snatek_tomas_vondracek_karolina_kubatova_1873"]),  # č. 61
    "josef-benes-1840": dict(n="Josef Beneš", sex="M", y="1840–1888", st="doc", f=["* 14. 2. 1840 Skuteč čp. 104", "chalupník", "× 11. 6. 1873 Skuteč Kateřina Šťastná", "† 11. 4. 1888 Skuteč"], r=["skutec_snatek_josef_benes_katerina_stastna_1873"]),  # č. 62
    "katerina-stastna-1845": dict(n="Kateřina Šťastná", sex="F", y="1845–1918", st="doc", f=["* 13. 11. 1845 Skuteč čp. 130", "× 11. 6. 1873 Skuteč Josef Beneš", "† 27. 2. 1918 Skuteč"], r=["skutec_snatek_josef_benes_katerina_stastna_1873"]),  # č. 63
    "josef-novak-1791": dict(n="Josef Novák", sex="M", y="1791–1855", st="doc", f=["* 1791 Holice čp. 112", "kovář", "× 8. 7. 1823 Ostřetín Anna Junková", "† 1855 Holice, na choleru"], r=["ostretin_snatek_josef_novak_anna_junkova_1823"]),  # č. 64
    "anna-junkova-1803": dict(n="Anna Junková", sex="F", y="1803–1870", st="doc", f=["* 23. 7. 1803 Ostřetín čp. 53", "× 8. 7. 1823 Ostřetín Josef Novák", "† 18. 6. 1870 Holice"], r=["ostretin_snatek_josef_novak_anna_junkova_1823"]),  # č. 65
    "jan-urban-1807": dict(n="Jan Urban", sex="M", y="1807–1869", st="doc", f=["* 7. 7. 1807 Holice čp. 134", "domkář", "† 23. 5. 1869 Holice"], r=["holice_umrti_jan_urban_1869"]),  # č. 66
    "karel-maly-1800": dict(n="Karel Malý", sex="M", y="1800–1873", st="prob", f=["* 20. 8. 1800 Ostřetín čp. 23", "tesař", "× 17. 9. 1824 Býšť Anna Sedláčková", "† 19. 1. 1873 Ostřetín"], note="Jen ze zápisu sňatku dítěte; vlastní křest zatím nenalezen."),  # č. 68
    "anna-sedlackova-1798": dict(n="Anna Sedláčková", sex="F", y="1798–1853", st="doc", f=["* 17. 4. 1798 Býšť čp. 46", "× 17. 9. 1824 Býšť Karel Malý", "† 17. 9. 1853 Ostřetín"], r=["byst_snatek_karel_maly_anna_sedlackova_1824"]),  # č. 69
    "antonin-ptacek-1802": dict(n="Antonín Ptáček", sex="M", y="1802–1850", st="doc", f=["* 3. 5. 1802 Ostřetín čp. 59", "sládek", "† 7. 8. 1850 Ostřetín"], r=["ostretin_umrti_antonin_ptacek_1850"]),  # č. 70
    "vincenc-pokorny-1799": dict(n="Vincenc Pokorný", sex="M", y="1799–1878", st="doc", f=["* 16. 8. 1799 Dolní Roveň čp. 7", "sedlák", "× 18. 6. 1827 Dolní Roveň Karolína Kalousová", "† 6. 2. 1878 Dolní Roveň"], r=["dolni_roven_snatek_vincenc_pokorny_karolina_kalousova_1827"]),  # č. 72
    "karolina-kalousova-1805": dict(n="Karolína Kalousová", sex="F", y="1805–1874", st="prob", f=["* 18. 5. 1805 Dolní Roveň čp. 61", "× 18. 6. 1827 Dolní Roveň Vincenc Pokorný", "† 16. 2. 1874 Dolní Roveň"], note="Jen ze zápisu sňatku dítěte; vlastní křest zatím nenalezen."),  # č. 73
    "josef-lukes-1799": dict(n="Josef Lukeš", sex="M", y="1799–1861", st="doc", f=["* 13. 10. 1799 Dolní Roveň čp. 111", "sládek", "× 6. 4. 1833 Moravany Josefa Šrámková", "† 23. 4. 1861 Dolní Roveň"], r=["moravany_snatek_josef_lukes_josefa_sramkova_1833"]),  # č. 74
    "josefa-sramkova-1811": dict(n="Josefa Šrámková", sex="F", y="1811–1866", st="doc", f=["* 8. 8. 1811 Moravany čp. 65", "× 6. 4. 1833 Moravany Josef Lukeš", "† 15. 9. 1866 Dolní Roveň"], r=["moravany_snatek_josef_lukes_josefa_sramkova_1833"]),  # č. 75
    "jan-sladek-1807": dict(n="Jan Sládek", sex="M", y="1807–1876", st="prob", f=["* 2. 1. 1807 Horní Roveň čp. 83", "domkář", "† 21. 2. 1876 Horní Roveň"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 76
    "josef-pilar-1811": dict(n="Josef Pilař", sex="M", y="1811–1890", st="doc", f=["* 13. 8. 1811 Dolní Roveň čp. 53", "bednář", "× 7. 5. 1837 Sezemice Anna Štěpánková", "† 8. 1. 1890 Dolní Roveň"], r=["sezemice_snatek_josef_pilar_anna_stepankova_1837"]),  # č. 78
    "anna-stepankova-1808": dict(n="Anna Štěpánková", sex="F", y="1808–1877", st="prob", f=["* 12. 8. 1808 Sezemice čp. 74", "× 7. 5. 1837 Sezemice Josef Pilař", "† 15. 1. 1877 Dolní Roveň"], note="Jen ze zápisu sňatku dítěte; vlastní křest zatím nenalezen."),  # č. 79
    "barbora-jelinkova-1810": dict(n="Barbora Jelínková", sex="F", y="1810–1872", st="doc", f=["* 6. 3. 1810 Holice čp. 66", "† 23. 11. 1872 Holice"], r=["holice_umrti_barbora_jelinkova_1872"]),  # č. 81
    "vincenc-vacek-1805": dict(n="Vincenc Vacek", sex="M", y="1805–1853", st="doc", f=["* 16. 8. 1805 Dašice čp. 114", "panský myslivec", "× 1. 12. 1834 Dašice Josefa Zemanová", "† 24. 2. 1853 Dašice"], r=["dasice_snatek_vincenc_vacek_josefa_zemanova_1834"]),  # č. 82
    "josefa-zemanova-1812": dict(n="Josefa Zemanová", sex="F", y="1812–1879", st="doc", f=["* 12. 1. 1812 Dašice čp. 43", "× 1. 12. 1834 Dašice Vincenc Vacek", "† 1. 10. 1879 Dašice"], r=["dasice_snatek_vincenc_vacek_josefa_zemanova_1834"]),  # č. 83
    "josefa-pospisilova-1811": dict(n="Josefa Pospíšilová", sex="F", y="1811–1890", st="doc", f=["* 19. 10. 1811 Vysoké Chvojno čp. 73", "† 5. 9. 1890 Ostřetín"], r=["ostretin_umrti_josefa_pospisilova_1890"]),  # č. 85
    "jan-vesely-1809": dict(n="Jan Veselý", sex="M", y="1809–1873", st="prob", f=["* 24. 7. 1809 Vysoké Chvojno čp. 7", "zedník", "† 11. 10. 1873 Vysoké Chvojno"], note="Shoda jména, domu a doby – přímý doklad chybí."),  # č. 86
    "vaclav-hruby-1805": dict(n="Václav Hrubý", sex="M", y="1805–1863", st="doc", f=["* 9. 7. 1805 Vysoké Mýto čp. 260", "soukeník", "× 1. 4. 1838 Choceň Josefa Černá", "† 14. 12. 1863 Vysoké Mýto"], r=["chocen_snatek_vaclav_hruby_josefa_cerna_1838"]),  # č. 88
    "josefa-cerna-1811": dict(n="Josefa Černá", sex="F", y="1811–1878", st="doc", f=["* 7. 10. 1811 Choceň čp. 26", "× 1. 4. 1838 Choceň Václav Hrubý", "† 16. 11. 1878 Vysoké Mýto"], r=["chocen_snatek_vaclav_hruby_josefa_cerna_1838"]),  # č. 89
    "tomas-fiala-1817": dict(n="Tomáš Fiala", sex="M", y="1817–1890", st="doc", f=["* 8. 11. 1817 Vysoké Mýto čp. 84", "řezník", "× 12. 1. 1847 Choceň Anna Tichá", "† 21. 7. 1890 Vysoké Mýto"], r=["chocen_snatek_tomas_fiala_anna_ticha_1847"]),  # č. 90
    "anna-ticha-1817": dict(n="Anna Tichá", sex="F", y="1817–1879", st="doc", f=["* 3. 2. 1817 Choceň čp. 49", "× 12. 1. 1847 Choceň Tomáš Fiala", "† 19. 7. 1879 Choceň"], r=["chocen_snatek_tomas_fiala_anna_ticha_1847"]),  # č. 91
    "jan-dusek-1821": dict(n="Jan Dušek", sex="M", y="1821–1869", st="doc", f=["* 4. 4. 1821 Uhersko čp. 67", "krejčí", "× 2. 9. 1845 Uhersko Terezie Procházková", "† 21. 4. 1869 Uhersko"], r=["uhersko_snatek_jan_dusek_terezie_prochazkova_1845"]),  # č. 92
    "terezie-prochazkova-1822": dict(n="Terezie Procházková", sex="F", y="1822–1884", st="doc", f=["* 20. 6. 1822 Uhersko čp. 80", "× 2. 9. 1845 Uhersko Jan Dušek", "† 21. 11. 1884 Uhersko"], r=["uhersko_snatek_jan_dusek_terezie_prochazkova_1845"]),  # č. 93
    "frantisek-holub-1815": dict(n="František Holub", sex="M", y="1815–1877", st="prob", f=["* 25. 9. 1815 Vysoké Mýto čp. 33", "rychtář a sedlák", "× 15. 2. 1843 Vysoké Mýto Johana Hrdinová", "† 4. 3. 1877 Vysoké Mýto"], note="Shoda jména, domu a doby – přímý doklad chybí."),  # č. 94
    "johana-hrdinova-1814": dict(n="Johana Hrdinová", sex="F", y="1814–1883", st="doc", f=["* 13. 5. 1814 Vysoké Mýto čp. 96", "× 15. 2. 1843 Vysoké Mýto František Holub", "† 7. 4. 1883 Vysoké Mýto"], r=["vysoke_myto_snatek_frantisek_holub_johana_hrdinova_1843"]),  # č. 95
    "jan-dvorak-1807": dict(n="Jan Dvořák", sex="M", y="1807–1889", st="doc", f=["* 20. 10. 1807 Hlinsko čp. 122", "tkadlec", "× 17. 12. 1834 Hlinsko Františka Charvátová", "† 18. 8. 1889 Hlinsko"], r=["hlinsko_snatek_jan_dvorak_frantiska_charvatova_1834"]),  # č. 96
    "frantiska-charvatova-1815": dict(n="Františka Charvátová", sex="F", y="1815–1894", st="prob", f=["* 28. 4. 1815 Hlinsko čp. 85", "× 17. 12. 1834 Hlinsko Jan Dvořák", "† 6. 11. 1894 Chrudim"], note="Jen ze zápisu sňatku dítěte; vlastní křest zatím nenalezen."),  # č. 97
    "josef-pesek-1812": dict(n="Josef Pešek", sex="M", y="1812–1879", st="doc", f=["* 3. 11. 1812 Heřmanův Městec čp. 93", "tesař", "× 3. 5. 1844 Hlinsko Anna Moravcová", "† 2. 4. 1879 Heřmanův Městec"], r=["hlinsko_snatek_josef_pesek_anna_moravcova_1844"]),  # č. 98
    "anna-moravcova-1821": dict(n="Anna Moravcová", sex="F", y="1821–1869", st="doc", f=["* 2. 4. 1821 Hlinsko čp. 56", "× 3. 5. 1844 Hlinsko Josef Pešek", "† 7. 8. 1869 Heřmanův Městec"], r=["hlinsko_snatek_josef_pesek_anna_moravcova_1844"]),  # č. 99
    "vincenc-bartos-1809": dict(n="Vincenc Bartoš", sex="M", y="1809–1871", st="doc", f=["* 23. 6. 1809 Hlinsko čp. 53", "bednář", "× 27. 1. 1836 Heřmanův Městec Rozálie Svobodová", "† 13. 2. 1871 Hlinsko"], r=["hermanuv_mestec_snatek_vincenc_bartos_rozalie_svobodova_1836"]),  # č. 100
    "rozalie-svobodova-1816": dict(n="Rozálie Svobodová", sex="F", y="1816–1895", st="doc", f=["* 8. 5. 1816 Heřmanův Městec čp. 78", "× 27. 1. 1836 Heřmanův Městec Vincenc Bartoš", "† 28. 8. 1895 Hlinsko"], r=["hermanuv_mestec_snatek_vincenc_bartos_rozalie_svobodova_1836"]),  # č. 101
    "karel-novotny-1811": dict(n="Karel Novotný", sex="M", y="1811–1887", st="doc", f=["* 20. 8. 1811 Heřmanův Městec čp. 112", "krejčí", "× 20. 6. 1837 Chrudim Kateřina Kopecká", "† 7. 3. 1887 Heřmanův Městec"], r=["chrudim_snatek_karel_novotny_katerina_kopecka_1837"]),  # č. 102
    "katerina-kopecka-1817": dict(n="Kateřina Kopecká", sex="F", y="1817–1886", st="doc", f=["* 17. 7. 1817 Chrudim čp. 25", "× 20. 6. 1837 Chrudim Karel Novotný", "† 23. 12. 1886 Heřmanův Městec"], r=["chrudim_snatek_karel_novotny_katerina_kopecka_1837"]),  # č. 103
    "vincenc-kucera-1799": dict(n="Vincenc Kučera", sex="M", y="1799–1854", st="doc", f=["* 9. 6. 1799 Slatiňany čp. 5", "mlynář", "× 3. 3. 1828 Nasavrky Marie Machová", "† 25. 9. 1854 Slatiňany"], r=["nasavrky_snatek_vincenc_kucera_marie_machova_1828"]),  # č. 104
    "marie-machova-1807": dict(n="Marie Machová", sex="F", y="1807–1871", st="doc", f=["* 13. 5. 1807 Nasavrky čp. 78", "× 3. 3. 1828 Nasavrky Vincenc Kučera", "† 4. 11. 1871 Slatiňany"], r=["nasavrky_snatek_vincenc_kucera_marie_machova_1828"]),  # č. 105
    "karolina-rihova-1816": dict(n="Karolína Říhová", sex="F", y="1816–1883", st="prob", f=["* 22. 6. 1816 Chrudim čp. 61", "† 3. 6. 1883 Třemošnice"], note="Shoda jména, domu a doby – přímý doklad chybí."),  # č. 107
    "tomas-vavra-1816": dict(n="Tomáš Vávra", sex="M", y="1816–1892", st="doc", f=["* 8. 7. 1816 Slatiňany čp. 80", "zedník", "× 16. 10. 1840 Nasavrky Františka Hájková", "† 24. 7. 1892 Slatiňany"], r=["nasavrky_snatek_tomas_vavra_frantiska_hajkova_1840"]),  # č. 108
    "frantiska-hajkova-1812": dict(n="Františka Hájková", sex="F", y="1812–1881", st="doc", f=["* 23. 11. 1812 Nasavrky čp. 66", "× 16. 10. 1840 Nasavrky Tomáš Vávra", "† 9. 1. 1881 Slatiňany"], r=["nasavrky_snatek_tomas_vavra_frantiska_hajkova_1840"]),  # č. 109
    "vincenc-simek-1803": dict(n="Vincenc Šimek", sex="M", y="1803–1851", st="prob", f=["* 16. 8. 1803 Chrudim čp. 77", "truhlář", "× 24. 12. 1829 Proseč Terezie Kolářová", "† 17. 12. 1851 Chrudim"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 112
    "terezie-kolarova-1803": dict(n="Terezie Kolářová", sex="F", y="1803–1851", st="doc", f=["* 2. 11. 1803 Proseč čp. 23", "× 24. 12. 1829 Proseč Vincenc Šimek", "† 11. 8. 1851 Chrudim"], r=["prosec_snatek_vincenc_simek_terezie_kolarova_1829"]),  # č. 113
    "karel-dolezal-1817": dict(n="Karel Doležal", sex="M", y="1817–1872", st="prob", f=["* 21. 9. 1817 Chrudim čp. 65", "sládek", "× 28. 7. 1841 Chrudim Josefa Žáková", "† 4. 9. 1872 Chrudim"], note="Shoda jména, domu a doby – přímý doklad chybí."),  # č. 114
    "josefa-zakova-1823": dict(n="Josefa Žáková", sex="F", y="1823–1885", st="prob", f=["* 24. 4. 1823 Chrudim čp. 63", "× 28. 7. 1841 Chrudim Karel Doležal", "† 20. 11. 1885 Chrudim"], note="Jen ze zápisu sňatku dítěte; vlastní křest zatím nenalezen."),  # č. 115
    "josef-kriz-1827": dict(n="Josef Kříž", sex="M", y="1827–1900", st="doc", f=["* 15. 2. 1827 Skuteč čp. 131", "hostinský", "† 1. 6. 1900 Skuteč"], r=["skutec_umrti_josef_kriz_1900"]),  # č. 118
    "josef-vondracek-1813": dict(n="Josef Vondráček", sex="M", y="1813–1871", st="doc", f=["* 13. 10. 1813 Luže čp. 88", "hrnčíř", "× 5. 5. 1845 Luže Kateřina Pilařová", "† 12. 12. 1871 Luže"], r=["luze_snatek_josef_vondracek_katerina_pilarova_1845"]),  # č. 120
    "katerina-pilarova-1819": dict(n="Kateřina Pilařová", sex="F", y="1819–1901", st="prob", f=["* 16. 1. 1819 Luže čp. 34", "× 5. 5. 1845 Luže Josef Vondráček", "† 16. 11. 1901 Luže"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 121
    "rozalie-rihova-1830": dict(n="Rozálie Říhová", sex="F", y="1830–1906", st="doc", f=["* 23. 1. 1830 Litomyšl čp. 75", "† 21. 1. 1906 Luže"], r=["luze_umrti_rozalie_rihova_1906"]),  # č. 123
    "frantisek-benes-1811": dict(n="František Beneš", sex="M", y="1811–1884", st="doc", f=["* 12. 9. 1811 Skuteč čp. 104", "hostinský", "× 9. 10. 1839 Skuteč Františka Kopecká", "† 14. 10. 1884 Skuteč"], r=["skutec_snatek_frantisek_benes_frantiska_kopecka_1839"]),  # č. 124
    "frantiska-kopecka-1818": dict(n="Františka Kopecká", sex="F", y="1818–1876", st="doc", f=["* 1. 5. 1818 Skuteč čp. 55", "× 9. 10. 1839 Skuteč František Beneš", "† 14. 9. 1876 Skuteč"], r=["skutec_snatek_frantisek_benes_frantiska_kopecka_1839"]),  # č. 125
    "jan-stastny-1816": dict(n="Jan Šťastný", sex="M", y="1816–1885", st="doc", f=["* 3. 9. 1816 Skuteč čp. 130", "sedlák", "× 3. 4. 1843 Polička Terezie Lukešová", "† 27. 4. 1885 Skuteč"], r=["policka_snatek_jan_stastny_terezie_lukesova_1843"]),  # č. 126
    "terezie-lukesova-1818": dict(n="Terezie Lukešová", sex="F", y="1818–1873", st="doc", f=["* 28. 8. 1818 Polička čp. 68", "× 3. 4. 1843 Polička Jan Šťastný", "† 18. 2. 1873 Skuteč"], r=["policka_snatek_jan_stastny_terezie_lukesova_1843"]),  # č. 127
    "vaclav-novak-1758": dict(n="Václav Novák", sex="M", y="1758–1822", st="doc", f=["* 1758 Ostřetín čp. 15", "kovář; 1786 se přiženil na kovárnu v Holicích čp. 112", "× 1786 Holice Kateřina Ryšavá", "† 1822 Holice"], r=["holice_snatek_vaclav_novak_katerina_rysava_1786"]),  # č. 128
    "katerina-rysava-1764": dict(n="Kateřina Ryšavá", sex="F", y="1764–1830", st="doc", f=["* 1764 Holice čp. 112", "dcera kováře Jakuba Ryšavého", "× 1786 Holice Václav Novák", "† 1830 Holice"], r=["holice_snatek_vaclav_novak_katerina_rysava_1786"]),  # č. 129
    "vaclav-junek-1769": dict(n="Václav Junek", sex="M", y="1769–1840", st="doc", f=["* 21. 11. 1769 Holice čp. 121", "hostinský", "× 3. 9. 1802 Horní Ředice Lidmila Jelínková", "† 14. 4. 1840 Holice"], r=["horni_redice_snatek_vaclav_junek_lidmila_jelinkova_1802"]),  # č. 130
    "lidmila-jelinkova-1774": dict(n="Lidmila Jelínková", sex="F", y="1774–1853", st="doc", f=["* 8. 4. 1774 Horní Ředice čp. 42", "× 3. 9. 1802 Horní Ředice Václav Junek", "† 16. 9. 1853 Ostřetín"], r=["horni_redice_snatek_vaclav_junek_lidmila_jelinkova_1802"]),  # č. 131
    "pavel-urban-1773": dict(n="Pavel Urban", sex="M", y="1773–1837", st="prob", f=["* 22. 3. 1773 Holice čp. 134", "sedlák", "× 11. 9. 1804 Býšť Veronika Vávrová", "† 3. 12. 1837 Holice"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 132
    "veronika-vavrova-1776": dict(n="Veronika Vávrová", sex="F", y="1776–1824", st="prob", f=["* 19. 9. 1776 Býšť čp. 25", "× 11. 9. 1804 Býšť Pavel Urban", "† 13. 4. 1824 Holice"], note="Shoda jména, domu a doby – přímý doklad chybí."),  # č. 133
    "jakub-maly-1772": dict(n="Jakub Malý", sex="M", y="1772–1854", st="doc", f=["* 6. 12. 1772 Ostřetín čp. 23", "tkadlec", "× 19. 8. 1797 Horní Ředice Anna Dušková", "† 19. 1. 1854 Ostřetín"], r=["horni_redice_snatek_jakub_maly_anna_duskova_1797"]),  # č. 136
    "anna-duskova-1778": dict(n="Anna Dušková", sex="F", y="1778–1842", st="prob", f=["* 26. 3. 1778 Horní Ředice čp. 16", "× 19. 8. 1797 Horní Ředice Jakub Malý", "† 27. 6. 1842 Ostřetín"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 137
    "matej-sedlacek-1771": dict(n="Matěj Sedláček", sex="M", y="1771–1838", st="doc", f=["* 3. 6. 1771 Býšť čp. 46", "tkadlec", "× 17. 7. 1797 Býšť Lidmila Říhová", "† 28. 8. 1838 Býšť"], r=["byst_snatek_matej_sedlacek_lidmila_rihova_1797"]),  # č. 138
    "lidmila-rihova-1769": dict(n="Lidmila Říhová", sex="F", y="1769–1833", st="prob", f=["* 28. 1. 1769 Býšť čp. 109", "× 17. 7. 1797 Býšť Matěj Sedláček", "† 13. 10. 1833 Býšť"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 139
    "zuzana-kalousova-1773": dict(n="Zuzana Kalousová", sex="F", y="1773–1842", st="doc", f=["* 11. 7. 1773 Ostřetín čp. 84", "† 10. 1. 1842 Ostřetín"], r=["ostretin_umrti_zuzana_kalousova_1842"]),  # č. 141
    "anna-vackova-1770": dict(n="Anna Vacková", sex="F", y="1770–1841", st="doc", f=["* 21. 4. 1770 Sezemice čp. 52", "† 8. 2. 1841 Dolní Roveň"], r=["dolni_roven_umrti_anna_vackova_1841"]),  # č. 145
    "ludmila-prochazkova-1784": dict(n="Ludmila Procházková", sex="F", y="1784–1863", st="doc", f=["* 7. 2. 1784 Dolní Roveň čp. 78", "† 6. 7. 1863 Dolní Roveň"], r=["dolni_roven_umrti_ludmila_prochazkova_1863"]),  # č. 147
    "ondrej-lukes-1771": dict(n="Ondřej Lukeš", sex="M", y="1771–1819", st="doc", f=["* 9. 7. 1771 Dolní Roveň čp. 111", "sládek", "× 3. 12. 1796 Sezemice Barbora Vlčková", "† 19. 3. 1819 Dolní Roveň"], r=["sezemice_snatek_ondrej_lukes_barbora_vlckova_1796"]),  # č. 148
    "barbora-vlckova-1769": dict(n="Barbora Vlčková", sex="F", y="1769–1845", st="doc", f=["* 12. 12. 1769 Sezemice čp. 103", "× 3. 12. 1796 Sezemice Ondřej Lukeš", "† 27. 5. 1845 Dolní Roveň"], r=["sezemice_snatek_ondrej_lukes_barbora_vlckova_1796"]),  # č. 149
    "lidmila-bartosova-1783": dict(n="Lidmila Bartošová", sex="F", y="1783–1841", st="doc", f=["* 19. 12. 1783 Moravany čp. 63", "† 8. 7. 1841 Moravany"], r=["moravany_umrti_lidmila_bartosova_1841"]),  # č. 151
    "alzbeta-vesela-1778": dict(n="Alžběta Veselá", sex="F", y="1778–1847", st="prob", f=["* 23. 1. 1778 Sezemice čp. 69", "† 9. 10. 1847 Horní Roveň"], note="Shoda jména, domu a doby – přímý doklad chybí."),  # č. 153
    "jiri-pilar-1780": dict(n="Jiří Pilař", sex="M", y="1780–1838", st="doc", f=["* 21. 7. 1780 Dolní Roveň čp. 53", "řezník", "† 21. 2. 1838 Dolní Roveň"], r=["dolni_roven_umrti_jiri_pilar_1838"]),  # č. 156
    "simon-stepanek-1779": dict(n="Šimon Štěpánek", sex="M", y="1779–1846", st="doc", f=["* 7. 8. 1779 Sezemice čp. 74", "řezník", "† 27. 5. 1846 Sezemice"], r=["sezemice_umrti_simon_stepanek_1846"]),  # č. 158
    "lidmila-hajkova-1787": dict(n="Lidmila Hájková", sex="F", y="1787–1854", st="doc", f=["* 19. 8. 1787 Holice čp. 93", "† 24. 10. 1854 Holice"], r=["holice_umrti_lidmila_hajkova_1854"]),  # č. 163
    "magdalena-svobodova-1779": dict(n="Magdalena Svobodová", sex="F", y="1779–1846", st="doc", f=["* 12. 11. 1779 Ostřetín čp. 82", "† 21. 2. 1846 Dašice"], r=["dasice_umrti_magdalena_svobodova_1846"]),  # č. 165
    "tomas-zeman-1786": dict(n="Tomáš Zeman", sex="M", y="1786–1834", st="doc", f=["* 28. 10. 1786 Dašice čp. 43", "hostinský", "× 19. 4. 1810 Holice Zuzana Benešová", "† 24. 9. 1834 Dašice"], r=["holice_snatek_tomas_zeman_zuzana_benesova_1810"]),  # č. 166
    "zuzana-benesova-1786": dict(n="Zuzana Benešová", sex="F", y="1786–1850", st="prob", f=["* 16. 2. 1786 Holice čp. 3", "× 19. 4. 1810 Holice Tomáš Zeman", "† 6. 11. 1850 Dašice"], note="Shoda jména, domu a doby – přímý doklad chybí."),  # č. 167
    "tomas-pospisil-1777": dict(n="Tomáš Pospíšil", sex="M", y="1777–1859", st="prob", f=["* 23. 8. 1777 Vysoké Chvojno čp. 73", "řezník", "× 24. 8. 1808 Vysoké Chvojno Anna Matějková", "† 2. 12. 1859 Vysoké Chvojno"], note="Jen ze zápisu sňatku dítěte; vlastní křest zatím nenalezen."),  # č. 170
    "anna-matejkova-1789": dict(n="Anna Matějková", sex="F", y="1789–1858", st="prob", f=["* 9. 12. 1789 Vysoké Chvojno čp. 69", "× 24. 8. 1808 Vysoké Chvojno Tomáš Pospíšil", "† 5. 4. 1858 Vysoké Chvojno"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 171
    "jan-hruby-1779": dict(n="Jan Hrubý", sex="M", y="1779–1852", st="doc", f=["* 24. 3. 1779 Choceň čp. 123", "soukeník", "× 20. 4. 1802 Choceň Dorota Černá", "† 15. 12. 1852 Choceň"], r=["chocen_snatek_jan_hruby_dorota_cerna_1802"]),  # č. 176
    "dorota-cerna-1784": dict(n="Dorota Černá", sex="F", y="1784–1848", st="doc", f=["* 12. 10. 1784 Choceň čp. 100", "× 20. 4. 1802 Choceň Jan Hrubý", "† 10. 6. 1848 Vysoké Mýto"], r=["chocen_snatek_jan_hruby_dorota_cerna_1802"]),  # č. 177
    "martin-cerny-1777": dict(n="Martin Černý", sex="M", y="1777–1848", st="prob", f=["* 7. 9. 1777 Choceň čp. 26", "ovčák", "× 9. 4. 1810 Choceň Magdalena Machová", "† 17. 12. 1848 Choceň"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 178
    "magdalena-machova-1785": dict(n="Magdalena Machová", sex="F", y="1785–1840", st="doc", f=["* 3. 4. 1785 Choceň čp. 4", "× 9. 4. 1810 Choceň Martin Černý", "† 6. 6. 1840 Choceň"], r=["chocen_snatek_martin_cerny_magdalena_machova_1810"]),  # č. 179
    "karel-fiala-1790": dict(n="Karel Fiala", sex="M", y="1790–1866", st="doc", f=["* 15. 2. 1790 Vysoké Mýto čp. 84", "tkadlec", "× 7. 10. 1815 Choceň Kateřina Pospíšilová", "† 1. 1. 1866 Vysoké Mýto"], r=["chocen_snatek_karel_fiala_katerina_pospisilova_1815"]),  # č. 180
    "katerina-pospisilova-1792": dict(n="Kateřina Pospíšilová", sex="F", y="1792–1856", st="doc", f=["* 7. 2. 1792 Choceň čp. 59", "× 7. 10. 1815 Choceň Karel Fiala", "† 1. 4. 1856 Vysoké Mýto"], r=["chocen_snatek_karel_fiala_katerina_pospisilova_1815"]),  # č. 181
    "johana-horakova-1792": dict(n="Johana Horáková", sex="F", y="1792–1874", st="doc", f=["* 22. 1. 1792 Zámrsk čp. 137", "† 26. 1. 1874 Choceň"], r=["chocen_umrti_johana_horakova_1874"]),  # č. 183
    "jan-dusek-1788": dict(n="Jan Dušek", sex="M", y="1788–1864", st="doc", f=["* 15. 6. 1788 Uhersko čp. 67", "zedník", "× 7. 5. 1819 Zámrsk Josefa Hrdinová", "† 3. 6. 1864 Uhersko"], r=["zamrsk_snatek_jan_dusek_josefa_hrdinova_1819"]),  # č. 184
    "josefa-hrdinova-1796": dict(n="Josefa Hrdinová", sex="F", y="1796–1865", st="doc", f=["* 16. 11. 1796 Zámrsk čp. 84", "× 7. 5. 1819 Zámrsk Jan Dušek", "† 15. 2. 1865 Uhersko"], r=["zamrsk_snatek_jan_dusek_josefa_hrdinova_1819"]),  # č. 185
    "tomas-prochazka-1792": dict(n="Tomáš Procházka", sex="M", y="1792–1868", st="doc", f=["* 10. 9. 1792 Uhersko čp. 80", "tesař", "× 24. 9. 1821 Zámrsk Johana Říhová", "† 6. 5. 1868 Uhersko"], r=["zamrsk_snatek_tomas_prochazka_johana_rihova_1821"]),  # č. 186
    "johana-rihova-1795": dict(n="Johana Říhová", sex="F", y="1795–1853", st="doc", f=["* 28. 7. 1795 Zámrsk čp. 130", "× 24. 9. 1821 Zámrsk Tomáš Procházka", "† 24. 10. 1853 Uhersko"], r=["zamrsk_snatek_tomas_prochazka_johana_rihova_1821"]),  # č. 187
    "simon-holub-1779": dict(n="Šimon Holub", sex="M", y="1779–1850", st="doc", f=["* 24. 5. 1779 Uhersko čp. 71", "tesař", "× 26. 10. 1813 Choceň Zuzana Jelínková", "† 28. 8. 1850 Uhersko"], r=["chocen_snatek_simon_holub_zuzana_jelinkova_1813"]),  # č. 188
    "zuzana-jelinkova-1788": dict(n="Zuzana Jelínková", sex="F", y="1788–1870", st="prob", f=["* 26. 5. 1788 Choceň čp. 31", "× 26. 10. 1813 Choceň Šimon Holub", "† 17. 11. 1870 Vysoké Mýto"], note="Shoda jména, domu a doby – přímý doklad chybí."),  # č. 189
    "mikulas-hrdina-1781": dict(n="Mikuláš Hrdina", sex="M", y="1781–1863", st="prob", f=["* 23. 8. 1781 Uhersko čp. 49", "rychtář a sedlák", "† 10. 6. 1863 Uhersko"], note="Shoda jména, domu a doby – přímý doklad chybí."),  # č. 190
    "matej-dvorak-1773": dict(n="Matěj Dvořák", sex="M", y="1773–1842", st="doc", f=["* 3. 1. 1773 Nasavrky čp. 73", "tkadlec", "† 9. 3. 1842 Nasavrky"], r=["nasavrky_umrti_matej_dvorak_1842"]),  # č. 192
    "ondrej-pesek-1780": dict(n="Ondřej Pešek", sex="M", y="1780–1838", st="doc", f=["* 21. 11. 1780 Heřmanův Městec čp. 93", "tkadlec", "× 23. 12. 1809 Nasavrky Dorota Žáková", "† 9. 2. 1838 Heřmanův Městec"], r=["nasavrky_snatek_ondrej_pesek_dorota_zakova_1809"]),  # č. 196
    "dorota-zakova-1782": dict(n="Dorota Žáková", sex="F", y="1782–1844", st="doc", f=["* 7. 3. 1782 Nasavrky čp. 96", "× 23. 12. 1809 Nasavrky Ondřej Pešek", "† 18. 8. 1844 Heřmanův Městec"], r=["nasavrky_snatek_ondrej_pesek_dorota_zakova_1809"]),  # č. 197
    "antonin-moravec-1795": dict(n="Antonín Moravec", sex="M", y="1795–1864", st="prob", f=["* 12. 2. 1795 Hlinsko čp. 56", "panský myslivec", "× 13. 1. 1818 Nasavrky Johana Pospíšilová", "† 18. 1. 1864 Hlinsko"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 198
    "johana-pospisilova-1794": dict(n="Johana Pospíšilová", sex="F", y="1794–1842", st="doc", f=["* 12. 5. 1794 Nasavrky čp. 96", "× 13. 1. 1818 Nasavrky Antonín Moravec", "† 2. 2. 1842 Hlinsko"], r=["nasavrky_snatek_antonin_moravec_johana_pospisilova_1818"]),  # č. 199
    "jan-bartos-1776": dict(n="Jan Bartoš", sex="M", y="1776–1831", st="doc", f=["* 2. 3. 1776 Chrudim čp. 86", "hostinský", "× 2. 3. 1807 Chrudim Magdalena Křížová", "† 12. 1. 1831 Chrudim"], r=["chrudim_snatek_jan_bartos_magdalena_krizova_1807"]),  # č. 200
    "magdalena-krizova-1787": dict(n="Magdalena Křížová", sex="F", y="1787–1849", st="doc", f=["* 28. 8. 1787 Chrudim čp. 101", "× 2. 3. 1807 Chrudim Jan Bartoš", "† 11. 7. 1849 Hlinsko"], r=["chrudim_snatek_jan_bartos_magdalena_krizova_1807"]),  # č. 201
    "tomas-svoboda-1780": dict(n="Tomáš Svoboda", sex="M", y="1780–1842", st="doc", f=["* 2. 8. 1780 Heřmanův Městec čp. 78", "zedník", "× 6. 4. 1813 Chrudim Anna Matějková", "† 14. 2. 1842 Heřmanův Městec"], r=["chrudim_snatek_tomas_svoboda_anna_matejkova_1813"]),  # č. 202
    "anna-matejkova-1785": dict(n="Anna Matějková", sex="F", y="1785–1864", st="doc", f=["* 27. 5. 1785 Chrudim čp. 107", "× 6. 4. 1813 Chrudim Tomáš Svoboda", "† 9. 8. 1864 Heřmanův Městec"], r=["chrudim_snatek_tomas_svoboda_anna_matejkova_1813"]),  # č. 203
    "vojtech-novotny-1780": dict(n="Vojtěch Novotný", sex="M", y="1780–1828", st="doc", f=["* 27. 2. 1780 Heřmanův Městec čp. 112", "domkář", "† 28. 9. 1828 Heřmanův Městec"], r=["hermanuv_mestec_umrti_vojtech_novotny_1828"]),  # č. 204
    "martin-kopecky-1785": dict(n="Martin Kopecký", sex="M", y="1785–1843", st="doc", f=["* 23. 4. 1785 Chrudim čp. 25", "krejčí", "× 28. 10. 1815 Nasavrky Zuzana Černá", "† 19. 4. 1843 Chrudim"], r=["nasavrky_snatek_martin_kopecky_zuzana_cerna_1815"]),  # č. 206
    "zuzana-cerna-1787": dict(n="Zuzana Černá", sex="F", y="1787–1851", st="prob", f=["* 12. 10. 1787 Nasavrky čp. 38", "× 28. 10. 1815 Nasavrky Martin Kopecký", "† 23. 1. 1851 Chrudim"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 207
    "vaclav-kucera-1773": dict(n="Václav Kučera", sex="M", y="1773–1852", st="doc", f=["* 3. 1. 1773 Slatiňany čp. 5", "mlynář", "× 22. 11. 1796 Chrudim Kateřina Sládková", "† 4. 3. 1852 Slatiňany"], r=["chrudim_snatek_vaclav_kucera_katerina_sladkova_1796"]),  # č. 208
    "katerina-sladkova-1773": dict(n="Kateřina Sládková", sex="F", y="1773–1842", st="doc", f=["* 10. 1. 1773 Chrudim čp. 11", "× 22. 11. 1796 Chrudim Václav Kučera", "† 22. 9. 1842 Slatiňany"], r=["chrudim_snatek_vaclav_kucera_katerina_sladkova_1796"]),  # č. 209
    "tomas-mach-1774": dict(n="Tomáš Mach", sex="M", y="1774–1856", st="prob", f=["* 9. 8. 1774 Nasavrky čp. 78", "panský myslivec", "× 25. 12. 1804 Chrudim Lidmila Říhová", "† 27. 3. 1856 Nasavrky"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 210
    "lidmila-rihova-1776": dict(n="Lidmila Říhová", sex="F", y="1776–1849", st="doc", f=["* 20. 12. 1776 Chrudim čp. 140", "× 25. 12. 1804 Chrudim Tomáš Mach", "† 19. 9. 1849 Nasavrky"], r=["chrudim_snatek_tomas_mach_lidmila_rihova_1804"]),  # č. 211
    "jakub-riha-1789": dict(n="Jakub Říha", sex="M", y="1789–1860", st="prob", f=["* 10. 9. 1789 Chrudim čp. 61", "zedník", "† 17. 12. 1860 Chrudim"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 214
    "barbora-peskova-1788": dict(n="Barbora Pešková", sex="F", y="1788–1867", st="doc", f=["* 10. 11. 1788 Nasavrky čp. 54", "† 25. 4. 1867 Nasavrky"], r=["nasavrky_umrti_barbora_peskova_1867"]),  # č. 219
    "jan-simek-1769": dict(n="Jan Šimek", sex="M", y="1769–1824", st="prob", f=["* 16. 11. 1769 Chrudim čp. 77", "truhlář", "× 15. 3. 1802 Chrudim Alžběta Urbanová", "† 15. 2. 1824 Chrudim"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 224
    "alzbeta-urbanova-1777": dict(n="Alžběta Urbanová", sex="F", y="1777–1832", st="doc", f=["* 11. 12. 1777 Chrudim čp. 15", "× 15. 3. 1802 Chrudim Jan Šimek", "† 10. 3. 1832 Chrudim"], r=["chrudim_snatek_jan_simek_alzbeta_urbanova_1802"]),  # č. 225
    "vaclav-kolar-1770": dict(n="Václav Kolář", sex="M", y="1770–1828", st="doc", f=["* 23. 4. 1770 Proseč čp. 23", "panský myslivec", "† 22. 5. 1828 Proseč"], r=["prosec_umrti_vaclav_kolar_1828"]),  # č. 226
    "jakub-dolezal-1784": dict(n="Jakub Doležal", sex="M", y="1784–1866", st="doc", f=["* 25. 6. 1784 Chrudim čp. 65", "pekař", "† 22. 3. 1866 Chrudim"], r=["chrudim_umrti_jakub_dolezal_1866"]),  # č. 228
    "jan-zak-1790": dict(n="Jan Žák", sex="M", y="1790–1857", st="prob", f=["* 1. 4. 1790 Chrudim čp. 63", "bednář", "† 24. 9. 1857 Chrudim"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 230
    "josefa-zemanova-1798": dict(n="Josefa Zemanová", sex="F", y="1798–1856", st="prob", f=["* 26. 5. 1798 Skuteč čp. 33", "† 22. 8. 1856 Skuteč"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 237
    "pavel-vondracek-1777": dict(n="Pavel Vondráček", sex="M", y="1777–1844", st="doc", f=["* 22. 3. 1777 Luže čp. 88", "hrnčíř", "† 2. 9. 1844 Luže"], r=["luze_umrti_pavel_vondracek_1844"]),  # č. 240
    "katerina-moravcova-1792": dict(n="Kateřina Moravcová", sex="F", y="1792–1840", st="doc", f=["* 14. 6. 1792 Skuteč čp. 76", "† 25. 12. 1840 Luže"], r=["luze_umrti_katerina_moravcova_1840"]),  # č. 243
    "jiri-riha-1794": dict(n="Jiří Říha", sex="M", y="1794–1865", st="doc", f=["* 6. 8. 1794 Litomyšl čp. 75", "panský myslivec", "× 28. 9. 1827 Luže Anna Dušková", "† 15. 10. 1865 Litomyšl"], r=["luze_snatek_jiri_riha_anna_duskova_1827"]),  # č. 246
    "anna-duskova-1809": dict(n="Anna Dušková", sex="F", y="1809–1867", st="doc", f=["* 27. 7. 1809 Luže čp. 131", "× 28. 9. 1827 Luže Jiří Říha", "† 28. 9. 1867 Litomyšl"], r=["luze_snatek_jiri_riha_anna_duskova_1827"]),  # č. 247
    "magdalena-krizova-1784": dict(n="Magdalena Křížová", sex="F", y="1784–1857", st="doc", f=["* 26. 6. 1784 Litomyšl čp. 45", "† 2. 5. 1857 Skuteč"], r=["skutec_umrti_magdalena_krizova_1857"]),  # č. 249
    "vojtech-kopecky-1782": dict(n="Vojtěch Kopecký", sex="M", y="1782–1844", st="prob", f=["* 28. 2. 1782 Polička čp. 66", "krejčí", "× 5. 3. 1815 Litomyšl Kateřina Fialová", "† 23. 5. 1844 Polička"], note="Shoda jména, domu a doby – přímý doklad chybí."),  # č. 250
    "katerina-fialova-1794": dict(n="Kateřina Fialová", sex="F", y="1794–1861", st="doc", f=["* 14. 8. 1794 Litomyšl čp. 120", "× 5. 3. 1815 Litomyšl Vojtěch Kopecký", "† 17. 8. 1861 Skuteč"], r=["litomysl_snatek_vojtech_kopecky_katerina_fialova_1815"]),  # č. 251
    "ondrej-stastny-1782": dict(n="Ondřej Šťastný", sex="M", y="1782–1864", st="doc", f=["* 4. 10. 1782 Skuteč čp. 130", "řezník", "× 27. 3. 1815 Luže Rozálie Vlčková", "† 8. 11. 1864 Skuteč"], r=["luze_snatek_ondrej_stastny_rozalie_vlckova_1815"]),  # č. 252
    "rozalie-vlckova-1795": dict(n="Rozálie Vlčková", sex="F", y="1795–1862", st="prob", f=["* 15. 4. 1795 Luže čp. 82", "× 27. 3. 1815 Luže Ondřej Šťastný", "† 17. 12. 1862 Skuteč"], note="Jen ze zápisu sňatku dítěte; vlastní křest zatím nenalezen."),  # č. 253
    "simon-lukes-1788": dict(n="Šimon Lukeš", sex="M", y="1788–1870", st="doc", f=["* 7. 4. 1788 Polička čp. 68", "pekař", "× 13. 10. 1816 Litomyšl Anna Lukešová", "† 24. 1. 1870 Polička"], r=["litomysl_snatek_simon_lukes_anna_lukesova_1816"]),  # č. 254
    "anna-lukesova-1794": dict(n="Anna Lukešová", sex="F", y="1794–1852", st="doc", f=["* 23. 9. 1794 Litomyšl čp. 22", "× 13. 10. 1816 Litomyšl Šimon Lukeš", "† 16. 9. 1852 Polička"], r=["litomysl_snatek_simon_lukes_anna_lukesova_1816"]),  # č. 255
    "matej-novak-1726": dict(n="Matěj Novák", sex="M", y="1726–1790", st="doc", f=["* 1726 Ostřetín čp. 15", "kovář", "× 1. 1. 1757 Býšť Kateřina Matějková", "† 1790 Ostřetín"], r=["byst_snatek_matej_novak_katerina_matejkova_1757"]),  # č. 256
    "katerina-matejkova-1729": dict(n="Kateřina Matějková", sex="F", y="1729–1777", st="prob", f=["* 19. 10. 1729 Býšť čp. 83", "× 1. 1. 1757 Býšť Matěj Novák", "† 23. 12. 1777 Ostřetín"], note="Jen ze zápisu sňatku dítěte; vlastní křest zatím nenalezen."),  # č. 257
    "jakub-rysavy-1730": dict(n="Jakub Ryšavý", sex="M", y="1730–1789", st="doc", f=["* 1730 Holice čp. 112", "kovář, poslední Ryšavý na kovárně čp. 112", "× 10. 7. 1761 Horní Ředice Marie Křížová", "† 1789 Holice"], r=["horni_redice_snatek_jakub_rysavy_marie_krizova_1761"]),  # č. 258
    "marie-krizova-1733": dict(n="Marie Křížová", sex="F", y="1733–1802", st="prob", f=["* 18. 7. 1733 Horní Ředice čp. 104", "× 10. 7. 1761 Horní Ředice Jakub Ryšavý", "† 23. 6. 1802 Holice"], note="Shoda jména, domu a doby – přímý doklad chybí."),  # č. 259
    "ondrej-urban-1744": dict(n="Ondřej Urban", sex="M", y="1744–1806", st="prob", f=["* 10. 4. 1744 Holice čp. 134", "řezník", "† 10. 6. 1806 Holice"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 264
    "tomas-vavra-1750": dict(n="Tomáš Vávra", sex="M", y="1750–1817", st="prob", f=["* 26. 6. 1750 Holice čp. 124", "sedlák", "† 21. 8. 1817 Holice"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 266
    "vojtech-maly-1736": dict(n="Vojtěch Malý", sex="M", y="1736–1818", st="doc", f=["* 4. 11. 1736 Ostřetín čp. 23", "tkadlec", "× 25. 7. 1770 Horní Ředice Anna Moravcová", "† 28. 2. 1818 Ostřetín"], r=["horni_redice_snatek_vojtech_maly_anna_moravcova_1770"]),  # č. 272
    "anna-moravcova-1742": dict(n="Anna Moravcová", sex="F", y="1742–1824", st="prob", f=["* 12. 2. 1742 Horní Ředice čp. 100", "× 25. 7. 1770 Horní Ředice Vojtěch Malý", "† 23. 2. 1824 Ostřetín"], note="Shoda jména, domu a doby – přímý doklad chybí."),  # č. 273
    "alzbeta-sladkova-1753": dict(n="Alžběta Sládková", sex="F", y="1753–1817", st="prob", f=["* 13. 1. 1753 Býšť čp. 61", "† 27. 11. 1817 Horní Ředice"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 275
    "tomas-riha-1742": dict(n="Tomáš Říha", sex="M", y="1742–1806", st="prob", f=["* 12. 12. 1742 Býšť čp. 109", "pekař", "† 18. 7. 1806 Býšť"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 278
    "simon-vacek-1734": dict(n="Šimon Vacek", sex="M", y="1734–1782", st="prob", f=["* 10. 8. 1734 Sezemice čp. 52", "domkář", "† 2. 7. 1782 Sezemice"], note="Shoda jména, domu a doby – přímý doklad chybí."),  # č. 290
    "barbora-vavrova-1755": dict(n="Barbora Vávrová", sex="F", y="1755–1813", st="prob", f=["* 21. 4. 1755 Sezemice čp. 70", "† 12. 7. 1813 Dolní Roveň"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 295
    "magdalena-dolezalova-1753": dict(n="Magdalena Doležalová", sex="F", y="1753–1835", st="prob", f=["* 17. 7. 1753 Dolní Roveň čp. 128", "† 14. 10. 1835 Moravany"], note="Jen ze zápisu sňatku dítěte; vlastní křest zatím nenalezen."),  # č. 303
    "zuzana-zemanova-1752": dict(n="Zuzana Zemanová", sex="F", y="1752–1819", st="doc", f=["* 5. 1. 1752 Horní Roveň čp. 52", "† 28. 12. 1819 Sezemice"], r=["sezemice_umrti_zuzana_zemanova_1819"]),  # č. 307
    "vojtech-pilar-1748": dict(n="Vojtěch Pilař", sex="M", y="1748–1806", st="doc", f=["* 3. 10. 1748 Dolní Roveň čp. 53", "tkadlec", "× 8. 6. 1778 Moravany Barbora Junková", "† 3. 9. 1806 Dolní Roveň"], r=["moravany_snatek_vojtech_pilar_barbora_junkova_1778"]),  # č. 312
    "barbora-junkova-1751": dict(n="Barbora Junková", sex="F", y="1751–1824", st="doc", f=["* 8. 10. 1751 Moravany čp. 92", "× 8. 6. 1778 Moravany Vojtěch Pilař", "† 8. 1. 1824 Dolní Roveň"], r=["moravany_snatek_vojtech_pilar_barbora_junkova_1778"]),  # č. 313
    "vojtech-hajek-1760": dict(n="Vojtěch Hájek", sex="M", y="1760–1829", st="doc", f=["* 2. 9. 1760 Holice čp. 93", "tkadlec", "† 18. 12. 1829 Holice"], r=["holice_umrti_vojtech_hajek_1829"]),  # č. 326
    "barbora-kubatova-1758": dict(n="Barbora Kubátová", sex="F", y="1758–1820", st="doc", f=["* 1. 8. 1758 Dašice čp. 17", "† 16. 1. 1820 Dašice"], r=["dasice_umrti_barbora_kubatova_1820"]),  # č. 333
    "magdalena-markova-1762": dict(n="Magdalena Marková", sex="F", y="1762–1841", st="doc", f=["* 18. 10. 1762 Ostřetín čp. 45", "† 22. 4. 1841 Holice"], r=["holice_umrti_magdalena_markova_1841"]),  # č. 335
    "mikulas-pospisil-1746": dict(n="Mikuláš Pospíšil", sex="M", y="1746–1794", st="doc", f=["* 4. 12. 1746 Vysoké Chvojno čp. 73", "hostinský", "× 3. 12. 1775 Dašice Lidmila Veselá", "† 25. 10. 1794 Vysoké Chvojno"], r=["dasice_snatek_mikulas_pospisil_lidmila_vesela_1775"]),  # č. 340
    "lidmila-vesela-1753": dict(n="Lidmila Veselá", sex="F", y="1753–1811", st="doc", f=["* 23. 3. 1753 Dašice čp. 72", "× 3. 12. 1775 Dašice Mikuláš Pospíšil", "† 19. 11. 1811 Vysoké Chvojno"], r=["dasice_snatek_mikulas_pospisil_lidmila_vesela_1775"]),  # č. 341
    "jan-cerny-1758": dict(n="Jan Černý", sex="M", y="1758–1820", st="doc", f=["* 15. 3. 1758 Vysoké Mýto čp. 85", "tkadlec", "† 28. 3. 1820 Vysoké Mýto"], r=["vysoke_myto_umrti_jan_cerny_1820"]),  # č. 354
    "martin-cerny-1751": dict(n="Martin Černý", sex="M", y="1751–1820", st="prob", f=["* 7. 10. 1751 Choceň čp. 26", "zedník", "† 2. 11. 1820 Choceň"], note="Jen ze zápisu sňatku dítěte; vlastní křest zatím nenalezen."),  # č. 356
    "magdalena-horakova-1763": dict(n="Magdalena Horáková", sex="F", y="1763–1830", st="doc", f=["* 25. 11. 1763 Zámrsk čp. 33", "† 8. 5. 1830 Choceň"], r=["chocen_umrti_magdalena_horakova_1830"]),  # č. 359
    "barbora-kalousova-1762": dict(n="Barbora Kalousová", sex="F", y="1762–1838", st="doc", f=["* 27. 1. 1762 Uhersko čp. 67", "† 20. 4. 1838 Vysoké Mýto"], r=["vysoke_myto_umrti_barbora_kalousova_1838"]),  # č. 361
    "jiri-horak-1757": dict(n="Jiří Horák", sex="M", y="1757–1839", st="doc", f=["* 22. 5. 1757 Zámrsk čp. 137", "kolář", "† 15. 8. 1839 Zámrsk"], r=["zamrsk_umrti_jiri_horak_1839"]),  # č. 366
    "alzbeta-stastna-1757": dict(n="Alžběta Šťastná", sex="F", y="1757–1819", st="prob", f=["* 14. 4. 1757 Zámrsk čp. 129", "† 26. 6. 1819 Uhersko"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 369
    "martin-hrdina-1768": dict(n="Martin Hrdina", sex="M", y="1768–1823", st="doc", f=["* 6. 2. 1768 Zámrsk čp. 84", "tesař", "× 11. 5. 1793 Uhersko Marie Doležalová", "† 23. 5. 1823 Zámrsk"], r=["uhersko_snatek_martin_hrdina_marie_dolezalova_1793"]),  # č. 370
    "marie-dolezalova-1774": dict(n="Marie Doležalová", sex="F", y="1774–1850", st="prob", f=["* 11. 7. 1774 Uhersko čp. 90", "× 11. 5. 1793 Uhersko Martin Hrdina", "† 7. 6. 1850 Zámrsk"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 371
    "jan-prochazka-1759": dict(n="Jan Procházka", sex="M", y="1759–1826", st="doc", f=["* 21. 6. 1759 Uhersko čp. 80", "pekař", "† 12. 4. 1826 Uhersko"], r=["uhersko_umrti_jan_prochazka_1826"]),  # č. 372
    "ludmila-svobodova-1769": dict(n="Ludmila Svobodová", sex="F", y="1769–1848", st="prob", f=["* 12. 12. 1769 Uhersko čp. 95", "† 2. 3. 1848 Zámrsk"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 375
    "vojtech-holub-1750": dict(n="Vojtěch Holub", sex="M", y="1750–1829", st="prob", f=["* 17. 2. 1750 Uhersko čp. 71", "řezník", "× 5. 11. 1777 Choceň Ludmila Žáková", "† 12. 7. 1829 Uhersko"], note="Jen ze zápisu sňatku dítěte; vlastní křest zatím nenalezen."),  # č. 376
    "ludmila-zakova-1754": dict(n="Ludmila Žáková", sex="F", y="1754–1818", st="doc", f=["* 20. 1. 1754 Choceň čp. 118", "× 5. 11. 1777 Choceň Vojtěch Holub", "† 27. 6. 1818 Uhersko"], r=["chocen_snatek_vojtech_holub_ludmila_zakova_1777"]),  # č. 377
    "dorota-fialova-1752": dict(n="Dorota Fialová", sex="F", y="1752–1831", st="doc", f=["* 3. 9. 1752 Choceň čp. 109", "† 9. 3. 1831 Uhersko"], r=["uhersko_umrti_dorota_fialova_1831"]),  # č. 381
    "matej-dvorak-1740": dict(n="Matěj Dvořák", sex="M", y="1740–1819", st="doc", f=["* 8. 5. 1740 Nasavrky čp. 73", "tkadlec", "† 9. 8. 1819 Nasavrky"], r=["nasavrky_umrti_matej_dvorak_1819"]),  # č. 384
    "jakub-pesek-1749": dict(n="Jakub Pešek", sex="M", y="1749–1807", st="doc", f=["* 9. 8. 1749 Heřmanův Městec čp. 93", "švec", "† 4. 1. 1807 Heřmanův Městec"], r=["hermanuv_mestec_umrti_jakub_pesek_1807"]),  # č. 392
    "ludmila-novotna-1767": dict(n="Ludmila Novotná", sex="F", y="1767–1815", st="doc", f=["* 27. 8. 1767 Hlinsko čp. 130", "† 5. 8. 1815 Hlinsko"], r=["hlinsko_umrti_ludmila_novotna_1815"]),  # č. 397
    "vojtech-pospisil-1759": dict(n="Vojtěch Pospíšil", sex="M", y="1759–1838", st="doc", f=["* 5. 7. 1759 Nasavrky čp. 96", "sedlák", "† 21. 4. 1838 Nasavrky"], r=["nasavrky_umrti_vojtech_pospisil_1838"]),  # č. 398
    "pavel-bartos-1747": dict(n="Pavel Bartoš", sex="M", y="1747–1823", st="prob", f=["* 3. 6. 1747 Chrudim čp. 86", "ovčák", "† 1. 3. 1823 Chrudim"], note="Shoda jména, domu a doby – přímý doklad chybí."),  # č. 400
    "ludmila-prochazkova-1753": dict(n="Ludmila Procházková", sex="F", y="1753–1826", st="prob", f=["* 19. 9. 1753 Hlinsko čp. 46", "† 28. 8. 1826 Heřmanův Městec"], note="Shoda jména, domu a doby – přímý doklad chybí."),  # č. 405
    "tomas-kopecky-1756": dict(n="Tomáš Kopecký", sex="M", y="1756–1823", st="doc", f=["* 18. 9. 1756 Chrudim čp. 25", "zedník", "† 11. 2. 1823 Chrudim"], r=["chrudim_umrti_tomas_kopecky_1823"]),  # č. 412
    "jan-cerny-1760": dict(n="Jan Černý", sex="M", y="1760–1836", st="doc", f=["* 14. 2. 1760 Nasavrky čp. 38", "zedník", "† 21. 4. 1836 Nasavrky"], r=["nasavrky_umrti_jan_cerny_1836"]),  # č. 414
    "jiri-mach-1740": dict(n="Jiří Mach", sex="M", y="1740–1822", st="prob", f=["* 3. 11. 1740 Nasavrky čp. 78", "tkadlec", "† 25. 12. 1822 Nasavrky"], note="Shoda jména, domu a doby – přímý doklad chybí."),  # č. 420
    "ondrej-riha-1756": dict(n="Ondřej Říha", sex="M", y="1756–1829", st="prob", f=["* 12. 12. 1756 Nasavrky čp. 140", "bednář", "† 1. 3. 1829 Nasavrky"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 428
    "vaclav-pesek-1762": dict(n="Václav Pešek", sex="M", y="1762–1817", st="doc", f=["* 12. 6. 1762 Nasavrky čp. 54", "švec", "† 9. 9. 1817 Nasavrky"], r=["nasavrky_umrti_vaclav_pesek_1817"]),  # č. 438
    "ondrej-simek-1736": dict(n="Ondřej Šimek", sex="M", y="1736–1818", st="prob", f=["* 1. 8. 1736 Chrudim čp. 77", "truhlář", "† 1. 9. 1818 Chrudim"], note="Shoda jména, domu a doby – přímý doklad chybí."),  # č. 448
    "jiri-urban-1745": dict(n="Jiří Urban", sex="M", y="1745–1800", st="doc", f=["* 22. 5. 1745 Chrudim čp. 15", "hostinský", "† 15. 8. 1800 Chrudim"], r=["chrudim_umrti_jiri_urban_1800"]),  # č. 450
    "marie-pilarova-1762": dict(n="Marie Pilařová", sex="F", y="1762–1831", st="prob", f=["* 23. 6. 1762 Luže čp. 83", "† 16. 9. 1831 Chrudim"], note="Jen ze zápisu sňatku dítěte; vlastní křest zatím nenalezen."),  # č. 457
    "matej-zeman-1763": dict(n="Matěj Zeman", sex="M", y="1763–1818", st="doc", f=["* 15. 10. 1763 Skuteč čp. 33", "bednář", "× 4. 10. 1797 Chrudim Ludmila Dušková", "† 23. 8. 1818 Skuteč"], r=["chrudim_snatek_matej_zeman_ludmila_duskova_1797"]),  # č. 474
    "ludmila-duskova-1771": dict(n="Ludmila Dušková", sex="F", y="1771–1840", st="doc", f=["* 3. 7. 1771 Chrudim čp. 26", "× 4. 10. 1797 Chrudim Matěj Zeman", "† 3. 4. 1840 Skuteč"], r=["chrudim_snatek_matej_zeman_ludmila_duskova_1797"]),  # č. 475
    "ludmila-kalousova-1751": dict(n="Ludmila Kalousová", sex="F", y="1751–1809", st="prob", f=["* 16. 2. 1751 Polička čp. 131", "† 23. 6. 1809 Luže"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 481
    "jan-moravec-1765": dict(n="Jan Moravec", sex="M", y="1765–1844", st="doc", f=["* 22. 1. 1765 Skuteč čp. 76", "domkář", "× 22. 7. 1790 Litomyšl Magdalena Šťastná", "† 14. 5. 1844 Skuteč"], r=["litomysl_snatek_jan_moravec_magdalena_stastna_1790"]),  # č. 486
    "magdalena-stastna-1771": dict(n="Magdalena Šťastná", sex="F", y="1771–1819", st="prob", f=["* 3. 6. 1771 Litomyšl čp. 64", "× 22. 7. 1790 Litomyšl Jan Moravec", "† 13. 1. 1819 Skuteč"], note="Jen ze zápisu sňatku dítěte; vlastní křest zatím nenalezen."),  # č. 487
    "barbora-stastna-1768": dict(n="Barbora Šťastná", sex="F", y="1768–1839", st="doc", f=["* 12. 9. 1768 Skuteč čp. 24", "† 2. 2. 1839 Litomyšl"], r=["litomysl_umrti_barbora_stastna_1839"]),  # č. 493
    "anna-rihova-1778": dict(n="Anna Říhová", sex="F", y="1778–1826", st="doc", f=["* 15. 1. 1778 Polička čp. 77", "† 8. 8. 1826 Luže"], r=["luze_umrti_anna_rihova_1826"]),  # č. 495
    "pavel-kriz-1751": dict(n="Pavel Kříž", sex="M", y="1751–1824", st="prob", f=["* 17. 10. 1751 Litomyšl čp. 45", "panský myslivec", "† 3. 5. 1824 Litomyšl"], note="Shoda jména, domu a doby – přímý doklad chybí."),  # č. 498
    "marie-urbanova-1751": dict(n="Marie Urbanová", sex="F", y="1751–1822", st="doc", f=["* 14. 10. 1751 Skuteč čp. 58", "† 27. 1. 1822 Polička"], r=["policka_umrti_marie_urbanova_1822"]),  # č. 501
    "pavel-fiala-1761": dict(n="Pavel Fiala", sex="M", y="1761–1834", st="doc", f=["* 7. 9. 1761 Litomyšl čp. 120", "zedník", "† 14. 9. 1834 Litomyšl"], r=["litomysl_umrti_pavel_fiala_1834"]),  # č. 502
    "zuzana-pospisilova-1756": dict(n="Zuzana Pospíšilová", sex="F", y="1756–1823", st="prob", f=["* 7. 4. 1756 Luže čp. 40", "† 14. 3. 1823 Skuteč"], note="Jen ze zápisu sňatku dítěte; vlastní křest zatím nenalezen."),  # č. 505
    "pavel-vlcek-1763": dict(n="Pavel Vlček", sex="M", y="1763–1842", st="doc", f=["* 5. 5. 1763 Litomyšl čp. 88", "domkář", "† 11. 11. 1842 Litomyšl"], r=["litomysl_umrti_pavel_vlcek_1842"]),  # č. 506
    "magdalena-ticha-1767": dict(n="Magdalena Tichá", sex="F", y="1767–1815", st="prob", f=["* 12. 9. 1767 Polička čp. 30", "† 28. 10. 1815 Litomyšl"], note="Shoda jména, domu a doby – přímý doklad chybí."),  # č. 511
    "jiri-novak-1694": dict(n="Jiří Novák", sex="M", y="1694–1761", st="doc", f=["* 1694 Ostřetín čp. 15", "kovář v Ostřetíně", "× 2. 10. 1723 Ostřetín Alžběta Novotná", "† 1761 Ostřetín"], r=["ostretin_snatek_jiri_novak_alzbeta_novotna_1723"]),  # č. 512
    "alzbeta-novotna-1701": dict(n="Alžběta Novotná", sex="F", y="1701–1772", st="prob", f=["* 4. 3. 1701 Ostřetín čp. 31", "× 2. 10. 1723 Ostřetín Jiří Novák", "† 28. 9. 1772 Ostřetín"], note="Křest nenalezen – rok podle věku v zápisu úmrtí."),  # č. 513
    "vaclav-matejka-1696": dict(n="Václav Matějka", sex="M", y="1696–1775", st="prob", f=["* 5. 5. 1696 Býšť čp. 83", "krejčí", "† 28. 9. 1775 Býšť"], note="Jen ze zápisu sňatku dítěte; vlastní křest zatím nenalezen."),  # č. 514
    "pavel-vavra-1720": dict(n="Pavel Vávra", sex="M", y="1720–1775", st="doc", f=["* 23. 1. 1720 Sezemice čp. 70", "švec", "× 18. 10. 1753 Sezemice Lidmila Pilařová", "† 22. 1. 1775 Sezemice"], r=["sezemice_snatek_pavel_vavra_lidmila_pilarova_1753"]),  # č. 590
    "lidmila-pilarova-1726": dict(n="Lidmila Pilařová", sex="F", y="1726–1781", st="doc", f=["* 27. 1. 1726 Sezemice čp. 4", "× 18. 10. 1753 Sezemice Pavel Vávra", "† 8. 5. 1781 Sezemice"], r=["sezemice_snatek_pavel_vavra_lidmila_pilarova_1753"]),  # č. 591
    "jakub-pilar-1713": dict(n="Jakub Pilař", sex="M", y="1713–1784", st="doc", f=["* 15. 11. 1713 Dolní Roveň čp. 53", "domkář", "† 18. 2. 1784 Dolní Roveň"], r=["dolni_roven_umrti_jakub_pilar_1784"]),  # č. 624
    "ludmila-kolarova-1748": dict(n="Ludmila Kolářová", sex="F", y="1748–1796", st="doc", f=["* 14. 7. 1748 Uhersko čp. 46", "† 16. 8. 1796 Uhersko"], r=["uhersko_umrti_ludmila_kolarova_1796"]),  # č. 751
    "jan-zak-1728": dict(n="Jan Žák", sex="M", y="1728–1804", st="prob", f=["* 25. 2. 1728 Choceň čp. 118", "tkadlec", "† 7. 3. 1804 Choceň"], note="Shoda jména, domu a doby – přímý doklad chybí."),  # č. 754
    "jan-cerny-1727": dict(n="Jan Černý", sex="M", y="1727–1803", st="prob", f=["* 28. 9. 1727 Nasavrky čp. 38", "hostinský", "† 23. 8. 1803 Nasavrky"], note="Shoda jména, domu a doby – přímý doklad chybí."),  # č. 828
    "jan-stastny-1742": dict(n="Jan Šťastný", sex="M", y="1742–1806", st="doc", f=["* 22. 11. 1742 Litomyšl čp. 64", "rychtář a sedlák", "† 19. 9. 1806 Litomyšl"], r=["litomysl_umrti_jan_stastny_1806"]),  # č. 974
    "pavel-kriz-1722": dict(n="Pavel Kříž", sex="M", y="1722–1798", st="prob", f=["* 11. 2. 1722 Litomyšl čp. 45", "řezník", "† 10. 6. 1798 Litomyšl"], note="Shoda jména, domu a doby – přímý doklad chybí."),  # č. 996
    "jakub-novak-1665": dict(n="Jakub Novák", sex="M", y="asi 1665 – 1729", st="prob", f=["kovář v Ostřetíně (uveden při křtu syna Jiřího 1694)", "× 6. 9. 1691 Býšť Marie Moravcová", "† 1729 Ostřetín (zápis udává věk asi 64 let)"], note="Otec Jiřího podle shody domu, řemesla a jména; vlastní křest je před začátkem matrik."),  # č. 1024
    "marie-moravcova-1665": dict(n="Marie Moravcová", sex="F", y="1665–1713", st="prob", f=["* 6. 2. 1665 Býšť čp. 22", "× 6. 9. 1691 Býšť Jakub Novák", "† 12. 5. 1713 Ostřetín"], note="Jen ze zápisu sňatku dítěte; vlastní křest zatím nenalezen."),  # č. 1025

    # --- boční příbuzní (dřív SIDE) ---
    "bocni-marie-novakova-18921970": dict(druh="bocni", n="Marie Nováková (1892–1970)", t="Sestra Jana, provdaná do Ostřetína.", r=[]),
    "bocni-vaclav-novak-18961916": dict(druh="bocni", n="Václav Novák (1896–1916)", t="Bratr Jana, padl v 1. světové válce u Doberdò.", r=[]),
    "bocni-antonin-kucera-18691941": dict(druh="bocni", n="Antonín Kučera (1869–1941)", t="Bratr Josefa, převzal mlýn v Třemošnici.", r=[]),
}

# Hrany grafu. Pořadí nehraje roli; jedna hrana na řádek.
#   dict(t="rodic", a=<rodič>, b=<dítě>)                       – otec/matka podle sex rodiče
#   dict(t="manzele", a=<muž>, b=<žena>)                       – manželství (rodiče společného dítěte)
#   dict(t="kmotr", a=<kmotr>, b=<křtěnec>) / dict(t="svedek", a=<svědek>, b=<ženich nebo nevěsta>)
#   dict(t="pribuzny", a=<boční záznam>, b=<osoba>)            – volná vazba (dřív SIDE k=…)
# Volitelně u každé hrany: st="doc"/"prob"/… (jistota vazby; bez st platí jistota osob),
# r=[klíče zápisů], datum="…", note="…". Sourozenci, strýcové ap. se NEZAPISUJÍ – plynou z rodičů.

VZTAHY = [
    dict(t="rodic", a="josef-novak-1952", b="petr-novak-1980"),
    dict(t="rodic", a="eva-dvorakova-1955", b="petr-novak-1980"),
    dict(t="rodic", a="frantisek-novak-1921", b="josef-novak-1952"),
    dict(t="rodic", a="marie-kralova-1925", b="josef-novak-1952"),
    dict(t="rodic", a="karel-dvorak-1927", b="eva-dvorakova-1955"),
    dict(t="rodic", a="anna-simkova-1930", b="eva-dvorakova-1955"),
    dict(t="rodic", a="jan-novak-1890", b="frantisek-novak-1921"),
    dict(t="rodic", a="josefa-pokorna-1895", b="frantisek-novak-1921"),
    dict(t="rodic", a="vaclav-kral-1893", b="marie-kralova-1925"),
    dict(t="rodic", a="ludmila-hruba-1898", b="marie-kralova-1925"),
    dict(t="rodic", a="antonin-dvorak-1899", b="karel-dvorak-1927"),
    dict(t="rodic", a="frantiska-kucerova-1902", b="karel-dvorak-1927"),
    dict(t="rodic", a="josef-simek-1901", b="anna-simkova-1930"),
    dict(t="rodic", a="marie-vondrackova-1905", b="anna-simkova-1930"),
    dict(t="rodic", a="vaclav-novak-1858", b="jan-novak-1890"),
    dict(t="rodic", a="barbora-mala-1862", b="jan-novak-1890"),
    dict(t="rodic", a="josef-pokorny-1865", b="josefa-pokorna-1895"),
    dict(t="rodic", a="barbora-sladkova-1868", b="josefa-pokorna-1895"),
    dict(t="rodic", a="josef-kral-1860", b="vaclav-kral-1893"),
    dict(t="rodic", a="johana-markova-1867", b="vaclav-kral-1893"),
    dict(t="rodic", a="josef-hruby-1871", b="ludmila-hruba-1898"),
    dict(t="rodic", a="johana-duskova-1873", b="ludmila-hruba-1898"),
    dict(t="rodic", a="jan-dvorak-1869", b="antonin-dvorak-1899"),
    dict(t="rodic", a="karolina-bartosova-1870", b="antonin-dvorak-1899"),
    dict(t="rodic", a="josef-kucera-1866", b="frantiska-kucerova-1902"),
    dict(t="rodic", a="anna-vavrova-1873", b="frantiska-kucerova-1902"),
    dict(t="rodic", a="josef-simek-1865", b="josef-simek-1901"),
    dict(t="rodic", a="rozalie-krizova-1879", b="josef-simek-1901"),
    dict(t="rodic", a="josef-vondracek-1875", b="marie-vondrackova-1905"),
    dict(t="rodic", a="frantiska-benesova-1875", b="marie-vondrackova-1905"),
    dict(t="rodic", a="jan-novak-1824", b="vaclav-novak-1858"),
    dict(t="rodic", a="marie-urbanova-1836", b="vaclav-novak-1858"),
    dict(t="rodic", a="frantisek-maly-1827", b="barbora-mala-1862"),
    dict(t="rodic", a="josefa-ptackova-1831", b="barbora-mala-1862"),
    dict(t="rodic", a="antonin-pokorny-1829", b="josef-pokorny-1865"),
    dict(t="rodic", a="frantiska-lukesova-1834", b="josef-pokorny-1865"),
    dict(t="rodic", a="josef-sladek-1842", b="barbora-sladkova-1868"),
    dict(t="rodic", a="frantiska-pilarova-1839", b="barbora-sladkova-1868"),
    dict(t="rodic", a="tomas-kral-1832", b="josef-kral-1860"),
    dict(t="rodic", a="anna-vackova-1835", b="josef-kral-1860"),
    dict(t="rodic", a="karel-marek-1839", b="johana-markova-1867"),
    dict(t="rodic", a="johana-vesela-1836", b="johana-markova-1867"),
    dict(t="rodic", a="vaclav-hruby-1841", b="josef-hruby-1871"),
    dict(t="rodic", a="johana-fialova-1848", b="josef-hruby-1871"),
    dict(t="rodic", a="vincenc-dusek-1847", b="johana-duskova-1873"),
    dict(t="rodic", a="johana-holubova-1845", b="johana-duskova-1873"),
    dict(t="rodic", a="karel-dvorak-1836", b="jan-dvorak-1869"),
    dict(t="rodic", a="karolina-peskova-1847", b="jan-dvorak-1869"),
    dict(t="rodic", a="jan-bartos-1838", b="karolina-bartosova-1870"),
    dict(t="rodic", a="karolina-novotna-1840", b="karolina-bartosova-1870"),
    dict(t="rodic", a="vincenc-kucera-1831", b="josef-kucera-1866"),
    dict(t="rodic", a="karolina-horakova-1838", b="josef-kucera-1866"),
    dict(t="rodic", a="jan-vavra-1843", b="anna-vavrova-1873"),
    dict(t="rodic", a="katerina-matejkova-1852", b="anna-vavrova-1873"),
    dict(t="rodic", a="karel-simek-1831", b="josef-simek-1865"),
    dict(t="rodic", a="katerina-dolezalova-1844", b="josef-simek-1865"),
    dict(t="rodic", a="otec-neuveden-rozalie-krizova-1879", b="rozalie-krizova-1879"),
    dict(t="rodic", a="anna-krizova-1856", b="rozalie-krizova-1879"),
    dict(t="rodic", a="tomas-vondracek-1848", b="josef-vondracek-1875"),
    dict(t="rodic", a="karolina-kubatova-1852", b="josef-vondracek-1875"),
    dict(t="rodic", a="josef-benes-1840", b="frantiska-benesova-1875"),
    dict(t="rodic", a="katerina-stastna-1845", b="frantiska-benesova-1875"),
    dict(t="rodic", a="josef-novak-1791", b="jan-novak-1824"),
    dict(t="rodic", a="anna-junkova-1803", b="jan-novak-1824"),
    dict(t="rodic", a="jan-urban-1807", b="marie-urbanova-1836"),
    dict(t="rodic", a="karel-maly-1800", b="frantisek-maly-1827"),
    dict(t="rodic", a="anna-sedlackova-1798", b="frantisek-maly-1827"),
    dict(t="rodic", a="antonin-ptacek-1802", b="josefa-ptackova-1831"),
    dict(t="rodic", a="vincenc-pokorny-1799", b="antonin-pokorny-1829"),
    dict(t="rodic", a="karolina-kalousova-1805", b="antonin-pokorny-1829"),
    dict(t="rodic", a="josef-lukes-1799", b="frantiska-lukesova-1834"),
    dict(t="rodic", a="josefa-sramkova-1811", b="frantiska-lukesova-1834"),
    dict(t="rodic", a="jan-sladek-1807", b="josef-sladek-1842"),
    dict(t="rodic", a="josef-pilar-1811", b="frantiska-pilarova-1839"),
    dict(t="rodic", a="anna-stepankova-1808", b="frantiska-pilarova-1839"),
    dict(t="rodic", a="barbora-jelinkova-1810", b="tomas-kral-1832"),
    dict(t="rodic", a="vincenc-vacek-1805", b="anna-vackova-1835"),
    dict(t="rodic", a="josefa-zemanova-1812", b="anna-vackova-1835"),
    dict(t="rodic", a="josefa-pospisilova-1811", b="karel-marek-1839"),
    dict(t="rodic", a="jan-vesely-1809", b="johana-vesela-1836"),
    dict(t="rodic", a="vaclav-hruby-1805", b="vaclav-hruby-1841"),
    dict(t="rodic", a="josefa-cerna-1811", b="vaclav-hruby-1841"),
    dict(t="rodic", a="tomas-fiala-1817", b="johana-fialova-1848"),
    dict(t="rodic", a="anna-ticha-1817", b="johana-fialova-1848"),
    dict(t="rodic", a="jan-dusek-1821", b="vincenc-dusek-1847"),
    dict(t="rodic", a="terezie-prochazkova-1822", b="vincenc-dusek-1847"),
    dict(t="rodic", a="frantisek-holub-1815", b="johana-holubova-1845"),
    dict(t="rodic", a="johana-hrdinova-1814", b="johana-holubova-1845"),
    dict(t="rodic", a="jan-dvorak-1807", b="karel-dvorak-1836"),
    dict(t="rodic", a="frantiska-charvatova-1815", b="karel-dvorak-1836"),
    dict(t="rodic", a="josef-pesek-1812", b="karolina-peskova-1847"),
    dict(t="rodic", a="anna-moravcova-1821", b="karolina-peskova-1847"),
    dict(t="rodic", a="vincenc-bartos-1809", b="jan-bartos-1838"),
    dict(t="rodic", a="rozalie-svobodova-1816", b="jan-bartos-1838"),
    dict(t="rodic", a="karel-novotny-1811", b="karolina-novotna-1840"),
    dict(t="rodic", a="katerina-kopecka-1817", b="karolina-novotna-1840"),
    dict(t="rodic", a="vincenc-kucera-1799", b="vincenc-kucera-1831"),
    dict(t="rodic", a="marie-machova-1807", b="vincenc-kucera-1831"),
    dict(t="rodic", a="karolina-rihova-1816", b="karolina-horakova-1838"),
    dict(t="rodic", a="tomas-vavra-1816", b="jan-vavra-1843"),
    dict(t="rodic", a="frantiska-hajkova-1812", b="jan-vavra-1843"),
    dict(t="rodic", a="vincenc-simek-1803", b="karel-simek-1831"),
    dict(t="rodic", a="terezie-kolarova-1803", b="karel-simek-1831"),
    dict(t="rodic", a="karel-dolezal-1817", b="katerina-dolezalova-1844"),
    dict(t="rodic", a="josefa-zakova-1823", b="katerina-dolezalova-1844"),
    dict(t="rodic", a="josef-kriz-1827", b="anna-krizova-1856"),
    dict(t="rodic", a="josef-vondracek-1813", b="tomas-vondracek-1848"),
    dict(t="rodic", a="katerina-pilarova-1819", b="tomas-vondracek-1848"),
    dict(t="rodic", a="rozalie-rihova-1830", b="karolina-kubatova-1852"),
    dict(t="rodic", a="frantisek-benes-1811", b="josef-benes-1840"),
    dict(t="rodic", a="frantiska-kopecka-1818", b="josef-benes-1840"),
    dict(t="rodic", a="jan-stastny-1816", b="katerina-stastna-1845"),
    dict(t="rodic", a="terezie-lukesova-1818", b="katerina-stastna-1845"),
    dict(t="rodic", a="vaclav-novak-1758", b="josef-novak-1791"),
    dict(t="rodic", a="katerina-rysava-1764", b="josef-novak-1791"),
    dict(t="rodic", a="vaclav-junek-1769", b="anna-junkova-1803"),
    dict(t="rodic", a="lidmila-jelinkova-1774", b="anna-junkova-1803"),
    dict(t="rodic", a="pavel-urban-1773", b="jan-urban-1807"),
    dict(t="rodic", a="veronika-vavrova-1776", b="jan-urban-1807"),
    dict(t="rodic", a="jakub-maly-1772", b="karel-maly-1800"),
    dict(t="rodic", a="anna-duskova-1778", b="karel-maly-1800"),
    dict(t="rodic", a="matej-sedlacek-1771", b="anna-sedlackova-1798"),
    dict(t="rodic", a="lidmila-rihova-1769", b="anna-sedlackova-1798"),
    dict(t="rodic", a="zuzana-kalousova-1773", b="antonin-ptacek-1802"),
    dict(t="rodic", a="anna-vackova-1770", b="vincenc-pokorny-1799"),
    dict(t="rodic", a="ludmila-prochazkova-1784", b="karolina-kalousova-1805"),
    dict(t="rodic", a="ondrej-lukes-1771", b="josef-lukes-1799"),
    dict(t="rodic", a="barbora-vlckova-1769", b="josef-lukes-1799"),
    dict(t="rodic", a="lidmila-bartosova-1783", b="josefa-sramkova-1811"),
    dict(t="rodic", a="alzbeta-vesela-1778", b="jan-sladek-1807"),
    dict(t="rodic", a="jiri-pilar-1780", b="josef-pilar-1811"),
    dict(t="rodic", a="simon-stepanek-1779", b="anna-stepankova-1808"),
    dict(t="rodic", a="lidmila-hajkova-1787", b="barbora-jelinkova-1810"),
    dict(t="rodic", a="magdalena-svobodova-1779", b="vincenc-vacek-1805"),
    dict(t="rodic", a="tomas-zeman-1786", b="josefa-zemanova-1812"),
    dict(t="rodic", a="zuzana-benesova-1786", b="josefa-zemanova-1812"),
    dict(t="rodic", a="tomas-pospisil-1777", b="josefa-pospisilova-1811"),
    dict(t="rodic", a="anna-matejkova-1789", b="josefa-pospisilova-1811"),
    dict(t="rodic", a="jan-hruby-1779", b="vaclav-hruby-1805"),
    dict(t="rodic", a="dorota-cerna-1784", b="vaclav-hruby-1805"),
    dict(t="rodic", a="martin-cerny-1777", b="josefa-cerna-1811"),
    dict(t="rodic", a="magdalena-machova-1785", b="josefa-cerna-1811"),
    dict(t="rodic", a="karel-fiala-1790", b="tomas-fiala-1817"),
    dict(t="rodic", a="katerina-pospisilova-1792", b="tomas-fiala-1817"),
    dict(t="rodic", a="johana-horakova-1792", b="anna-ticha-1817"),
    dict(t="rodic", a="jan-dusek-1788", b="jan-dusek-1821"),
    dict(t="rodic", a="josefa-hrdinova-1796", b="jan-dusek-1821"),
    dict(t="rodic", a="tomas-prochazka-1792", b="terezie-prochazkova-1822"),
    dict(t="rodic", a="johana-rihova-1795", b="terezie-prochazkova-1822"),
    dict(t="rodic", a="simon-holub-1779", b="frantisek-holub-1815"),
    dict(t="rodic", a="zuzana-jelinkova-1788", b="frantisek-holub-1815"),
    dict(t="rodic", a="mikulas-hrdina-1781", b="johana-hrdinova-1814"),
    dict(t="rodic", a="matej-dvorak-1773", b="jan-dvorak-1807"),
    dict(t="rodic", a="ondrej-pesek-1780", b="josef-pesek-1812"),
    dict(t="rodic", a="dorota-zakova-1782", b="josef-pesek-1812"),
    dict(t="rodic", a="antonin-moravec-1795", b="anna-moravcova-1821"),
    dict(t="rodic", a="johana-pospisilova-1794", b="anna-moravcova-1821"),
    dict(t="rodic", a="jan-bartos-1776", b="vincenc-bartos-1809"),
    dict(t="rodic", a="magdalena-krizova-1787", b="vincenc-bartos-1809"),
    dict(t="rodic", a="tomas-svoboda-1780", b="rozalie-svobodova-1816"),
    dict(t="rodic", a="anna-matejkova-1785", b="rozalie-svobodova-1816"),
    dict(t="rodic", a="vojtech-novotny-1780", b="karel-novotny-1811"),
    dict(t="rodic", a="martin-kopecky-1785", b="katerina-kopecka-1817"),
    dict(t="rodic", a="zuzana-cerna-1787", b="katerina-kopecka-1817"),
    dict(t="rodic", a="vaclav-kucera-1773", b="vincenc-kucera-1799"),
    dict(t="rodic", a="katerina-sladkova-1773", b="vincenc-kucera-1799"),
    dict(t="rodic", a="tomas-mach-1774", b="marie-machova-1807"),
    dict(t="rodic", a="lidmila-rihova-1776", b="marie-machova-1807"),
    dict(t="rodic", a="jakub-riha-1789", b="karolina-rihova-1816"),
    dict(t="rodic", a="barbora-peskova-1788", b="frantiska-hajkova-1812"),
    dict(t="rodic", a="jan-simek-1769", b="vincenc-simek-1803"),
    dict(t="rodic", a="alzbeta-urbanova-1777", b="vincenc-simek-1803"),
    dict(t="rodic", a="vaclav-kolar-1770", b="terezie-kolarova-1803"),
    dict(t="rodic", a="jakub-dolezal-1784", b="karel-dolezal-1817"),
    dict(t="rodic", a="jan-zak-1790", b="josefa-zakova-1823"),
    dict(t="rodic", a="josefa-zemanova-1798", b="josef-kriz-1827"),
    dict(t="rodic", a="pavel-vondracek-1777", b="josef-vondracek-1813"),
    dict(t="rodic", a="katerina-moravcova-1792", b="katerina-pilarova-1819"),
    dict(t="rodic", a="jiri-riha-1794", b="rozalie-rihova-1830"),
    dict(t="rodic", a="anna-duskova-1809", b="rozalie-rihova-1830"),
    dict(t="rodic", a="magdalena-krizova-1784", b="frantisek-benes-1811"),
    dict(t="rodic", a="vojtech-kopecky-1782", b="frantiska-kopecka-1818"),
    dict(t="rodic", a="katerina-fialova-1794", b="frantiska-kopecka-1818"),
    dict(t="rodic", a="ondrej-stastny-1782", b="jan-stastny-1816"),
    dict(t="rodic", a="rozalie-vlckova-1795", b="jan-stastny-1816"),
    dict(t="rodic", a="simon-lukes-1788", b="terezie-lukesova-1818"),
    dict(t="rodic", a="anna-lukesova-1794", b="terezie-lukesova-1818"),
    dict(t="rodic", a="matej-novak-1726", b="vaclav-novak-1758"),
    dict(t="rodic", a="katerina-matejkova-1729", b="vaclav-novak-1758"),
    dict(t="rodic", a="jakub-rysavy-1730", b="katerina-rysava-1764"),
    dict(t="rodic", a="marie-krizova-1733", b="katerina-rysava-1764"),
    dict(t="rodic", a="ondrej-urban-1744", b="pavel-urban-1773"),
    dict(t="rodic", a="tomas-vavra-1750", b="veronika-vavrova-1776"),
    dict(t="rodic", a="vojtech-maly-1736", b="jakub-maly-1772"),
    dict(t="rodic", a="anna-moravcova-1742", b="jakub-maly-1772"),
    dict(t="rodic", a="alzbeta-sladkova-1753", b="anna-duskova-1778"),
    dict(t="rodic", a="tomas-riha-1742", b="lidmila-rihova-1769"),
    dict(t="rodic", a="simon-vacek-1734", b="anna-vackova-1770"),
    dict(t="rodic", a="barbora-vavrova-1755", b="ludmila-prochazkova-1784"),
    dict(t="rodic", a="magdalena-dolezalova-1753", b="lidmila-bartosova-1783"),
    dict(t="rodic", a="zuzana-zemanova-1752", b="alzbeta-vesela-1778"),
    dict(t="rodic", a="vojtech-pilar-1748", b="jiri-pilar-1780"),
    dict(t="rodic", a="barbora-junkova-1751", b="jiri-pilar-1780"),
    dict(t="rodic", a="vojtech-hajek-1760", b="lidmila-hajkova-1787"),
    dict(t="rodic", a="barbora-kubatova-1758", b="tomas-zeman-1786"),
    dict(t="rodic", a="magdalena-markova-1762", b="zuzana-benesova-1786"),
    dict(t="rodic", a="mikulas-pospisil-1746", b="tomas-pospisil-1777"),
    dict(t="rodic", a="lidmila-vesela-1753", b="tomas-pospisil-1777"),
    dict(t="rodic", a="jan-cerny-1758", b="dorota-cerna-1784"),
    dict(t="rodic", a="martin-cerny-1751", b="martin-cerny-1777"),
    dict(t="rodic", a="magdalena-horakova-1763", b="magdalena-machova-1785"),
    dict(t="rodic", a="barbora-kalousova-1762", b="karel-fiala-1790"),
    dict(t="rodic", a="jiri-horak-1757", b="johana-horakova-1792"),
    dict(t="rodic", a="alzbeta-stastna-1757", b="jan-dusek-1788"),
    dict(t="rodic", a="martin-hrdina-1768", b="josefa-hrdinova-1796"),
    dict(t="rodic", a="marie-dolezalova-1774", b="josefa-hrdinova-1796"),
    dict(t="rodic", a="jan-prochazka-1759", b="tomas-prochazka-1792"),
    dict(t="rodic", a="ludmila-svobodova-1769", b="johana-rihova-1795"),
    dict(t="rodic", a="vojtech-holub-1750", b="simon-holub-1779"),
    dict(t="rodic", a="ludmila-zakova-1754", b="simon-holub-1779"),
    dict(t="rodic", a="dorota-fialova-1752", b="mikulas-hrdina-1781"),
    dict(t="rodic", a="matej-dvorak-1740", b="matej-dvorak-1773"),
    dict(t="rodic", a="jakub-pesek-1749", b="ondrej-pesek-1780"),
    dict(t="rodic", a="ludmila-novotna-1767", b="antonin-moravec-1795"),
    dict(t="rodic", a="vojtech-pospisil-1759", b="johana-pospisilova-1794"),
    dict(t="rodic", a="pavel-bartos-1747", b="jan-bartos-1776"),
    dict(t="rodic", a="ludmila-prochazkova-1753", b="tomas-svoboda-1780"),
    dict(t="rodic", a="tomas-kopecky-1756", b="martin-kopecky-1785"),
    dict(t="rodic", a="jan-cerny-1760", b="zuzana-cerna-1787"),
    dict(t="rodic", a="jiri-mach-1740", b="tomas-mach-1774"),
    dict(t="rodic", a="ondrej-riha-1756", b="jakub-riha-1789"),
    dict(t="rodic", a="vaclav-pesek-1762", b="barbora-peskova-1788"),
    dict(t="rodic", a="ondrej-simek-1736", b="jan-simek-1769"),
    dict(t="rodic", a="jiri-urban-1745", b="alzbeta-urbanova-1777"),
    dict(t="rodic", a="marie-pilarova-1762", b="jakub-dolezal-1784"),
    dict(t="rodic", a="matej-zeman-1763", b="josefa-zemanova-1798"),
    dict(t="rodic", a="ludmila-duskova-1771", b="josefa-zemanova-1798"),
    dict(t="rodic", a="ludmila-kalousova-1751", b="pavel-vondracek-1777"),
    dict(t="rodic", a="jan-moravec-1765", b="katerina-moravcova-1792"),
    dict(t="rodic", a="magdalena-stastna-1771", b="katerina-moravcova-1792"),
    dict(t="rodic", a="barbora-stastna-1768", b="jiri-riha-1794"),
    dict(t="rodic", a="anna-rihova-1778", b="anna-duskova-1809"),
    dict(t="rodic", a="pavel-kriz-1751", b="magdalena-krizova-1784"),
    dict(t="rodic", a="marie-urbanova-1751", b="vojtech-kopecky-1782"),
    dict(t="rodic", a="pavel-fiala-1761", b="katerina-fialova-1794"),
    dict(t="rodic", a="zuzana-pospisilova-1756", b="ondrej-stastny-1782"),
    dict(t="rodic", a="pavel-vlcek-1763", b="rozalie-vlckova-1795"),
    dict(t="rodic", a="magdalena-ticha-1767", b="anna-lukesova-1794"),
    dict(t="rodic", a="jiri-novak-1694", b="matej-novak-1726"),
    dict(t="rodic", a="alzbeta-novotna-1701", b="matej-novak-1726"),
    dict(t="rodic", a="vaclav-matejka-1696", b="katerina-matejkova-1729"),
    dict(t="rodic", a="pavel-vavra-1720", b="barbora-vavrova-1755"),
    dict(t="rodic", a="lidmila-pilarova-1726", b="barbora-vavrova-1755"),
    dict(t="rodic", a="jakub-pilar-1713", b="vojtech-pilar-1748"),
    dict(t="rodic", a="ludmila-kolarova-1748", b="ludmila-svobodova-1769"),
    dict(t="rodic", a="jan-zak-1728", b="ludmila-zakova-1754"),
    dict(t="rodic", a="jan-cerny-1727", b="jan-cerny-1760"),
    dict(t="rodic", a="jan-stastny-1742", b="magdalena-stastna-1771"),
    dict(t="rodic", a="pavel-kriz-1722", b="pavel-kriz-1751"),
    dict(t="rodic", a="jakub-novak-1665", b="jiri-novak-1694"),
    dict(t="rodic", a="marie-moravcova-1665", b="jiri-novak-1694"),
    dict(t="manzele", a="josef-novak-1952", b="eva-dvorakova-1955"),
    dict(t="manzele", a="frantisek-novak-1921", b="marie-kralova-1925"),
    dict(t="manzele", a="karel-dvorak-1927", b="anna-simkova-1930"),
    dict(t="manzele", a="jan-novak-1890", b="josefa-pokorna-1895"),
    dict(t="manzele", a="vaclav-kral-1893", b="ludmila-hruba-1898"),
    dict(t="manzele", a="antonin-dvorak-1899", b="frantiska-kucerova-1902"),
    dict(t="manzele", a="josef-simek-1901", b="marie-vondrackova-1905"),
    dict(t="manzele", a="vaclav-novak-1858", b="barbora-mala-1862"),
    dict(t="manzele", a="josef-pokorny-1865", b="barbora-sladkova-1868"),
    dict(t="manzele", a="josef-kral-1860", b="johana-markova-1867"),
    dict(t="manzele", a="josef-hruby-1871", b="johana-duskova-1873"),
    dict(t="manzele", a="jan-dvorak-1869", b="karolina-bartosova-1870"),
    dict(t="manzele", a="josef-kucera-1866", b="anna-vavrova-1873"),
    dict(t="manzele", a="josef-simek-1865", b="rozalie-krizova-1879"),
    dict(t="manzele", a="josef-vondracek-1875", b="frantiska-benesova-1875"),
    dict(t="manzele", a="jan-novak-1824", b="marie-urbanova-1836"),
    dict(t="manzele", a="frantisek-maly-1827", b="josefa-ptackova-1831"),
    dict(t="manzele", a="antonin-pokorny-1829", b="frantiska-lukesova-1834"),
    dict(t="manzele", a="josef-sladek-1842", b="frantiska-pilarova-1839"),
    dict(t="manzele", a="tomas-kral-1832", b="anna-vackova-1835"),
    dict(t="manzele", a="karel-marek-1839", b="johana-vesela-1836"),
    dict(t="manzele", a="vaclav-hruby-1841", b="johana-fialova-1848"),
    dict(t="manzele", a="vincenc-dusek-1847", b="johana-holubova-1845"),
    dict(t="manzele", a="karel-dvorak-1836", b="karolina-peskova-1847"),
    dict(t="manzele", a="jan-bartos-1838", b="karolina-novotna-1840"),
    dict(t="manzele", a="vincenc-kucera-1831", b="karolina-horakova-1838"),
    dict(t="manzele", a="jan-vavra-1843", b="katerina-matejkova-1852"),
    dict(t="manzele", a="karel-simek-1831", b="katerina-dolezalova-1844"),
    dict(t="manzele", a="otec-neuveden-rozalie-krizova-1879", b="anna-krizova-1856"),
    dict(t="manzele", a="tomas-vondracek-1848", b="karolina-kubatova-1852"),
    dict(t="manzele", a="josef-benes-1840", b="katerina-stastna-1845"),
    dict(t="manzele", a="josef-novak-1791", b="anna-junkova-1803"),
    dict(t="manzele", a="karel-maly-1800", b="anna-sedlackova-1798"),
    dict(t="manzele", a="vincenc-pokorny-1799", b="karolina-kalousova-1805"),
    dict(t="manzele", a="josef-lukes-1799", b="josefa-sramkova-1811"),
    dict(t="manzele", a="josef-pilar-1811", b="anna-stepankova-1808"),
    dict(t="manzele", a="vincenc-vacek-1805", b="josefa-zemanova-1812"),
    dict(t="manzele", a="vaclav-hruby-1805", b="josefa-cerna-1811"),
    dict(t="manzele", a="tomas-fiala-1817", b="anna-ticha-1817"),
    dict(t="manzele", a="jan-dusek-1821", b="terezie-prochazkova-1822"),
    dict(t="manzele", a="frantisek-holub-1815", b="johana-hrdinova-1814"),
    dict(t="manzele", a="jan-dvorak-1807", b="frantiska-charvatova-1815"),
    dict(t="manzele", a="josef-pesek-1812", b="anna-moravcova-1821"),
    dict(t="manzele", a="vincenc-bartos-1809", b="rozalie-svobodova-1816"),
    dict(t="manzele", a="karel-novotny-1811", b="katerina-kopecka-1817"),
    dict(t="manzele", a="vincenc-kucera-1799", b="marie-machova-1807"),
    dict(t="manzele", a="tomas-vavra-1816", b="frantiska-hajkova-1812"),
    dict(t="manzele", a="vincenc-simek-1803", b="terezie-kolarova-1803"),
    dict(t="manzele", a="karel-dolezal-1817", b="josefa-zakova-1823"),
    dict(t="manzele", a="josef-vondracek-1813", b="katerina-pilarova-1819"),
    dict(t="manzele", a="frantisek-benes-1811", b="frantiska-kopecka-1818"),
    dict(t="manzele", a="jan-stastny-1816", b="terezie-lukesova-1818"),
    dict(t="manzele", a="vaclav-novak-1758", b="katerina-rysava-1764"),
    dict(t="manzele", a="vaclav-junek-1769", b="lidmila-jelinkova-1774"),
    dict(t="manzele", a="pavel-urban-1773", b="veronika-vavrova-1776"),
    dict(t="manzele", a="jakub-maly-1772", b="anna-duskova-1778"),
    dict(t="manzele", a="matej-sedlacek-1771", b="lidmila-rihova-1769"),
    dict(t="manzele", a="ondrej-lukes-1771", b="barbora-vlckova-1769"),
    dict(t="manzele", a="tomas-zeman-1786", b="zuzana-benesova-1786"),
    dict(t="manzele", a="tomas-pospisil-1777", b="anna-matejkova-1789"),
    dict(t="manzele", a="jan-hruby-1779", b="dorota-cerna-1784"),
    dict(t="manzele", a="martin-cerny-1777", b="magdalena-machova-1785"),
    dict(t="manzele", a="karel-fiala-1790", b="katerina-pospisilova-1792"),
    dict(t="manzele", a="jan-dusek-1788", b="josefa-hrdinova-1796"),
    dict(t="manzele", a="tomas-prochazka-1792", b="johana-rihova-1795"),
    dict(t="manzele", a="simon-holub-1779", b="zuzana-jelinkova-1788"),
    dict(t="manzele", a="ondrej-pesek-1780", b="dorota-zakova-1782"),
    dict(t="manzele", a="antonin-moravec-1795", b="johana-pospisilova-1794"),
    dict(t="manzele", a="jan-bartos-1776", b="magdalena-krizova-1787"),
    dict(t="manzele", a="tomas-svoboda-1780", b="anna-matejkova-1785"),
    dict(t="manzele", a="martin-kopecky-1785", b="zuzana-cerna-1787"),
    dict(t="manzele", a="vaclav-kucera-1773", b="katerina-sladkova-1773"),
    dict(t="manzele", a="tomas-mach-1774", b="lidmila-rihova-1776"),
    dict(t="manzele", a="jan-simek-1769", b="alzbeta-urbanova-1777"),
    dict(t="manzele", a="jiri-riha-1794", b="anna-duskova-1809"),
    dict(t="manzele", a="vojtech-kopecky-1782", b="katerina-fialova-1794"),
    dict(t="manzele", a="ondrej-stastny-1782", b="rozalie-vlckova-1795"),
    dict(t="manzele", a="simon-lukes-1788", b="anna-lukesova-1794"),
    dict(t="manzele", a="matej-novak-1726", b="katerina-matejkova-1729"),
    dict(t="manzele", a="jakub-rysavy-1730", b="marie-krizova-1733"),
    dict(t="manzele", a="vojtech-maly-1736", b="anna-moravcova-1742"),
    dict(t="manzele", a="vojtech-pilar-1748", b="barbora-junkova-1751"),
    dict(t="manzele", a="mikulas-pospisil-1746", b="lidmila-vesela-1753"),
    dict(t="manzele", a="martin-hrdina-1768", b="marie-dolezalova-1774"),
    dict(t="manzele", a="vojtech-holub-1750", b="ludmila-zakova-1754"),
    dict(t="manzele", a="matej-zeman-1763", b="ludmila-duskova-1771"),
    dict(t="manzele", a="jan-moravec-1765", b="magdalena-stastna-1771"),
    dict(t="manzele", a="jiri-novak-1694", b="alzbeta-novotna-1701"),
    dict(t="manzele", a="pavel-vavra-1720", b="lidmila-pilarova-1726"),
    dict(t="manzele", a="jakub-novak-1665", b="marie-moravcova-1665"),
    dict(t="pribuzny", a="bocni-marie-novakova-18921970", b="jan-novak-1890"),
    dict(t="pribuzny", a="bocni-vaclav-novak-18961916", b="jan-novak-1890"),
    dict(t="pribuzny", a="bocni-antonin-kucera-18691941", b="josef-kucera-1866"),
]

# Rody = větve podle pradědečků a prababiček výchozí osoby: slug rodu → název, popis, zakladatel (id osoby).
RODY = {
    "novakove": dict(nazev="Novákové", popis="Kováři z Ostřetína a Holic – kovárna v Holicích čp. 112 přecházela z otce na syna od roku 1786.", zakladatel="jan-novak-1890"),
    "pokorni": dict(nazev="Pokorní", popis="Sedláci z Dolní Rovně, statek čp. 7.", zakladatel="josefa-pokorna-1895"),
    "kralove": dict(nazev="Králové", popis="Rolníci z Holic, čp. 41.", zakladatel="vaclav-kral-1893"),
    "hrubi": dict(nazev="Hrubí", popis="Soukeníci z Vysokého Mýta – mistři cechu, dům čp. 260 na předměstí.", zakladatel="ludmila-hruba-1898"),
    "dvorakove": dict(nazev="Dvořákové", popis="Tkalci z Chrudimi, od konce 19. století železničáři.", zakladatel="antonin-dvorak-1899"),
    "kucerovi": dict(nazev="Kučerovi", popis="Mlynáři ve Slatiňanech – mlýn čp. 5 v rodě přes pět generací.", zakladatel="frantiska-kucerova-1902"),
    "simkove": dict(nazev="Šimkové", popis="Truhláři z Chrudimi, dílna v domě čp. 77.", zakladatel="josef-simek-1901"),
    "vondrackove": dict(nazev="Vondráčkové", popis="Hrnčíři z Luže, dům čp. 88 pod poutním kostelem na Chlumku.", zakladatel="marie-vondrackova-1905"),
}

# Rozpory a otevřené otázky (na web do „Co hledáme“) jako dvojice (otázka, odpověď). Odpověď začněte
# „Vyřešeno: …“ (na webu se skryje), „Hypotéza: …“ nebo „Otevřené: …“. Jde na web – nic citlivého.
# ("Kdy se narodil Jan Novák?", "Otevřené: rodina říká 1850, v Holicích 1848–1852 nenalezen.")
# Volitelně třetí prvek dict(osoby=["id"], rody=["slug rodu"]) – otázka se pak ukáže i na stránce osoby / rodu.
ISSUES = [
    ("Odkud přišel Jakub Novák do Ostřetína?", "Otevřené: jeho křest je starší než ostřetínské matriky (1690); zkusit soupis poddaných 1651 a berní rulu."),
    ("Kdo byl otec Rozálie Křížové (1879)?", "Otevřené: v matrice Proseče je zapsána jako nemanželská, otec neuveden ani dodatečně."),
    ("Kdy se narodil Václav Hrubý (1841)?", "Hypotéza: podle věku v zápisu úmrtí 1841; ve Vysokém Mýtě 1839–1843 zatím nenalezen."),
    ("Byl mlýn ve Slatiňanech Kučerův už před rokem 1773?", "Otevřené: gruntovní knihy panství Slatiňany (SOA Zámrsk) – do archivu."),
]

# Hypotézy o původu rodu nad rámec doložené linie (zobrazí se na stránce rodu); rod = id osoby (zakladatel větve):
# dict(rod="jan-novak-1890", nadpis="Hypotéza: …", text="…", polozky=[("Jan Novák", "kmotr 1681…")], zaznamy=["klic"])
HYPOTEZY = [
    dict(rod="jan-novak-1890", nadpis="Hypotéza: Novákové z Býště", text="V soupisu poddaných 1651 je v Býšti kovář Jiřík Novák s malým synem Jakubem – mohl to být náš nejstarší Jakub. Jen shoda jména, řemesla a doby.", polozky=[("Jiřík Novák", "kovář v Býšti, soupis poddaných 1651"), ("Jakub", "jeho syn, 1651 „2 léta“")], zaznamy=[]),
]
