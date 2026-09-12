// Verdrahtung des Bandes "Das steht an" auf der Startseite.
// Eigene Datei, weil index.html nur Module einbinden soll und die
// Fachlogik nicht im HTML stehen darf.
import { montiereAktuelles } from "./aktuelles.js";

montiereAktuelles(document.getElementById("aktuelles"));
