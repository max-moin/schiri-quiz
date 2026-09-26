import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { pdfAusBase64, pdfName, PROTOKOLL_PDF_GRENZE, storageAdresse } from "../server/protokoll-pdf.js";
import upload from "../api/protokoll-hochladen.js";

const lies = (pfad) => readFileSync(new URL("../" + pfad, import.meta.url), "utf8");
const sql = lies("supabase/migrations/20260926014910_termin_protokoll_pdf.sql");
const terminSeite = lies("src/website/termine-seite.js");

function antwort() {
  return { code: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; } };
}

test("nur echte, begrenzte PDFs werden akzeptiert", () => {
  const datei = Buffer.from("%PDF-1.7\n%%EOF");
  assert.deepEqual(pdfAusBase64(datei.toString("base64")), datei);
  assert.equal(pdfAusBase64(Buffer.from("NOTPDF").toString("base64")), null);
  assert.equal(pdfAusBase64("../../datei"), null);
  assert.equal(pdfAusBase64(Buffer.alloc(PROTOKOLL_PDF_GRENZE + 1).toString("base64")), null);
  assert.equal(pdfName("../Protokoll\r\n.pdf"), "..Protokoll.pdf");
});

test("beide PDF-Aktionen verweigern GET und fehlerhafte Eingaben", async () => {
  for (const aktion of [undefined, "link"]) {
    const get = antwort();
    await upload({ method: "GET" }, get);
    assert.equal(get.code, 405);
    assert.equal(get.headers["Cache-Control"], "no-store");
    const post = antwort();
    await upload({ method: "POST", body: { aktion } }, post);
    assert.equal(post.code, 400);
  }
});

test("Storage-Pfade enthalten object genau einmal und Vercel bleibt bei 12 Functions", () => {
  assert.match(storageAdresse("object/sr-protokolle/abc.pdf"), /\/storage\/v1\/object\/sr-protokolle\/abc\.pdf$/);
  assert.doesNotMatch(storageAdresse("object/sr-protokolle/abc.pdf"), /\/object\/object\//);
  const rewrites = JSON.parse(lies("vercel.json")).rewrites;
  assert.deepEqual(rewrites, [{ source: "/api/protokoll-link", destination: "/api/protokoll-hochladen" }]);
  const apiDir = new URL("../api/", import.meta.url);
  assert.equal(readdirSync(apiDir).filter((name) => name.endsWith(".js")).length, 12);
});

test("PDF bleibt privat, Link erfordert PIN und Freigabe", () => {
  assert.match(sql, /'sr-protokolle', 'sr-protokolle', false/);
  assert.match(sql, /protokoll_freigegeben and t\.protokoll_pdf_pfad is not null/);
  assert.match(sql, /public\.schiri_pin_pruefen\(p_schiedsrichter_id, p_pin\)/);
  assert.match(sql, /protokoll_freigegeben = false/);
  assert.match(sql, /grant execute on function public\.termin_protokoll_pdf_fuer_schiri\(uuid,text,uuid\)\s+to service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.termin_protokoll_pdf_fuer_schiri\(uuid,text,uuid\)\s+to (anon|authenticated)/);
  assert.match(terminSeite, /protokollPdfLink/);
  assert.match(terminSeite, /data-pdf-download/);
  assert.match(terminSeite, /<iframe title="Vorschau des Terminprotokolls"/);
});
