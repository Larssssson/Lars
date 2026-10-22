// Rendert die SVG-Platzhalterlogos aus fixtures/ als PNG (für den Word-Export). Einmalig: node scripts/render-logos.mjs
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const files = [
  "fixtures/templates/rp_logo_placeholder.svg",
  "fixtures/clients/covenant/logo_placeholder.svg",
  "fixtures/clients/ground-a/logo_placeholder.svg",
  "fixtures/clients/rafael/logo_placeholder.svg",
];
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
for (const file of files) {
  const svg = await readFile(file, "utf8");
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.locator("svg").screenshot({ path: file.replace(/\.svg$/, ".png"), omitBackground: true });
}
await browser.close();
