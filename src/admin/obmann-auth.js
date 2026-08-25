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

export async function totpBestaetigen(client, faktorId, code) {
  const saubererCode = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(saubererCode)) {
    throw new Error("Bitte den sechsstelligen Code aus 2FAS eingeben.");
  }
  const herausforderung = await client.auth.mfa.challenge({ factorId: faktorId });
  if (herausforderung.error) throw herausforderung.error;
  const pruefung = await client.auth.mfa.verify({
    factorId: faktorId,
    challengeId: herausforderung.data.id,
    code: saubererCode,
  });
  if (pruefung.error) throw pruefung.error;
  return pruefung.data;
}

export async function abmelden(client) {
  const ergebnis = await client.auth.signOut();
  if (ergebnis.error) throw ergebnis.error;
}
