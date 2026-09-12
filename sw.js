// ============================================================
//  Service Worker - ausschliesslich fuer Benachrichtigungen
// ============================================================
//  Max am 12.09.2026, nachdem die Seite auf dem Home-Bildschirm liegt:
//  "Gibt es die Moeglichkeit von Push Notifications ueber die Webseite?"
//
//  Ja - aber ein Service Worker ist ein scharfes Werkzeug. Sobald er
//  registriert ist, sitzt er zwischen Browser und Netz und bleibt dort,
//  auch nach dem Schliessen der Seite. Wer ihm einen "fetch"-Zuhoerer
//  gibt, uebernimmt damit die Auslieferung JEDER Datei - und liefert bei
//  einem Fehler wochenlang alte Staende aus, die niemand mehr loswird.
//
//  DESHALB HAT DIESE DATEI KEINEN "fetch"-ZUHOERER.
//  Kein Zwischenspeicher, kein Offline-Betrieb, keine Auslieferung.
//  Ohne fetch-Zuhoerer holt der Browser jede Seite wie bisher direkt aus
//  dem Netz - der Worker ist fuer das Laden der Seite vollstaendig
//  unsichtbar. Er tut genau zwei Dinge: eine Benachrichtigung anzeigen
//  und auf das Antippen reagieren.
//
//  Wer hier spaeter Offline-Betrieb einbauen will: das ist ein eigenes
//  Vorhaben mit eigener Versionierung der Zwischenspeicher und einem
//  Weg, einen kaputten Stand wieder loszuwerden. Nicht nebenbei.
// ============================================================

// Sofort uebernehmen statt auf das Schliessen aller Tabs zu warten.
// Bei einem Worker ohne fetch-Zuhoerer ist das gefahrlos: es gibt keine
// halb ausgelieferte Seite, die durch den Wechsel inkonsistent wuerde.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

const STANDARD = {
  titel: "Schiedsrichter",
  text: "Es gibt etwas Neues.",
  ziel: "/",
};

self.addEventListener("push", (ereignis) => {
  let daten = {};
  try {
    daten = ereignis.data ? ereignis.data.json() : {};
  } catch {
    // Kein JSON: dann ist der Rohtext die Nachricht. Lieber eine
    // unvollstaendige Benachrichtigung als gar keine - auf iOS MUSS
    // ohnehin jede Zustellung sichtbar werden, sonst entzieht das
    // System die Erlaubnis.
    daten = { text: ereignis.data ? ereignis.data.text() : "" };
  }

  const titel = String(daten.titel || STANDARD.titel).slice(0, 120);
  const text = String(daten.text || STANDARD.text).slice(0, 400);
  const ziel = typeof daten.ziel === "string" && daten.ziel.startsWith("/")
    ? daten.ziel
    : STANDARD.ziel;

  ereignis.waitUntil(self.registration.showNotification(titel, {
    body: text,
    // Android zeigt dieses Symbol gross in der Mitteilung. Die kleine
    // "badge" in der Statusleiste muesste einfarbig-transparent sein -
    // ein farbiges Wappen wird dort zu einem grauen Klecks. Solange es
    // kein eigenes einfarbiges Symbol gibt, bleibt die Angabe weg und
    // Android nimmt sein eigenes Standardsymbol. iOS benutzt beides
    // nicht und zeigt immer das App-Symbol vom Home-Bildschirm.
    icon: "/bilder/app-icon-192.png",
    // Gleiches "tag" heisst: eine neue Nachricht ersetzt die alte,
    // statt sich zu stapeln. Bei einer Vereinsseite mit einer Handvoll
    // Nachrichten pro Woche ist ein Stapel nur Laerm.
    tag: String(daten.gruppe || "allgemein"),
    renotify: true,
    data: { ziel },
  }));
});

self.addEventListener("notificationclick", (ereignis) => {
  ereignis.notification.close();
  const ziel = ereignis.notification.data?.ziel || STANDARD.ziel;
  ereignis.waitUntil((async () => {
    const fenster = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // Ist die App schon offen, wird sie nach vorn geholt und umgeleitet -
    // ein zweites Fenster derselben App ist auf dem Handy verwirrend.
    for (const f of fenster) {
      if ("focus" in f) {
        await f.focus();
        if ("navigate" in f) await f.navigate(ziel).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(ziel);
  })());
});
