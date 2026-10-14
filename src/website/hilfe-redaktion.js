import { VEREIN, DATENBANK } from '../../verein.config.js';
import { BLOCKSEITEN } from './block-inhalte.js';
import { montiereBlockeditor } from '../admin/blockeditor.js';

// Derselbe Auth-Speicher wie im vorhandenen Obmann-Zugang. Nicht der Schiri-PIN.
if (window.supabase) {
  const client = window.supabase.createClient(DATENBANK.adresse, DATENBANK.oeffentlicherSchluessel);
  for (const seite of BLOCKSEITEN) {
    const wurzel = document.getElementById(seite);
    if (wurzel) montiereBlockeditor({ client, verein: VEREIN, wurzel, seite }).catch(() => {
      // Bei Netz-/Datenbankfehlern bleibt die vollständige Originalhilfe erhalten.
    });
  }
}
