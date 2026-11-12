#!/usr/bin/env python3
"""Hook PreToolUse (Claude Code): síťový přístup k archivům jen přes slusne.py (společný limit rychlosti).

Zastaví v Bashi:
  - curl / wget na web (kromě localhost a vlastního API rodokmenu z RODOKMEN_API_URL), který nejde přes `tools/slusne.py curl`,
  - Python se síťovým importem (urllib, requests, http.client, socket…) – v `-c`, v heredocu nebo ve skriptu –,
    který neběží přes `tools/slusne.py` (nástroje v tools/ mají limit samy a projdou),
  - shellový skript mimo tools/ s curl/wget.
U WebFetch počká na volný termín webu a zablokovaný web (po 429/503) nepustí.
Je to textová heuristika, ne neprůstřelná ochrana – zachytí ale dočasné skripty, které si agent napíše sám.
Nastavení: .claude/settings.json projektu (zapisuje novy_projekt.py).
"""
import json, os, re, sys
for _s in (sys.stdout, sys.stderr):
    if hasattr(_s, "reconfigure"):
        _s.reconfigure(encoding="utf-8", errors="replace")
TOOLS = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TOOLS)

SIT = re.compile(r"^\s*(?:import|from)\s+(?:urllib(?!\.parse\b)|requests|http\.client|http\b|httpx|aiohttp|socket|urllib3|pycurl)\b"
                 r"|\b(?:urllib\.request|requests\.(?:get|post|Session)|http\.client)\b", re.M)
CURL = re.compile(r"(?:^|[\s;&|(`'\"])(curl|wget)(?=\s)")
URL = re.compile(r"https?://([^/\s'\"]+)")
LOKAL = re.compile(r"^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$")
PYTHON = re.compile(r"(?:^|[\s;&|(`/])(?:python3?(?:\.\d+)?|py(?:\s+-3)?)((?:\s+-[A-Za-z]+(?:\s+utf8)?)*)\s+(\S+)")
NAVOD = ("Síťový přístup k webům archivů jde jen přes tools/slusne.py (společný limit rychlosti – archivy jinak "
         "zablokují IP adresu uživatele). Spusť to takhle:\n"
         "  vlastní skript:  python3 -I tools/slusne.py pracovni/<skript>.py [argumenty]\n"
         "  curl:            python3 -I tools/slusne.py curl [argumenty]\n"
         "  hotový nástroj:  python3 -I tools/<nástroj>.py … (limit mají samy)\n"
         "Neobcházej to (jiný příkaz, prohlížeč ve smyčce). Smyčky dotazů na archiv nepiš vůbec – použij nástroj.")


def zamitni(proc):
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny",
                                             "permissionDecisionReason": f"{proc}\n\n{NAVOD}"}}, ensure_ascii=False))
    sys.exit(0)


def v_tools(cesta, cwd):
    p = os.path.realpath(os.path.join(cwd, os.path.expanduser(cesta)))
    return os.path.dirname(p) == os.path.realpath(os.path.join(cwd, "tools")) or os.path.dirname(p) == TOOLS


def obsah(cesta, cwd):
    try:
        with open(os.path.join(cwd, os.path.expanduser(cesta)), encoding="utf-8", errors="replace") as f:
            return f.read(500_000)
    except OSError:
        return ""


def api_host():
    """Host vlastního API rodokmenu (RODOKMEN_API_URL z prostředí nebo .env) – volání na něj není přístup k archivu."""
    try:
        import urllib.parse, rdb_klient
        return (urllib.parse.urlsplit(rdb_klient.konfig()[0]).netloc or "").lower()
    except Exception:
        return ""


def povoleny(host):
    host, api = (host or "").lower(), api_host()
    return bool(LOKAL.match(host)) or (bool(api) and host in (api, api.split(":")[0]))


def jen_lokalni(text):
    hosty = URL.findall(text)
    return bool(hosty) and all(povoleny(h) for h in hosty)


def bash(cmd, cwd):
    # curl / wget mimo `slusne.py curl`
    for m in CURL.finditer(cmd):
        pred = cmd[max(0, m.start() - 30):m.start() + 1]
        if re.search(r"slusne\.py[\"']?\s*$", pred):
            continue
        zbytek = re.split(r"[;&|\n]", cmd[m.end():], maxsplit=1)[0]
        if URL.search(zbytek) and not jen_lokalni(zbytek):
            zamitni(f"{m.group(1)} na web mimo slusne.py")
        if not URL.search(zbytek) and "$" in zbytek:   # adresa v proměnné – nevíme kam, raději ne
            zamitni(f"{m.group(1)} s adresou v proměnné mimo slusne.py")
    # Python
    for m in PYTHON.finditer(cmd):
        volby, cil = m.group(1) or "", m.group(2).strip("\"'")
        if re.search(r"(?:^|/)slusne\.py$", cil):
            continue
        if cil.startswith("-c") or re.search(r"\s-[A-Za-z]*c$", volby.rstrip()):
            kod = cmd[m.end():]
        elif cil == "-" or cil.startswith("<<") or "<<" in cmd[m.end():m.end() + 40]:
            kod = cmd[m.end():]   # heredoc / stdin: text za příkazem
        elif cil.endswith(".py") and not v_tools(cil, cwd):
            kod = obsah(cil, cwd)
        else:
            continue   # nástroj z tools/ (limit má sám), python -m …, python bez skriptu
        if SIT.search(kod) and not jen_lokalni(kod):
            zamitni("Python se síťovým importem mimo slusne.py")
    # shellové skripty mimo tools/
    for m in re.finditer(r"(?:^|[\s;&|(])(?:bash|sh|zsh)\s+(\S+\.sh)\b", cmd):
        if not v_tools(m.group(1), cwd) and CURL.search(" " + obsah(m.group(1), cwd)):
            zamitni(f"skript {m.group(1)} volá curl/wget mimo slusne.py")


def webfetch(url):
    import urllib.parse, slusne
    host = urllib.parse.urlsplit(url).hostname or ""
    if not host or povoleny(host) or povoleny(urllib.parse.urlsplit(url).netloc):
        return
    try:
        slusne.pockej(host, slusne.druh(url), nejdele=40)   # hook má timeout 60 s – po něm by WebFetch prošel bez limitu
    except (slusne.Zablokovano, slusne.Fronta) as e:
        zamitni(str(e))


def main():
    try:
        d = json.load(sys.stdin)
    except ValueError:
        return
    vstup = d.get("tool_input") or {}
    if d.get("tool_name") == "Bash":
        bash(vstup.get("command", ""), d.get("cwd") or os.getcwd())
    elif d.get("tool_name") == "WebFetch":
        webfetch(vstup.get("url", ""))


if __name__ == "__main__":
    main()
