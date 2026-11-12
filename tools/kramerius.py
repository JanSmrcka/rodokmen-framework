#!/usr/bin/env python3
"""Kramerius NKP full-text search (API v5). Usage: kramerius.py 'SOLR_QUERY' [rows]
e.g. kramerius.py 'text_ocr:"Jan Novák" AND datum_begin:[1860 TO 1920]'
Sloupec přístupu: public = volně; private+DNNT = čitelné po přihlášení na ndk.cz (reference/portaly.md → DNNT);
private = jen v knihovně. Filtr datum_begin vyřadí část čísel periodik – při malém počtu nálezů hledej i bez něj."""
import os,sys,json,urllib.request,urllib.parse
for _s in (sys.stdout, sys.stderr):   # UTF-8 výstup i na Windows bez -X utf8 (cp1250 neumí třeba „→“)
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # -I nepřidá složku skriptu sama
import slusne; slusne.instaluj()   # společný limit rychlosti k webům archivů (slusne.py)
if len(sys.argv) < 2:
    sys.exit(__doc__)
q=sys.argv[1]; rows=sys.argv[2] if len(sys.argv)>2 else '30'
p={'q':q+' AND fedora.model:page','fl':'PID,root_title,root_pid,datum_str,details,dostupnost,dnnt,dnnt-labels','rows':rows,'wt':'json','hl':'true','hl.fl':'text_ocr','hl.fragsize':'250'}
u='https://kramerius5.nkp.cz/search/api/v5.0/search?'+urllib.parse.urlencode(p)
d=json.load(urllib.request.urlopen(u,timeout=90))
print('found',d['response']['numFound'])
hl=d.get('highlighting',{})
for x in d['response']['docs']:
    h=' | '.join(hl.get(x['PID'],{}).get('text_ocr',[]))[:400].replace('\n',' ')
    pristup=x.get('dostupnost') or '?'
    if pristup=='private' and (x.get('dnnt') or 'dnnto' in (x.get('dnnt-labels') or [])): pristup='private+DNNT'
    det=str(x['details'][0]).split()[0] if x.get('details') else ''
    print('-',x.get('datum_str'),'|',str(x.get('root_title'))[:60],'| s.',det,'|',x['PID'],'|',pristup)
    if h: print('   ',h)
