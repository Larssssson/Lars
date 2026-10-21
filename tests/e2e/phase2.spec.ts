import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { buildFilledContent, type FormatBlock } from "../../lib/domain/documents/template";
import { buildDocx } from "../../lib/domain/documents/word-export";
import type { JSONNode } from "../../lib/editor/content";
import { seedFormats } from "../../prisma/seed-data";
import { loginAs, selectClient } from "./helpers";

test.describe.configure({ mode: "serial" });
const TITLE = "E2E PM Werkseröffnung";

async function logout(page: Page, name: string) {
  await page.locator("summary", { hasText: name }).click();
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function typeInto(page: Page, block: string, text: string) {
  await page.locator(`[data-block="${block}"] p`).first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(text);
}

async function waitSaved(page: Page) {
  await expect(page.getByTestId("save-state")).toHaveText(/Gespeichert/, { timeout: 15_000 });
}

async function openTask(page: Page, title: string) {
  await page.goto("/redaktion?status=ALLE");
  await page.getByRole("link", { name: title }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
}

test("Redaktionsablauf: schreiben, Freigabe mit Änderungsverfolgung, Kunde, Rückläufer, zweite Freigabe, Medien, Ablage", async ({ page }) => {
  test.setTimeout(180_000);
  page.on("dialog", (dialog) => dialog.accept());

  // 1. Redakteurin legt eine PM an und schreibt
  await loginAs(page, "Laura");
  await selectClient(page, "Covenant");
  await page.goto("/aufgaben/neu");
  await page.getByLabel("Kategorie").selectOption({ label: "Medienarbeit" });
  await page.getByLabel("Darstellungsform").selectOption({ label: "Pressemitteilung" });
  await page.getByLabel("Titel").fill(TITLE);
  await page.getByRole("button", { name: "Aufgabe anlegen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(TITLE);
  await expect(page.locator(".template-block-label").getByText("Ortsmarke und Datum")).toBeVisible();
  await typeInto(page, "headline", "Covenant eröffnet Werk in Leipzig");
  await typeInto(page, "lead", "Covenant hat heute sein Werk eröffnet.");
  await waitSaved(page);
  await expect(page.getByTestId("counter")).toContainText("Zeichen");

  // 2. Freigabe anfragen (ohne Prüfung, mit Rückfrage)
  await expect(page.getByText("Status: In Bearbeitung")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Anfrage senden" }).click();
  await expect(page.getByText("Status: Freigabe angefragt")).toBeVisible();
  await logout(page, "Laura");

  // 3. CVD übernimmt die Prüfung, ändert mit Änderungsverfolgung und gibt frei
  await loginAs(page, "Lukas");
  await expect(page.getByRole("link", { name: new RegExp(TITLE) })).toBeVisible();
  await page.getByRole("link", { name: new RegExp(TITLE) }).first().click();
  await expect(page.getByText("Du prüfst diesen Text.")).toBeVisible();
  await expect(page.getByText("Änderungsverfolgung ist an, weil du nicht der Owner bist.")).toBeVisible();
  await typeInto(page, "lead", " Rund 450 Menschen arbeiten dort.");
  await expect(page.locator('[data-block="lead"] .change-insertion')).toHaveText(" Rund 450 Menschen arbeiten dort.");
  await waitSaved(page);
  await page.getByRole("tab", { name: /Änderungen/ }).click();
  await expect(page.getByTestId("changes")).toContainText("Lukas");
  await page.getByRole("button", { name: "Freigeben", exact: true }).click();
  await expect(page.getByText("Status: Freigegeben")).toBeVisible();
  await logout(page, "Lukas");

  // 4. Redakteurin versendet an den Kunden zur Abstimmung, lädt Word herunter
  await loginAs(page, "Laura");
  await openTask(page, TITLE);
  await expect(page.getByText("Der Text ist freigegeben und gesperrt.")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Word herunterladen" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/_Covenant_Pressemitteilung_E2E_PM_Werkseroeffnung_v\d+\.docx$/);
  const exported = await readFile((await download.path())!);
  expect(exported.subarray(0, 2).toString()).toBe("PK");
  await page.getByLabel("Empfänger").fill("Kommunikation Covenant");
  await page.getByLabel("Kanal").fill("Mail");
  await page.getByRole("button", { name: "Versendet" }).click();
  await expect(page.getByText("Status: Beim Kunden")).toBeVisible();

  // 5. Rückläufer vom Kunden: Word-Datei mit Änderung hochladen
  const blocks = seedFormats.find((f) => f.key === "PRESSEMITTEILUNG")!.blocks as FormatBlock[];
  const revised = await buildDocx({
    content: buildFilledContent(blocks, {
      headline: "Covenant eröffnet Werk in Leipzig",
      lead: "Covenant hat heute sein Werk eröffnet. Rund 450 Menschen arbeiten dort, Tendenz steigend.",
    }) as JSONNode,
    format: "PRESSEMITTEILUNG",
    title: TITLE,
    template: { logo: null, color: "000000", font: "Arial" },
  });
  await page.getByLabel("Word-Datei (.docx)").setInputFiles({
    name: "Covenant_Rueckmeldung.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from(revised),
  });
  await page.getByRole("button", { name: "Rückläufer hochladen" }).click();
  await expect(page.getByText("Status: In Bearbeitung")).toBeVisible();
  await expect(page.locator('[data-block="lead"]')).toContainText("Tendenz steigend");
  await expect(page.getByTestId("versions")).toContainText("Word-Import");

  // 6. zweite Freigabe
  await page.getByRole("button", { name: "Anfrage senden" }).click();
  await expect(page.getByText("Status: Freigabe angefragt")).toBeVisible();
  await logout(page, "Laura");
  await loginAs(page, "Lars Scholtyssyk");
  await openTask(page, TITLE);
  await expect(page.getByText("Du prüfst diesen Text.")).toBeVisible();
  await page.getByRole("button", { name: "Freigeben", exact: true }).click();
  await expect(page.getByText("Status: Freigegeben")).toBeVisible();
  await logout(page, "Lars Scholtyssyk");

  // 7. Versand an Medien, Ablage im SharePoint-Ersatz
  await loginAs(page, "Laura");
  await openTask(page, TITLE);
  await page.getByLabel("An Medien").check();
  await page.getByLabel("Empfänger").fill("Verteiler Leitmedien");
  await page.getByLabel("Kanal").fill("Mail");
  await page.getByRole("button", { name: "Versendet" }).click();
  await expect(page.getByText("Status: Erledigt")).toBeVisible();
  const shown = await page.getByTestId("sharepoint-path").textContent();
  expect(shown).toMatch(/^Covenant\/02_Pressemitteilungen\/\d{4}\/\d{4}-\d{2}-\d{2}_Covenant_Pressemitteilung_E2E_PM_Werkseroeffnung_v\d+\.docx$/);
  const folder = path.join("storage/e2e/sharepoint-mock/impress/Kunden", path.dirname(shown!));
  expect(await readdir(folder)).toContain(path.basename(shown!));
  await expect(page.getByTestId("history")).toContainText("An Medien");
});

test("Sperre, Mitlesen, Kommentare und Versionsvergleich", async ({ browser }) => {
  test.setTimeout(120_000);
  const laura = await (await browser.newContext()).newPage();
  const lukas = await (await browser.newContext()).newPage();
  laura.on("dialog", (d) => d.accept());

  await loginAs(laura, "Laura");
  // eigenes neues Statement, damit der Test unabhängig ist
  await selectClient(laura, "Covenant");
  await laura.goto("/aufgaben/neu");
  await laura.getByLabel("Kategorie").selectOption({ label: "Medienarbeit" });
  await laura.getByLabel("Darstellungsform").selectOption({ label: "Statement" });
  await laura.getByLabel("Titel").fill("E2E Statement Sperre");
  await laura.getByRole("button", { name: "Aufgabe anlegen" }).click();
  await typeInto(laura, "text", "Erste Fassung des Statements.");
  await waitSaved(laura);

  // Lukas liest mit, sieht die Sperre und fordert die Bearbeitung an
  await loginAs(lukas, "Lukas");
  await openTask(lukas, "E2E Statement Sperre");
  await expect(lukas.getByTestId("lock-holder")).toHaveText("Laura bearbeitet gerade. Du liest mit.");
  await lukas.getByRole("button", { name: "Bearbeitung anfordern" }).click();
  await expect(laura.getByText("Lukas möchte den Text bearbeiten.")).toBeVisible({ timeout: 15_000 });

  // Mitlesen: Lauras Änderung erscheint bei Lukas
  await typeInto(laura, "text", " Zweiter Satz.");
  await waitSaved(laura);
  await expect(lukas.locator('[data-block="text"]')).toContainText("Zweiter Satz.", { timeout: 15_000 });

  // Kommentar zum ganzen Text mit Erwähnung, Antwort, erledigt
  await lukas.getByLabel("Kommentar zum ganzen Text").fill("Bitte kürzer, @Laura");
  await lukas.getByRole("button", { name: "Kommentieren", exact: true }).click();
  await expect(lukas.getByTestId("comment-threads")).toContainText("Bitte kürzer");
  await laura.reload();
  await expect(laura.getByTestId("comment-threads")).toContainText("Bitte kürzer");
  await laura.getByLabel("Antworten").fill("Mache ich");
  await laura.getByRole("button", { name: "Antworten" }).click();
  await expect(laura.getByTestId("comment-threads")).toContainText("Mache ich");
  await laura.getByRole("button", { name: "Erledigt" }).click();
  await expect(laura.getByText("Noch keine Kommentare.")).toBeVisible();

  // Kommentar an einer markierten Stelle
  await laura.locator('[data-block="text"] p').first().click();
  await laura.keyboard.press("Home");
  await laura.keyboard.press("Shift+End");
  await laura.getByRole("button", { name: "Stelle kommentieren" }).click();
  await laura.getByLabel("Kommentar zur markierten Stelle").fill("Wort prüfen");
  await laura.getByRole("button", { name: "Kommentieren", exact: true }).click();
  await expect(laura.locator(".comment-anchor")).toHaveCount(1);

  // Version speichern und vergleichen
  await laura.getByRole("button", { name: "Version speichern" }).click();
  await expect(laura.getByTestId("versions")).toContainText("manuell");
  await laura.getByRole("link", { name: "Vergleichen" }).first().click();
  await expect(laura.getByRole("heading", { level: 1 })).toContainText("Versionen vergleichen");
  await expect(laura.getByTestId("compare")).toBeVisible();
});

test("Projekte: Roundtable mit Aufgabenvorschlägen anlegen und abschließen", async ({ page }) => {
  await loginAs(page, "Lukas");
  await selectClient(page, "Covenant");
  await page.goto("/redaktion?ansicht=projekte");
  await expect(page.getByTestId("projects")).toContainText("Roundtable Herbst");
  await page.getByText("Neues Projekt").click();
  await page.getByLabel("Titel", { exact: true }).fill("E2E Roundtable Winter");
  await page.getByLabel("Vereinbarte Leistung").selectOption({ label: "Journalisten-Roundtable" });
  await page.getByLabel("Pitch").uncheck();
  await page.getByRole("button", { name: "Projekt anlegen" }).click();
  const card = page.getByTestId("projects").locator("li", { hasText: "E2E Roundtable Winter" }).first();
  await expect(card).toContainText("E2E Roundtable Winter: Konzept");
  await expect(card).toContainText("E2E Roundtable Winter: Q&A");
  await expect(card).not.toContainText("Pitch");
  await card.getByRole("button", { name: "Starten" }).click();
  await expect(card).toContainText("Laufend");
  await card.getByRole("button", { name: "Abschließen" }).click();
  await expect(card).toContainText("Abgeschlossen");
});
