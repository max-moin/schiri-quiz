// ============================================================
//  Das zweite Schloss: Obmann-Passwort im Arbeitsspeicher
// ============================================================
//  Die Redaktionsbereiche der Seite (Spesen, Regeln, Vorlagen,
//  Unterlagen) arbeiten mit Supabase Auth und 2FAS; ihre Tabellen haben
//  RLS-Policies, die an der angemeldeten Person haengen.
//
//  Die Terminfindung ist anders gebaut: terminfindungen,
//  terminfindung_vorschlaege und terminfindung_stimmen haben RLS ohne
//  jede Policy, und der einzige Weg hinein sind SECURITY-DEFINER-
//  Funktionen, die p_passwort gegen obmann_zugang pruefen. Dieselben
//  Funktionen benutzt die Swift-App.
//
//  Statt fuer dieselben drei Tabellen ein zweites Rechtemodell zu bauen,
//  fragt die Seite das Passwort einmal je Sitzung ab. Es liegt
//  ausschliesslich in dieser Closure:
//
//    * nicht in localStorage - das ueberlebt das Schliessen des
//      Browsers und liegt danach unbeaufsichtigt auf der Platte;
//    * nicht in sessionStorage - das ueberlebt jedes Neuladen und ist
//      aus jedem Skript derselben Seite lesbar;
//    * nicht im DOM - ein Passwortfeld, das stehen bleibt, wird von
//      Passwortmanagern und Bildschirmfotos mitgenommen.
//
//  Preis: nach jedem Neuladen fragt die Seite erneut. Das ist gewollt.
// ============================================================

export function erstellePasswortSchloss({ pruefe }) {
  let passwort = null;

  return Object.freeze({
    /** true, sobald ein einmal geprueftes Passwort vorliegt. */
    istOffen: () => passwort !== null,

    /** Getter fuer den Serverzugriff - nie den Wert selbst herumreichen. */
    wert: () => passwort,

    /* Prueft die Eingabe mit einem echten, lesenden Aufruf. Erst wenn der
       durchgeht, wird der Wert gemerkt. Ein falsches Passwort hinterlaesst
       also keinen Zustand, den ein spaeterer Aufruf still weiterbenutzt. */
    async oeffnen(eingabe) {
      const kandidat = String(eingabe || "");
      if (!kandidat) throw new Error("Bitte das Obmann-Passwort eingeben.");
      await pruefe(kandidat);
      passwort = kandidat;
    },

    schliessen() {
      passwort = null;
    },
  });
}
