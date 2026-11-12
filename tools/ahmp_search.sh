#!/bin/bash
# Matriky AHMP (Praha): ahmp_search.sh "dotaz" -> vypíše svazky Sbírky matrik (popis | farnost | XID, počet snímků).
# Používá starý katalog katalog.ahmp.cz/pragapublica (nový digi.ahmp.cz má ochranu proti robotům – nepoužívat).
# Katalog řadí výsledky pokaždé jinak, takže se stránky překrývají a část svazků vypadne. Hledání se proto opakuje
# (nejvýš 2×, pod společným limitem rychlosti slusne.py) a výsledky se slučují, dokud jich není tolik, kolik katalog hlásí.
D=$(mktemp -d); trap 'rm -rf "$D"' EXIT; B=https://katalog.ahmp.cz; C=$D/cj; P="$(dirname "$0")/ahmp_parse.py"
# Python 3: na Windows je „python3“ často jen nefunkční alias z Microsoft Store → zkus python, py -3
PY=python3; $PY -c "" 2>/dev/null || PY=python; $PY -c "" 2>/dev/null || PY="py -3"
curl() { $PY -I "$(dirname "$0")/slusne.py" curl "$@" || exit $?; }   # limit rychlosti; zablokovaný web → konec
q=$($PY -I -c "import urllib.parse,sys;print(urllib.parse.quote_plus(sys.argv[1]))" "$1")
: > $D/vse
for pruchod in 1 2; do
  rm -f $C
  curl -s -b $C -c $C -L "$B/pragapublica/searchlink?xid=7EF18906B65E11DF820F00166F1163D4&fcDb=&onlyDigi=&modeView=LIST&searchAsPhrase=&patternTxt=$q" -o $D/a.html
  f=$(grep -A6 'name="pageRows"' $D/a.html | grep -oE 'name="(_sourcePage|__fp)" value="[^"]*"' | head -2)
  sp=$(echo "$f" | grep _sourcePage | cut -d'"' -f4); fp=$(echo "$f" | grep __fp | cut -d'"' -f4)
  curl -s -b $C -c $C -L "$B/pragapublica/ViewControlImpl.action" --data-urlencode "pageRows=51" --data-urlencode "myPageRows=" --data-urlencode "_sourcePage=$sp" --data-urlencode "__fp=$fp" -o $D/p0.html
  celkem=$($PY -I -c "import re,sys;m=re.search(r'\(\s*<strong>\s*(\d+)\.0\s*</strong>',open(sys.argv[1],encoding='utf-8').read());print(m.group(1) if m else '')" $D/p0.html)
  $PY -I -X utf8 "$P" $D/p0.html >> $D/vse; cur=$D/p0.html
  for k in $(seq 1 30); do u=$(grep -oE '/pragapublica/PaginatorResult.action[^"]*row=[0-9]+' $cur | sed 's/&amp;/\&/g' | grep -E "row=$((k*51))$" | head -1); [ -z "$u" ] && break; curl -s -b $C -c $C "$B$u" -o $D/p$k.html; $PY -I -X utf8 "$P" $D/p$k.html >> $D/vse; cur=$D/p$k.html; done
  mame=$(awk '!s[$0]++' $D/vse | grep -vc '^? |')   # „? | … | -“ = řádek bez názvu, ne svazek
  [ -n "$celkem" ] && [ "$mame" -ge "$celkem" ] && break
  [ -z "$celkem" ] && break   # bez počtu (nic nenalezeno, nebo jiná stránka) neopakovat
done
awk '!s[$0]++' $D/vse
if [ "$mame" -eq 0 ]; then echo "Nic nenalezeno – zkus jiný tvar názvu (bez diakritiky, starý název, farnost)" >&2
elif [ -z "$celkem" ] || [ "$mame" -lt "$celkem" ]; then echo "POZOR: katalog hlásí ${celkem:-?} svazků, načteno $mame – spusť hledání znovu nebo ho zpřesni" >&2; fi
exit 0
