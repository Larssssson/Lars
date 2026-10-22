import { chromium } from "playwright";

/**
 * HTML mit Chromium (Playwright) als PDF rendern (BRIEFING 10.1).
 * PLAYWRIGHT_CHROMIUM_PATH erlaubt einen vorinstallierten Browser im Betrieb.
 */
export async function renderPdf(html: string): Promise<Uint8Array> {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    return new Uint8Array(await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true }));
  } finally {
    await browser.close();
  }
}
