/** Kleine, DOM-unabhaengige Supabase-Auth-Schicht fuer den Obmann-Zugang. */

export async function mitPasswortAnmelden(client, email, passwort) {
  const ergebnis = await client.auth.signInWithPassword({
    email: String(email || "").trim(),
    password: String(passwort || ""),
  });
  if (ergebnis.error) throw ergebnis.error;
  return ergebnis.data;
}

export async function authentifizierungsStand(client) {
  const sitzung = await client.auth.getSession();
  if (sitzung.error) throw sitzung.error;
  if (!sitzung.data.session) return { angemeldet: false, aal2: false, faktor: null };

  const [aal, faktoren] = await Promise.all([
    client.auth.mfa.getAuthenticatorAssuranceLevel(),
    client.auth.mfa.listFactors(),
  ]);
  if (aal.error) throw aal.error;
  if (faktoren.error) throw faktoren.error;

  const totp = faktoren.data.totp || [];
  return {
    angemeldet: true,
    aal2: aal.data.currentLevel === "aal2",
    kannAal2Werden: aal.data.nextLevel === "aal2",
    faktor: totp.find((eintrag) => eintrag.status === "verified") || null,
    unbestaetigteFaktoren: totp.filter((eintrag) => eintrag.status !== "verified"),
    benutzer: sitzung.data.session.user,
  };
}

export async function totpEinrichten(client, unbestaetigteFaktoren = []) {
  // Ein abgebrochener erster Versuch besitzt keinen erneut abrufbaren QR-Code.
  // Solche Faktoren werden deshalb vor einem neuen Setup entfernt.
  for (const faktor of unbestaetigteFaktoren) {
    const entfernt = await client.auth.mfa.unenroll({ factorId: faktor.id });
    if (entfernt.error) throw entfernt.error;
  }
  const ergebnis = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Schiri-Webseite Obmann",
  });
  if (ergebnis.error) throw ergebnis.error;
  return ergebnis.data;
}

// ============================================================
//  Zweiter Faktor: Anfrage und Pruefung von Hand
// ------------------------------------------------------------
//  Warum nicht client.auth.mfa.challenge/verify? Weil die
//  Bibliothek bei diesen beiden Aufrufen keinen Authorization-
//  Header mitschickt, sobald der Zugang mit einem der neuen
//  Supabase-Schluessel (sb_publishable_...) aufgebaut wurde.
//  Gemessen am 13.09.2026 im Auth-Protokoll des Projekts:
//
//    POST /token                      200   (Anmeldung)
//    GET  /user                       200   (Bearer kommt an)
//    POST /factors/<id>/challenge     401   no_authorization
//
//  Die Sitzung war dabei vorhanden - der 2FAS-Bildschirm
//  erscheint ueberhaupt nur, wenn getSession() eine liefert.
//  Es ist also nicht die Sitzung, die fehlt, sondern der
//  Header. Deshalb holen wir das Zugangstoken hier ausdruecklich
//  und setzen es selbst; damit kann die Anfrage gar nicht mehr
//  unangemeldet hinausgehen.
//
//  Die Antwort auf "verify" ist eine NEUE Sitzung auf Stufe
//  aal2. Sie muss zurueck in den Client, sonst arbeitet der
//  Rest der Seite weiter mit der alten Stufe und jede
//  Veroeffentlichung scheitert an der Zeilenschutz-Regel.
// ============================================================

async function authAnfrage(zugang, pfad, koerper, token) {
  const antwort = await fetch(`${zugang.adresse}/auth/v1${pfad}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: zugang.schluessel,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(koerper),
  });
  const inhalt = await antwort.json().catch(() => ({}));
  if (!antwort.ok) {
    throw new Error(inhalt.msg || inhalt.error_description || inhalt.message
      || `Der Server hat mit ${antwort.status} geantwortet.`);
  }
  return inhalt;
}

export async function totpBestaetigen(client, faktorId, code, zugang) {
  const saubererCode = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(saubererCode)) {
    throw new Error("Bitte den sechsstelligen Code aus 2FAS eingeben.");
  }
  if (!zugang?.adresse || !zugang?.schluessel) {
    throw new Error("Der Zugang zur Datenbank ist nicht vollständig eingerichtet.");
  }

  const sitzung = await client.auth.getSession();
  if (sitzung.error) throw sitzung.error;
  const token = sitzung.data.session?.access_token;
  if (!token) {
    throw new Error("Die Anmeldung ist abgelaufen. Bitte melde dich noch einmal mit E-Mail und Passwort an.");
  }

  const herausforderung = await authAnfrage(zugang, `/factors/${faktorId}/challenge`, {}, token);
  const pruefung = await authAnfrage(zugang, `/factors/${faktorId}/verify`, {
    challenge_id: herausforderung.id,
    code: saubererCode,
  }, token);

  if (!pruefung.access_token || !pruefung.refresh_token) {
    throw new Error("Der Code wurde angenommen, aber es kam keine neue Sitzung zurück.");
  }
  const uebernommen = await client.auth.setSession({
    access_token: pruefung.access_token,
    refresh_token: pruefung.refresh_token,
  });
  if (uebernommen.error) throw uebernommen.error;
  return pruefung;
}

export async function abmelden(client) {
  const ergebnis = await client.auth.signOut();
  if (ergebnis.error) throw ergebnis.error;
}
