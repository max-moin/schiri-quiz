// Verdrahtung des Bandes "Das steht an" auf der Startseite.
// Eigene Datei, weil index.html nur Module einbinden soll und die
// Fachlogik nicht im HTML stehen darf.
import { VEREIN } from "../../verein.config.js";
import { montiereAktuelles } from "./aktuelles.js";

// Bis Max das Band nach dem Start noch einmal abgenommen hat, bleibt der
// vorbereitete Bereich verborgen. Die normale Terminliste bleibt davon
// unberuehrt und laedt weiterhin am Seitenende.
if (VEREIN.startseite?.aktuellesAktiv === true) {
  montiereAktuelles(document.getElementById("aktuelles"));
}
