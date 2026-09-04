import { sichereApiAntwort, supabaseRpc } from '../server/api-helpers.js';
import { gastFeedbackEingabe, gastLimitSchluessel } from '../server/website-feedback.js';

export default async function handler(req, res) {
  sichereApiAntwort(res);
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).json({fehler:'Bitte das Formular verwenden.'}); }
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
    return res.status(415).json({fehler:'Ungültiges Datenformat.'});
  }
  const eingabe = gastFeedbackEingabe(req.body);
  if (!eingabe) return res.status(400).json({fehler:'Bitte einen Text mit höchstens 3.800 Zeichen und optional einen kurzen Namen eingeben.'});
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const schluessel = gastLimitSchluessel(req, secret);
  if (!schluessel) return res.status(503).json({fehler:'Feedback ist gerade nicht verfügbar. Bitte später erneut versuchen.'});
  try {
    const antwort = await supabaseRpc('website_feedback_gast', {...eingabe,p_limit_schluessel:schluessel});
    if (antwort?.limit) {
      res.setHeader('Retry-After','900');
      return res.status(429).json({fehler:'Bitte warte 15 Minuten, bevor du weitere Rückmeldungen abschickst. Dein Text wurde noch nicht gesendet.'});
    }
    if (antwort?.ok !== true) throw new Error('Feedback nicht bestätigt');
    return res.status(200).json({ok:true});
  } catch {
    return res.status(503).json({fehler:'Feedback konnte nicht gespeichert werden. Bitte später erneut versuchen.'});
  }
}
