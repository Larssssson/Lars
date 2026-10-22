// Erzeugt die App-Icons für Manifest und iOS (public/icons, app/apple-icon.png) aus einer SVG-Vorlage.
// Platzhalter bis RP Logo und Farbwert liefert (BRIEFING 16). Aufruf: node scripts/pwa-icons.mjs
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";

const svg = (size, maskable) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${maskable ? 0 : 22}" fill="#0B2540"/>
  <circle cx="50" cy="29" r="7" fill="#5BB5E5"/>
  <rect x="43" y="41" width="14" height="36" rx="3" fill="#ffffff"/>
</svg>`;

const targets = [
  ["public/icons/icon-192.png", 192, false],
  ["public/icons/icon-512.png", 512, false],
  ["public/icons/icon-maskable-512.png", 512, true],
  ["public/icons/badge-96.png", 96, false],
  ["app/apple-icon.png", 180, true],
  ["app/icon.png", 64, false],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, maskable] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(size, maskable)}</body></html>`);
  await writeFile(file, await page.locator("svg").screenshot({ omitBackground: true }));
}
await browser.close();
console.log(`${targets.length} Icons geschrieben`);
