import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

export function gastFeedbackEingabe(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (typeof body.text !== 'string' || typeof body.seite !== 'string') return null;
  const text = body.text.trim();
  const name = typeof body.name === 'string' ? body.name.trim().replace(/[\r\n]+/g, ' ') : '';
  if (!text || text.length > 3800 || name.length > 80 || !/^[a-z0-9-]{1,80}$/.test(body.seite)) return null;
  return {
    p_seite: body.seite,
    p_text: name ? `Freiwilliger Name (nicht geprüft): ${name}\n\n${text}` : text,
  };
}

export function gastLimitSchluessel(req, secret, jetzt = new Date()) {
  // Vercel setzt x-forwarded-for selbst. Lokal nur die Socket-Adresse nutzen.
  const adresse = process.env.VERCEL === '1'
    ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    : req.socket?.remoteAddress;
  if (!secret || !adresse || !isIP(adresse)) return null;
  // Kein Klartext-IP-Speicher; täglicher Wechsel, maximal 24 h im Limiter.
  return createHmac('sha256', secret).update(`website-feedback:${jetzt.toISOString().slice(0,10)}:${adresse}`).digest('hex');
}
