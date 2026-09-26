# ============================================================
#  UI-Pruefung der Website - wiederholbar, ohne echte Datenbank
# ============================================================
#  Oeffnet jede Seite (alle *.html im Hauptordner) in Chromium, in
#  mehreren Breiten und Datenzustaenden, misst Barrierefreiheit und
#  Layout und macht Bildschirmfotos. Ergebnis: ein Bericht in Worten.
#
#  Aufruf (aus dem Hauptordner der Website):
#    python3 werkzeuge/ui-pruefung/pruefen.py
#    python3 werkzeuge/ui-pruefung/pruefen.py --seiten quiz.html,termine.html
#    python3 werkzeuge/ui-pruefung/pruefen.py --breiten 390 --ohne-bilder
#    python3 werkzeuge/ui-pruefung/pruefen.py --streng   (Exit-Code 1 bei Befunden)
#
#  Voraussetzung einmalig:  pip3 install playwright
#                           python3 -m playwright install chromium
#
#  Sicherheit: Jeder Aufruf an Supabase wird im Browser abgefangen und
#  aus zustaende.py beantwortet; alle anderen fremden Adressen werden
#  blockiert. Die Pruefung kann also nichts in der echten Datenbank
#  lesen oder aendern.
#
#  Entstanden 26.09.2026 aus der einmaligen Durchsicht vom 25.09. (Plan D).
# ============================================================
import argparse, asyncio, functools, json, sys, threading
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HIER = Path(__file__).resolve().parent
WURZEL = HIER.parent.parent
sys.path.insert(0, str(HIER))
from zustaende import ZUSTAENDE  # noqa: E402

PRUEFUNGEN_JS = (HIER / "pruefungen.js").read_text(encoding="utf8")
PRUEFUNGEN_JS = "\n".join(z for z in PRUEFUNGEN_JS.splitlines() if not z.startswith("//"))

# quiz.html und obmann.html laden supabase-js per CDN (mit SRI). Statt des
# echten Pakets bekommen sie diesen Ersatz - er antwortet aus __MOCK__.
SUPABASE_ERSATZ = """
(() => {
  const antwort = (name) => { const d = (window.__MOCK__ || {})[name]; return d === undefined ? [] : d; };
  const abfrage = () => { const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q,
    single: async () => ({ data: null, error: null }), maybeSingle: async () => ({ data: null, error: null }),
    then: (fertig) => fertig({ data: [], error: null }) }; return q; };
  const ersatz = { createClient: () => ({
    rpc: async (name) => ({ data: antwort(name), error: null }),
    from: () => abfrage(),
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: null }, error: null }) },
    },
  }) };
  Object.defineProperty(window, "supabase", { value: ersatz, writable: false, configurable: false });
})();
"""

SCHWER = ["js_fehler", "ueberlauf", "namenlos", "ohneLabel", "bilder", "ids", "kontrast", "ziele", "fokus"]
TITEL = {
    "js_fehler": "JavaScript-Fehler",
    "ueberlauf": "Seite breiter als der Bildschirm (WCAG 1.4.10)",
    "namenlos": "Knopf/Link ohne Namen (4.1.2)",
    "ohneLabel": "Eingabefeld ohne Beschriftung (3.3.2)",
    "bilder": "Bild ohne alt (1.1.1)",
    "ids": "Doppelte id",
    "kontrast": "Zu wenig Kontrast (1.4.3)",
    "ziele": "Tippflaeche unter 24 px (2.5.8)",
    "fokus": "Tastaturfokus nicht sichtbar (2.4.7)",
    "nurSymbol": "Hinweis: Knopf nur mit Symbol (Hausregel)",
    "h1": "Hinweis: nicht genau eine sichtbare h1",
}


def starte_server():
    class Leise(SimpleHTTPRequestHandler):
        def log_message(self, *args):  # keine Zeile je geladener Datei
            pass
    handler = functools.partial(Leise, directory=str(WURZEL))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_address[1]}"


FOKUS_JS = """
() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const s = getComputedStyle(el);
  const sichtbar = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none');
  const name = (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ' ' + (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30)).trim();
  return { name, sichtbar };
}
"""


def befunde_aus(erg, breite):
    """Rohmessung -> Liste lesbarer Zeilen je Kategorie."""
    b = {}
    if erg.get("js_fehler"):
        b["js_fehler"] = erg["js_fehler"]
    if erg.get("ueberlauf", 0) > 1:
        b["ueberlauf"] = [f"{erg['ueberlauf']} px zu breit bei {breite} px"]
    for k in ("namenlos", "ohneLabel", "bilder", "nurSymbol"):
        if erg.get(k):
            b[k] = list(erg[k])
    if erg.get("ids"):
        b["ids"] = [f"#{i}" for i in erg["ids"]]
    if erg.get("kontrast"):
        b["kontrast"] = [f"{k['el']} \"{k['text']}\" - {k['q']}:1 ({k['vg']} auf {k['hg']}, {k['px']}px)" for k in erg["kontrast"]]
    if erg.get("ziele"):
        b["ziele"] = [f"{z['el']} \"{z['text']}\" - {z['w']}x{z['h']} px" for z in erg["ziele"]]
    if erg.get("fokus"):
        b["fokus"] = erg["fokus"]
    if erg.get("h1") is not None and erg.get("h1") != 1:
        b["h1"] = [f"{erg['h1']} sichtbare h1"]
    return b


async def pruefe_seite(ctx, basis, seite, bildpfad):
    page = await ctx.new_page()
    fehler = []
    page.on("pageerror", lambda e: fehler.append(str(e).splitlines()[0][:160]))

    def konsole(m):
        t = m.text
        if m.type == "error" and "Failed to load resource" not in t and "ERR_" not in t:
            fehler.append("console: " + t[:160])
    page.on("console", konsole)
    try:
        await page.goto(f"{basis}/{seite}", wait_until="load", timeout=20000)
        await page.wait_for_timeout(900)
        erg = await page.evaluate(PRUEFUNGEN_JS)
        if bildpfad:
            await page.screenshot(path=str(bildpfad), full_page=True)
        # Tastatur: bis zu 12 Mal Tab, jedes fokussierte Element muss man sehen.
        ohne = []
        for _ in range(12):
            await page.keyboard.press("Tab")
            f = await page.evaluate(FOKUS_JS)
            if f and not f["sichtbar"] and f["name"] not in ohne:
                ohne.append(f["name"])
        erg["fokus"] = ohne
    except Exception as e:  # Seite laedt nicht -> selbst ein Befund
        erg = {"ueberlauf": 0}
        fehler.append(f"Seite nicht pruefbar: {str(e).splitlines()[0][:160]}")
    erg["js_fehler"] = fehler
    await page.close()
    return erg


async def lauf(args, ziel):
    from playwright.async_api import async_playwright

    server, basis = starte_server()
    seiten = args.seiten or sorted(p.name for p in WURZEL.glob("*.html"))
    breiten = [int(b) for b in args.breiten.split(",")]
    zustaende = args.zustaende.split(",")
    for z in zustaende:
        if z not in ZUSTAENDE:
            sys.exit(f"Unbekannter Zustand '{z}'. Vorhanden: {', '.join(ZUSTAENDE)}")
    ergebnisse = {}
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for zname in zustaende:
            zustand = ZUSTAENDE[zname]
            for breite in breiten:
                ctx = await browser.new_context(viewport={"width": breite, "height": 844 if breite < 700 else 900}, locale="de-DE")
                vorab = "window.__MOCK__ = " + json.dumps(zustand["rpc"], default=str) + ";"
                if zustand["sitzung"]:
                    vorab += "sessionStorage.setItem('schiriQuizSession', " + json.dumps(json.dumps(zustand["sitzung"])) + ");"
                await ctx.add_init_script(vorab + SUPABASE_ERSATZ)
                rpc = zustand["rpc"]

                # Playwright uebergibt (route, request), wenn der Handler zwei
                # Parameter hat - deshalb rpc ueber die Schliessung, nicht als Default.
                async def weiche(route):
                    u = route.request.url
                    if u.startswith(basis):
                        return await route.continue_()
                    if "/rest/v1/rpc/" in u:
                        name = u.split("/rest/v1/rpc/")[1].split("?")[0]
                        return await route.fulfill(status=200, content_type="application/json", body=json.dumps(rpc.get(name, []), default=str))
                    if "/rest/v1/" in u:
                        # Tabellen-Abfragen (z. B. Funktionsfreigaben) aus
                        # zustand["rest"]; unbekannte Tabellen -> [].
                        tabelle = u.split("/rest/v1/")[1].split("?")[0]
                        daten = zustand.get("rest", {}).get(tabelle, [])
                        return await route.fulfill(status=200, content_type="application/json", body=json.dumps(daten, default=str))
                    return await route.abort()
                await ctx.route("**/*", weiche)
                for seite in seiten:
                    bild = None if args.ohne_bilder else ziel / "bilder" / f"{zname}-{breite}-{seite.replace('.html', '')}.png"
                    erg = await pruefe_seite(ctx, basis, seite, bild)
                    ergebnisse[f"{seite}|{zname}|{breite}"] = befunde_aus(erg, breite)
                    print(f"  {zname:11} {breite:>5}  {seite:28} {sum(len(v) for k, v in ergebnisse[f'{seite}|{zname}|{breite}'].items() if k in SCHWER)} Befunde")
                await ctx.close()
        await browser.close()
    server.shutdown()
    return seiten, ergebnisse


def bericht(seiten, ergebnisse, ziel):
    zeilen = [f"# UI-Pruefung {datetime.now():%d.%m.%Y %H:%M}", "",
              "Massstab WCAG 2.2 AA. Daten gemockt (werkzeuge/ui-pruefung/zustaende.py), keine echte Datenbank.", ""]
    summe = {k: 0 for k in SCHWER}
    je_seite = {}
    for schluessel, b in ergebnisse.items():
        seite, zname, breite = schluessel.split("|")
        for kat, liste in b.items():
            for eintrag in liste:
                je_seite.setdefault(seite, {}).setdefault(kat, {}).setdefault(eintrag, []).append(f"{zname} {breite}")
    for seite, kats in je_seite.items():
        for kat, eintraege in kats.items():
            if kat in summe:
                summe[kat] += len(eintraege)
    gesamt = sum(summe.values())
    zeilen.append(f"**{gesamt} Befunde** auf {len(seiten)} Seiten" + (" - alles sauber." if gesamt == 0 else "."))
    if gesamt:
        zeilen += ["", "| Art | Anzahl |", "|---|---|"] + [f"| {TITEL[k]} | {n} |" for k, n in summe.items() if n]
    # Hinweise, die auf vielen Seiten gleich sind (Kopfzeile, Logo), einmal
    # oben nennen statt 20-mal unten.
    haeufig = {}
    for seite, kats in je_seite.items():
        for kat in ("nurSymbol", "h1"):
            for eintrag in kats.get(kat, {}):
                haeufig.setdefault((kat, eintrag), set()).add(seite)
    ueberall = {k for k, v in haeufig.items() if len(v) > 3}
    if ueberall:
        zeilen += ["", "## Auf vielen Seiten gleich (Hinweis)"]
        zeilen += [f"- {TITEL[k]}: {e} _({len(haeufig[(k, e)])} Seiten)_" for k, e in sorted(ueberall)]
    for seite, kats in je_seite.items():
        for kat, eintrag in ueberall:
            kats.get(kat, {}).pop(eintrag, None)
        for kat in [k for k, v in kats.items() if not v]:
            del kats[kat]
    for seite in seiten:
        kats = je_seite.get(seite)
        if not kats:
            continue
        zeilen += ["", f"## {seite}"]
        for kat in SCHWER + ["nurSymbol", "h1"]:
            if kat not in kats:
                continue
            zeilen.append(f"**{TITEL[kat]}**")
            for eintrag, wo in kats[kat].items():
                zeilen.append(f"- {eintrag}  _({', '.join(wo)})_")
    ohne = [s for s in seiten if not je_seite.get(s)]
    if ohne:
        zeilen += ["", "## Ohne Befund", ", ".join(ohne)]
    (ziel / "bericht.md").write_text("\n".join(zeilen) + "\n", encoding="utf8")
    (ziel / "ergebnis.json").write_text(json.dumps(ergebnisse, ensure_ascii=False, indent=1), encoding="utf8")
    return gesamt


def main():
    a = argparse.ArgumentParser(description="UI-Pruefung der Website (gemockte Daten, WCAG 2.2 AA)")
    a.add_argument("--seiten", type=lambda s: [x.strip() for x in s.split(",") if x.strip()], help="Kommagetrennt; Standard: alle *.html")
    a.add_argument("--breiten", default="390,1280", help="Kommagetrennte Fensterbreiten in px (Standard 390,1280)")
    a.add_argument("--zustaende", default=",".join(ZUSTAENDE), help=f"Kommagetrennt aus: {', '.join(ZUSTAENDE)}")
    a.add_argument("--ohne-bilder", action="store_true", help="Keine Bildschirmfotos (schneller)")
    a.add_argument("--ziel", help="Ausgabeordner; Standard werkzeuge/ui-pruefung/ergebnis/<Zeitstempel>")
    a.add_argument("--streng", action="store_true", help="Exit-Code 1, sobald es Befunde gibt")
    args = a.parse_args()
    ziel = Path(args.ziel) if args.ziel else HIER / "ergebnis" / f"{datetime.now():%Y-%m-%d_%H%M}"
    (ziel / "bilder").mkdir(parents=True, exist_ok=True)
    print(f"Pruefe {WURZEL} -> {ziel}")
    seiten, ergebnisse = asyncio.run(lauf(args, ziel))
    gesamt = bericht(seiten, ergebnisse, ziel)
    print(f"\n{gesamt} Befunde. Bericht: {ziel / 'bericht.md'}")
    sys.exit(1 if args.streng and gesamt else 0)


if __name__ == "__main__":
    main()
