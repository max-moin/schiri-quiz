import { pruefeBlockseite } from '../website/block-inhalte.js';
export function erstelleBlockseitenSpeicher(client, seitenschluessel, seite) {
  async function rufe(name, parameter = {}) {
    const { data, error } = await client.rpc(name, { p_seitenschluessel: seitenschluessel, p_seite: seite, ...parameter });
    if (error) throw new Error(error.message);
    return data;
  }
  return {
    laden: () => rufe('website_blockseite_redaktion'),
    async speichern(inhalt, revision, veroeffentlichen = false) {
      const fehler = pruefeBlockseite(inhalt);
      if (fehler.length) throw new Error(fehler.slice(0, 4).join(' '));
      return rufe('website_blockseite_speichern', { p_inhalt: inhalt, p_revision: revision, p_veroeffentlichen: veroeffentlichen });
    },
  };
}
