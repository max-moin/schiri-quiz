import re
def hake(s, von, bis, tagmuster, schluessel):
    a = s.index(von); b = s.index(bis, a); region = s[a:b]
    treffer = [m for m in re.finditer(tagmuster, region) if "data-text=" not in m.group(0)]
    assert len(treffer) == len(schluessel), "%d Treffer, %d Schluessel (%s)" % (len(treffer), len(schluessel), schluessel[0])
    neu, zuletzt = [], 0
    for m, k in zip(treffer, schluessel):
        ende = m.group(0).index(">")
        neu.append(region[zuletzt:m.start()])
        neu.append(m.group(0)[:ende] + ' data-text="%s"' % k + m.group(0)[ende:])
        zuletzt = m.end()
    neu.append(region[zuletzt:])
    return s[:a] + "".join(neu) + s[b:], len(schluessel)

gesamt = 0
d = "spesenrechner.html"; s = open(d, encoding="utf-8").read(); n = 0
s, k = hake(s, '<main', '</main>', r'<span class="feldname" id="schnellLabel">',
            ["spesen.schnellwahl-hinweis"]); n += k
s, k = hake(s, '<main', '</main>', r'<p class="hinweis-klein">',
            ["spesen.hinweis-turnier", "spesen.hinweis-fahrschein", "spesen.hinweis-strecke"]); n += k
s, k = hake(s, '<main', '</main>', r'<span class="etikett-zusatz">',
            ["spesen.hinweis-tarifzone", "spesen.hinweis-vereinssitz"]); n += k
s, k = hake(s, '<main', '</main>', r'<p class="q-abschluss-titel">', ["spesen.ergebnis-titel"]); n += k
s, k = hake(s, '<main', '</main>', r'<p class="q-abschluss-text">', ["spesen.ergebnis-text"]); n += k
# Der zweite q-haftung-Absatz traegt eine id und wird vom Skript ein- und
# ausgeblendet; sein Muster hat Attribute und faellt hier heraus.
s, k = hake(s, '<main', '</main>', r'<p class="q-haftung">', ["spesen.haftung"]); n += k
open(d, "w", encoding="utf-8").write(s); print("%-22s %2d" % (d, n)); gesamt += n

d = "informationen.html"; s = open(d, encoding="utf-8").read(); n = 0
s, k = hake(s, '<h1 data-text="unterlagen.titel"', '<div class="dokumentliste"',
            r'<p(?![a-z])(?![^>]*class="seiten-unter")[^>]*>', ["unterlagen.erklaerung"]); n += k
s, k = hake(s, '<h2>Was hier nicht steht</h2>', '</section>', r'<p(?![a-z])[^>]*>',
            ["unterlagen.schluss-text"]); n += k
open(d, "w", encoding="utf-8").write(s); print("%-22s %2d" % (d, n)); gesamt += n
print("gesamt:", gesamt)
