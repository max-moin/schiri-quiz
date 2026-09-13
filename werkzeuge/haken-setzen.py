# ============================================================
#  Redaktionshaken strukturell setzen
# ------------------------------------------------------------
#  Nicht ueber lange Textschnipsel, sondern ueber die Bloecke:
#  "im 2. Schritt des Wegs die Ueberschrift, der Absatz und die
#  Dauer". Das haelt auch, wenn der Text spaeter anders lautet.
#  Einmalig auszufuehren; danach stehen die Haken im HTML.
# ============================================================
import re, sys

def bereich(s, von, bis):
    a = s.index(von)
    b = s.index(bis, a)
    return a, b

def hake(s, von, bis, tagmuster, schluessel):
    """Hakt in der Region zwischen 'von' und 'bis' die Treffer von
       tagmuster der Reihe nach mit den gegebenen Schluesseln an."""
    a, b = bereich(s, von, bis)
    region = s[a:b]
    treffer = list(re.finditer(tagmuster, region))
    assert len(treffer) >= len(schluessel), \
        "zu wenige Treffer (%d) fuer %d Schluessel: %s" % (len(treffer), len(schluessel), schluessel[0])
    neu, zuletzt = [], 0
    for m, k in zip(treffer, schluessel):
        assert "data-text=" not in m.group(0), "schon angehakt: " + k
        ende = m.group(0).index(">")
        neu.append(region[zuletzt:m.start()])
        neu.append(m.group(0)[:ende] + ' data-text="%s"' % k + m.group(0)[ende:])
        zuletzt = m.end()
    neu.append(region[zuletzt:])
    return s[:a] + "".join(neu) + s[b:], len(schluessel)

P = r'<p(?![a-z])[^>]*>'
H3 = r'<h3(?![a-z])[^>]*>'

gesamt = 0

# ---------------- schiri-werden.html ----------------
d = "schiri-werden.html"
s = open(d, encoding="utf-8").read()
n = 0
s, k = hake(s, 'data-text="schiri-werden.warum"', '</section>', P,
            ["schiri-werden.warum-1", "schiri-werden.warum-2"]); n += k
s, k = hake(s, '<div class="zahlen">', '</section>', r'<div class="z">',
            ["schiri-werden.zahl-1-wert", "schiri-werden.zahl-2-wert", "schiri-werden.zahl-3-wert"]); n += k
s, k = hake(s, '<div class="zahlen">', '</section>', r'<div class="b">',
            ["schiri-werden.zahl-1-text", "schiri-werden.zahl-2-text", "schiri-werden.zahl-3-text"]); n += k
for nr in "12345":
    s, k = hake(s, '<li class="weg-schritt" data-nr="%s">' % nr, '</li>', H3,
                ["schiri-werden.weg-%s-titel" % nr]); n += k
    s, k = hake(s, '<li class="weg-schritt" data-nr="%s">' % nr, '</li>', P,
                ["schiri-werden.weg-%s-text" % nr]); n += k
    s, k = hake(s, '<li class="weg-schritt" data-nr="%s">' % nr, '</li>', r'<span class="dauer">',
                ["schiri-werden.weg-%s-dauer" % nr]); n += k
s, k = hake(s, 'data-text="schiri-werden.pate"', '</section>', P,
            ["schiri-werden.pate-1", "schiri-werden.pate-2"]); n += k
s, k = hake(s, 'data-text="schiri-werden.fragen"', '<p class="abschnitt-hinweis"', r'<summary>',
            ["schiri-werden.frage-%d" % i for i in range(1, 6)]); n += k
s, k = hake(s, 'data-text="schiri-werden.fragen"', '<p class="abschnitt-hinweis"', P,
            ["schiri-werden.antwort-1", "schiri-werden.antwort-2", "schiri-werden.antwort-3",
             "schiri-werden.antwort-4", "schiri-werden.antwort-4b", "schiri-werden.antwort-5"]); n += k
s, k = hake(s, '<p class="abschnitt-hinweis"', '</section>', P,
            ["schiri-werden.quellenhinweis"]); n += k
s, k = hake(s, 'data-text="schiri-werden.schluss"', '</section>', P,
            ["schiri-werden.schluss-text"]); n += k
open(d, "w", encoding="utf-8").write(s)
print("%-24s %2d neue Haken" % (d, n)); gesamt += n

# ---------------- index.html ----------------
d = "index.html"
s = open(d, encoding="utf-8").read()
n = 0
s, k = hake(s, '<div class="kachelraster">', '</section>', H3,
            ["start.kachel-1-titel", "start.kachel-2-titel", "start.kachel-3-titel"]); n += k
s, k = hake(s, '<div class="kachelraster">', '</section>', P,
            ["start.kachel-1-text", "start.kachel-2-text", "start.kachel-3-text"]); n += k
open(d, "w", encoding="utf-8").write(s)
print("%-24s %2d neue Haken" % (d, n)); gesamt += n

print("gesamt neu:", gesamt)
