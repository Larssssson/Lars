// Rendert die erfundenen SAFENET-Unterlagen (BRIEFING 13.1) als PDF. Einmalig: node scripts/render-safenet-pdfs.mjs
import { chromium } from "playwright";

const style = `body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.5;margin:0}h1{font-size:18pt;margin:0 0 4pt}h2{font-size:12pt;margin:16pt 0 4pt}p.note{color:#666;font-size:9pt}`;
const docs = {
  "fixtures/clients/safenet/unternehmensbeschreibung.pdf": `
    <h1>SAFENET: Unternehmensbeschreibung</h1>
    <p class="note">[Beispiel] Erfundene Unterlage für Tests. Personen, Zahlen und Aussagen gibt es nicht.</p>
    <h2>Wer wir sind</h2>
    <p>[Beispiel] SAFENET schützt kritische Infrastruktur in Deutschland. Das Unternehmen entwickelt Netzwerksicherheit für Energieversorger, Wasserwerke und Krankenhäuser.</p>
    <p>[Beispiel] Sicherheit entsteht durch geprüfte Technik aus Europa. Alle Produkte werden in Deutschland entwickelt und von unabhängigen Stellen geprüft.</p>
    <h2>Themen</h2>
    <p>[Beispiel] Netzwerksicherheit, Kritische Infrastruktur, Schutz vor Angriffen auf Steuerungsanlagen.</p>
    <h2>Führung</h2>
    <p>[Beispiel] Dr. Mara Lindner, Geschäftsführerin. Sie spricht für SAFENET zu IT-Sicherheit und Kritischer Infrastruktur.</p>
    <h2>Kennzahlen</h2>
    <p>[Beispiel] 120 Mitarbeitende (Stand 2026), Sitz in Berlin.</p>`,
  "fixtures/clients/safenet/styleguide.pdf": `
    <h1>SAFENET: Styleguide</h1>
    <p class="note">[Beispiel] Erfundene Unterlage für Tests.</p>
    <h2>1. Firmenname</h2>
    <p>SAFENET wird immer in Großbuchstaben geschrieben, auch im Fließtext.</p>
    <h2>2. Ansprache</h2>
    <p>[Beispiel] Sachlich und ruhig. Keine Angstbotschaften.</p>
    <h2>3. Sprache</h2>
    <p>[Beispiel] Keine Anglizismen, wo es ein deutsches Wort gibt.</p>`,
};
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, body] of Object.entries(docs)) {
  await page.setContent(`<html lang="de"><head><meta charset="utf-8"><style>${style}</style></head><body>${body}</body></html>`);
  await page.pdf({ path: file, format: "A4", margin: { top: "20mm", bottom: "20mm", left: "20mm", right: "20mm" } });
}
await browser.close();
