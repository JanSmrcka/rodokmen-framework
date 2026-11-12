# scitani_mza.py <svazek|rok> <snimek> <out.jpg> [x0,y0,x1,y1] [sirka] [--obec <slug>] – snímek ze sčítacích operátů MZA
# (mza.cz/scitacioperaty). Operát = svazek v DB (druh S) s rokem, obcí a údaji MZA v meta:
#   rdb.py api PUT svazky/mza_scitani_<obec>_<rok> '{"archive":"MZA","title":"Sčítání <rok> <Obec>","kind":"S",
#     "yearFrom":<rok>,"placeSlug":"<obec>","meta":{"cesta":"LUN101/LUN101/<fond>","prefix":"<fond>-<obec>","signatura":"<sig>"}}'
# Signaturu přečtěte z adresy snímku v prohlížeči MZA (…/<cesta>/<prefix>-<signatura>/<…>-00010.jp2).
# První argument je klíč svazku, nebo rok (pak --obec <slug>; bez něj, když má operát na ten rok jen jedna obec).
# Spouštět: python3 -I tools/slusne.py tools/scitani_mza.py …
# Od 2. 11. 2026 MZA na iipsrv vypnul protokol IIIF (403 i v prohlížeči); prohlížeč webu používá Deepzoom,
# takže skript stahuje dlaždice Deepzoom (256 px) jen pro požadovaný výřez a skládá je přes ImageMagick (magick).
import sys, os, math, re, subprocess, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import slusne
import rdb_klient as api
def _opt(name):
    if name in sys.argv:
        i=sys.argv.index(name); v=sys.argv[i+1]; del sys.argv[i:i+2]; return v
obec=_opt("--obec")
def operat(arg):
    if re.fullmatch(r"1[89]\d\d", arg):
        svazky=api.get("svazky", druh="S", rok=arg, misto=obec)
        if not svazky: sys.exit(f"pro rok {arg}{' a obec '+obec if obec else ''} není v DB sčítací operát (svazek druhu S)")
        if len(svazky)>1: sys.exit(f"víc operátů pro rok {arg} – zadejte --obec ({', '.join(v.get('placeSlug') or v['key'] for v in svazky)})")
        return svazky[0]
    return api.get(f"svazky/{arg}")
V=api.hlavni(lambda: operat(sys.argv[1]))
M=V.get("meta") or {}
if not all(M.get(k) for k in ("cesta","prefix","signatura")): sys.exit(f"svazek {V['key']} nemá v meta cesta/prefix/signatura")
n,out=int(sys.argv[2]),sys.argv[3]
reg=sys.argv[4] if len(sys.argv)>4 else "0,0,1,1"; w=int(sys.argv[5]) if len(sys.argv)>5 else 1000
x0,y0,x1,y1=(float(v) for v in reg.split(","))
base=f"{M['prefix']}-{M['signatura']}"
dz=f"https://www.mza.cz/iipsrv/iipsrv.fcgi?Deepzoom=/srv/{M['cesta']}/{base}/{base}-{n*10:05d}.jp2"
CURL=["-s","-f","--http2","-m","180","-A","Mozilla/5.0 (rodokmen-plus)"]
tmp=tempfile.mkdtemp(prefix="scitani_mza_")
p=slusne.curl(CURL+["-o",f"{tmp}/i.dzi",f"{dz}.dzi"])
if p.returncode: print(out,"dzi curl",p.returncode); sys.exit(1)
x=open(f"{tmp}/i.dzi").read()
W,H=(int(v) for v in re.search(r'Width="(\d+)" Height="(\d+)"',x).groups()); T=int(re.search(r'TileSize="(\d+)"',x).group(1))
top=math.ceil(math.log2(max(W,H)))
# nejmenší úroveň, kde má výřez aspoň požadovanou šířku
L=top
while L>0 and (W/2**(top-L+1))*(x1-x0)>=w: L-=1
lw,lh=math.ceil(W/2**(top-L)),math.ceil(H/2**(top-L))
px0,py0,px1,py1=int(x0*lw),int(y0*lh),min(lw,math.ceil(x1*lw)),min(lh,math.ceil(y1*lh))
cols=range(px0//T,(px1-1)//T+1); rows=range(py0//T,(py1-1)//T+1)
for r in rows:
    for c in cols:
        p=slusne.curl(CURL+["-o",f"{tmp}/{r:03d}_{c:03d}.jpg",f"{dz}_files/{L}/{c}_{r}.jpg"])
        if p.returncode: print(out,"tile",L,c,r,"curl",p.returncode); sys.exit(1)
rad=[]
for r in rows:
    f=f"{tmp}/row{r:03d}.jpg"; subprocess.run(["magick",*[f"{tmp}/{r:03d}_{c:03d}.jpg" for c in cols],"+append",f],check=True); rad.append(f)
ox,oy=px0-cols[0]*T,py0-rows[0]*T
subprocess.run(["magick",*rad,"-append","-crop",f"{px1-px0}x{py1-py0}+{ox}+{oy}","+repage","-resize",f"{w}x>",out],check=True)
for f in os.listdir(tmp): os.remove(f"{tmp}/{f}")
os.rmdir(tmp)
print(out,"ok",f"level {L}",f"{len(rows)*len(cols)} dlaždic",f"({V['key']})")
