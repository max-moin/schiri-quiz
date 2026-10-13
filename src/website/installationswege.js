export function erkenneGeraet({ userAgent = '', maxTouchPoints = 0 } = {}) {
  const ua = String(userAgent);
  const system = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1) ? 'ios'
    : /Android/i.test(ua) ? 'android' : /Windows/i.test(ua) ? 'windows' : /Macintosh|Mac OS X/i.test(ua) ? 'mac' : 'andere';
  const browser = /SamsungBrowser/i.test(ua) ? 'samsung' : /Edg(?:A|iOS)?\//i.test(ua) ? 'edge'
    : /Firefox|FxiOS/i.test(ua) ? 'firefox' : /Chrome|Chromium|CriOS/i.test(ua) ? 'chrome'
      : /Safari/i.test(ua) ? 'safari' : 'andere';
  return { system, browser };
}
export function installationsweg(system, browser) {
  if (system === 'ios') return { titel: 'iPhone oder iPad · Safari', schritte: [
    browser === 'safari' ? 'Öffne die Website in Safari.' : 'Öffne diese Website in Safari. Kopiere bei Bedarf die Adresse aus deinem jetzigen Browser.',
    'Tippe auf Teilen: das Rechteck mit dem Pfeil nach oben.',
    'Wähle „Zum Home-Bildschirm“. Fehlt der Eintrag, prüfe „Aktionen bearbeiten“.',
    'Aktiviere „Als Web-App öffnen“, falls angeboten, und bestätige „Hinzufügen“.',
  ], hinweis: 'Für iPhone-Push öffnest du danach die installierte Website über das Kickers-Wappen.' };
  if (system === 'android') {
    const wege = {
      samsung: ['Öffne die Website in Samsung Internet.','Öffne das Menü (☰) oder tippe auf das Installationssymbol, falls angezeigt.','Suche „Seite hinzufügen zu“ → „Startbildschirm“ beziehungsweise „Zum Startbildschirm hinzufügen“.','Bestätige „Hinzufügen“ oder „Installieren“.'],
      firefox: ['Öffne die Website in Firefox.','Öffne das Drei-Punkte-Menü (⋮).','Wähle „Installieren“. Wird nur „Zum Startbildschirm hinzufügen“ angeboten, verwende diesen Eintrag.','Bestätige die Platzierung auf dem Startbildschirm.'],
      edge: ['Öffne die Website in Microsoft Edge.','Öffne das Browsermenü.','Suche „Zum Startbildschirm hinzufügen“ oder „App installieren“, falls angeboten.','Bestätige den Namen und „Hinzufügen“ beziehungsweise „Installieren“.'],
      chrome: ['Öffne die Website in Chrome.','Öffne das Drei-Punkte-Menü (⋮).','Wähle „Zum Startbildschirm hinzufügen“ oder „App installieren“.','Bestätige „Installieren“ oder „Hinzufügen“.'],
    };
    return { titel: `Android · ${{samsung:'Samsung Internet',firefox:'Firefox',edge:'Edge',chrome:'Chrome'}[browser] || 'anderer Browser'}`,
      schritte: wege[browser] || ['Öffne die Website direkt in deinem Browser, nicht im eingebauten Fenster einer Messenger-App.','Suche im Browsermenü nach „Installieren“, „Zum Startbildschirm hinzufügen“ oder „Verknüpfung hinzufügen“.','Fehlt diese Möglichkeit, öffne dieselbe Adresse in Samsung Internet, Firefox oder Chrome und wähle oben die passende Anleitung.'],
      hinweis: 'Menübezeichnungen unterscheiden sich nach Version. Eine einfache Verknüpfung öffnet den Browser; eine Web-App öffnet ein eigenes Fenster.' };
  }
  if (system === 'mac' && browser === 'safari') return { titel: 'Mac · Safari', schritte: [
    'Öffne die Website in Safari.','Wähle „Ablage“ → „Zum Dock hinzufügen“ oder Teilen → „Zum Dock hinzufügen“.','Bestätige den Namen und „Hinzufügen“.','Öffne die Website künftig über das Kickers-Wappen im Dock.',
  ], hinweis:'Diese Web-App-Funktion setzt macOS Sonoma 14 oder neuer voraus.' };
  if (browser === 'edge') return { titel:'Computer · Edge', schritte:[
    'Öffne die Website in Edge.','Öffne das Drei-Punkte-Menü → „Weitere Tools“ → „Apps“.','Wähle „Diese Website als App installieren“ oder das Installationssymbol in der Adressleiste.','Bestätige die Installation und hefte die App bei Bedarf an Start oder die Taskleiste.',
  ], hinweis:'Die genaue Menüstruktur kann sich zwischen Edge-Versionen unterscheiden.' };
  if (browser === 'chrome') return { titel:'Computer · Chrome', schritte:[
    'Öffne die Website in Chrome.','Nutze das Installationssymbol in der Adressleiste, falls angeboten.','Alternativ: Drei-Punkte-Menü → „Streamen, speichern und teilen“ → „Seite als App installieren“.','Bestätige die Installation.',
  ], hinweis:'Wenn dein Browser den direkten Installationsknopf bereitstellt, kannst du ihn oben benutzen.' };
  return { titel:'Computer · anderer Browser', schritte:[
    'Prüfe im Browsermenü, ob „Installieren“ oder „Website als App“ angeboten wird.','Falls nicht: speichere ein Lesezeichen für die Website.','Für eine App im eigenen Fenster kannst du Edge oder Chrome verwenden; am Mac auch Safari ab macOS Sonoma.',
  ], hinweis:'Installation und automatische Push-Unterstützung sind unterschiedliche Fähigkeiten. Die Website bleibt auch ohne Installation nutzbar.' };
}
