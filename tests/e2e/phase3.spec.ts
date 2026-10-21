import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { loginAs, selectClient } from "./helpers";

test.describe.configure({ mode: "serial" });

async function waitSaved(page: Page) {
  await expect(page.getByTestId("save-state")).toHaveText(/Gespeichert/, { timeout: 15_000 });
}

async function newDocument(page: Page, client: string, format: string, title: string) {
  await selectClient(page, client);
  await page.goto("/aufgaben/neu");
  await page.getByLabel("Kunde", { exact: true }).selectOption({ label: client });
  await page.getByLabel("Kategorie").selectOption({ label: "Medienarbeit" });
  await page.getByLabel("Darstellungsform").selectOption({ label: format });
  await page.getByLabel("Titel").fill(title);
  await page.getByRole("button", { name: "Aufgabe anlegen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title, { timeout: 20_000 });
  await expect(page.getByTestId("save-state")).toHaveText(/Gespeichert|^$/, { timeout: 15_000 });
}

async function openClient(page: Page, name: string, sub = "") {
  await page.goto("/kunden");
  await page.getByRole("link", { name, exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  if (sub) await page.goto(`${page.url()}/${sub}`);
}

test("Schreiben mit Live-Hinweisen, Prüfung, KI-Baustein, Kundenwissen und Sperre der Freigabeanfrage", async ({ page }) => {
  test.setTimeout(150_000);
  page.on("dialog", (dialog) => dialog.accept());
  await loginAs(page, "Laura");
  await newDocument(page, "Covenant", "Pressemitteilung", "E2E PM Ausbildung");

  // Live-Hinweise ohne KI (BRIEFING 7.4)
  await expect(page.getByTestId("live-hints")).toContainText("Ortsmarke und Datum fehlt");
  await page.locator('[data-block="ortsmarke"] p').click();
  await page.keyboard.type("Leipzig, 21. Oktober 2026");
  await expect(page.getByTestId("live-hints")).not.toContainText("Ortsmarke und Datum fehlt");
  await page.locator('[data-block="lead"] p').click();
  await page.keyboard.type("Covenant startet heute in Leipzig ein Ausbildungsprogramm. ");
  await waitSaved(page);

  // Kundenwissen: Fakt an der Cursorposition einfügen, ohne KI-Markierung
  await page.getByRole("tab", { name: "Kundenwissen" }).click();
  await expect(page.getByTestId("knowledge-panel")).toContainText("[Beispiel] Dr. Anna Weber");
  await page.getByTestId("facts").getByRole("button", { name: "Einfügen" }).first().click();
  await expect(page.locator('[data-block="lead"]')).toContainText("450 Arbeitsplätze am Standort Leipzig");
  await expect(page.locator('[data-block="lead"] .ai-insertion')).toHaveCount(0);

  // KI-Baustein: eine von drei Headlines wählen, erst dann einfügen (BRIEFING 8.2)
  await page.getByRole("button", { name: "Headline-Vorschläge" }).click();
  await expect(page.getByRole("radio")).toHaveCount(3);
  await page.getByRole("radio").nth(2).check();
  await page.getByRole("button", { name: "KI-Baustein einfügen" }).click();
  const block = page.locator('[data-block="headline"] .ai-insertion');
  await expect(block).toHaveText("[Beispiel] Covenant entscheidet sich für Sachsen");
  await expect(page.getByTestId("ai-blocks")).toContainText("1 KI-Baustein ist noch nicht übernommen.");
  await waitSaved(page);

  // offene Bausteine sperren die Freigabeanfrage
  await page.reload();
  await expect(page.locator('[data-block="headline"] .ai-insertion')).toBeVisible();
  await page.getByRole("button", { name: "Anfrage senden" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "nicht angenommene KI-Bausteine" })).toBeVisible();

  // Prüfung: Schnellprüfung mit Werten und Hinweisen nach Prüfschritt
  await page.getByRole("tab", { name: /Prüfung/ }).click();
  await page.getByRole("button", { name: "Prüfung starten" }).click();
  await expect(page.getByTestId("check-scores")).toContainText("Konformität");
  await expect(page.getByTestId("check-panel")).toContainText("Struktur und Vollständigkeit");
  await expect(page.getByTestId("check-panel")).toContainText("Haupttext fehlt");

  // Übernehmen: Markierung weg, Anfrage möglich, im Verlauf nachvollziehbar
  await page.getByTestId("ai-blocks").getByRole("button", { name: "Übernehmen" }).click();
  await expect(page.locator('[data-block="headline"] .ai-insertion')).toHaveCount(0);
  await expect(page.locator('[data-block="headline"]')).toContainText("Covenant entscheidet sich für Sachsen");
  await expect(page.getByTestId("history")).toContainText("KI-Baustein (Headline) übernommen von Laura");
  await page.getByRole("button", { name: "Anfrage senden" }).click();
  await expect(page.getByText("Status: Freigabe angefragt")).toBeVisible();
  await expect(page.getByText(/geprüft, \d+ Hinweise? offen/)).toBeVisible();
});

test("Vollanalyse der PM Standortentscheidung: Fundstelle, Verwerfungsregel im Kundenprofil", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAs(page, "Lukas");
  await page.goto("/redaktion?status=ALLE");
  await page.getByRole("link", { name: "PM Standortentscheidung" }).click();
  await page.getByRole("tab", { name: /Prüfung/ }).click();
  await page.getByRole("radio", { name: "Vollanalyse" }).click();
  await page.getByRole("button", { name: "Prüfung starten" }).click();
  await expect(page.getByTestId("check-scores")).toContainText("66");
  const panel = page.getByTestId("check-panel");
  for (const step of ["Compliance", "Faktentreue", "Styleguide und Schreibweisen", "Tone of Voice", "Medienresonanz", "Mögliche Erweiterungen", "Distribution"]) {
    await expect(panel.getByRole("heading", { name: step })).toBeVisible();
  }
  await expect(panel).toContainText("betrifft den ganzen Text");
  const finding = panel.getByRole("listitem").filter({ hasText: "widerspricht dem Factsheet" });
  await expect(finding).toContainText("kritisch");
  await finding.getByRole("button", { name: "„600 neue Arbeitsplätze“" }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toBe("600 neue Arbeitsplätze");

  const style = panel.getByRole("listitem").filter({ hasText: "vollen Firmennamen" });
  await style.getByRole("button", { name: "Verwerfen" }).click();
  await style.getByLabel("Grund (optional)").fill("Kurzform ist abgestimmt");
  await style.getByLabel("Für diesen Kunden nicht mehr anzeigen").check();
  await style.getByRole("button", { name: "Verwerfen" }).last().click();
  await expect(panel).not.toContainText("vollen Firmennamen");

  await openClient(page, "Covenant", "profil");
  await expect(page.getByTestId("dismissal-rules")).toContainText("bei der ersten nennung den vollen firmennamen verwenden");
});

test("Kundenprofil: bestätigt am, Warnungen, Vorschläge von Redakteuren", async ({ page }) => {
  await loginAs(page, "Laura");
  await openClient(page, "Ground A", "profil");
  await expect(page.getByTestId("section-compliance").getByTestId("confirmed")).toContainText("Compliance-Regeln sind 13 Monate alt");
  await expect(page.getByTestId("section-factsheet")).toContainText("[Beispiel] 14 Patente");
  // Redakteure bearbeiten nicht, sie schlagen vor
  const themen = page.getByTestId("section-themen_suchbegriffe");
  await expect(themen.getByText("Bearbeiten")).toHaveCount(0);
  await themen.getByText("Änderung vorschlagen").click();
  await themen.getByLabel("Vorschlag").fill("Photonik");
  await themen.getByRole("button", { name: "Vorschlag senden" }).click();
  await expect(themen.getByText("Vorschlag gespeichert.")).toBeVisible();
  await expect(page.getByTestId("suggestions-themen_suchbegriffe")).toContainText("Photonik");
});

test("Onboarding SAFENET: Unterlage, KI-Vorschläge, Fragen, Aktivierung erst mit Pflichtabschnitten", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAs(page, "Valentin Abel");
  await openClient(page, "SAFENET");
  await page.getByRole("link", { name: "Onboarding fortsetzen" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Onboarding");
  await page.getByLabel("Datei (PDF, Word oder Text)").setInputFiles(path.resolve("fixtures/clients/safenet/unternehmensbeschreibung.pdf"));
  await page.getByRole("button", { name: "Unterlage hochladen" }).click();
  await expect(page.getByText("Hochgeladen. 9 Vorschläge liegen bereit.")).toBeVisible();
  await expect(page.getByTestId("suggestions")).toContainText("[Beispiel] Dr. Mara Lindner");

  // Schritt Sprecher: Vorschlag annehmen
  await page.getByRole("link", { name: /Sprecher/ }).first().click();
  await expect(page).toHaveURL(/schritt=sprecher/);
  const speakers = page.getByTestId("suggestions-sprecher");
  await speakers.getByRole("button", { name: "Annehmen" }).click();
  await expect(page.getByTestId("speakers")).toContainText("[Beispiel] Dr. Mara Lindner");

  // Fragen zu Lücken, Antwort landet im Abschnitt
  await page.getByRole("button", { name: "Fragen erzeugen" }).click();
  await expect(page.getByTestId("questions")).toContainText("Gibt es Themen, zu denen der Kunde sich nicht äußert?");
  await page.getByTestId("questions").getByRole("link", { name: /nicht äußert/ }).click();
  await expect(page).toHaveURL(/schritt=tabuthemen/);
  await expect(page.getByRole("heading", { level: 2, name: "Tabuthemen" })).toBeVisible();
  await page.getByTestId("step-questions").getByLabel("Gibt es Themen, zu denen der Kunde sich nicht äußert?").fill("Keine Aussagen zu einzelnen Kunden");
  await page.getByRole("button", { name: "Antwort übernehmen" }).click();
  await expect(page.getByTestId("section-tabuthemen")).toContainText("Keine Aussagen zu einzelnen Kunden");

  // unterbrechbar: beim nächsten Öffnen geht es beim letzten Schritt weiter
  await page.goto(page.url().split("?")[0]!);
  await expect(page.getByTestId("section-tabuthemen")).toBeVisible();
  await expect(page.getByTestId("activation")).toContainText("Fehlt noch für den Status Aktiv");
});

test("CVD kann SAFENET nicht aktivieren, solange Pflichtabschnitte fehlen; KI aus sperrt KI-Funktionen", async ({ page }) => {
  test.setTimeout(120_000);
  page.on("dialog", (dialog) => dialog.accept());
  await loginAs(page, "Lars Scholtyssyk");
  await openClient(page, "SAFENET");
  await page.getByRole("button", { name: "Auf Aktiv setzen" }).click();
  await expect(page.getByText(/Für den Status Aktiv fehlen noch: Stammdaten/)).toBeVisible();

  // KI erlaubt aus für Rafael: kein KI-Menü, Prüfung nur regelbasiert
  await openClient(page, "Rafael");
  await page.getByLabel("KI erlaubt").uncheck();
  await page.getByRole("button", { name: "Stammdaten speichern" }).click();
  await expect(page.getByText("Gespeichert.")).toBeVisible();
  await newDocument(page, "Rafael", "Statement", "E2E Statement ohne KI");
  await expect(page.getByTestId("ai-menu")).toHaveCount(0);
  await page.getByRole("tab", { name: /Prüfung/ }).click();
  await expect(page.getByTestId("check-panel")).toContainText("KI ist für diesen Kunden ausgeschaltet");
  await page.getByRole("button", { name: "Prüfung starten" }).click();
  await expect(page.getByTestId("check-panel")).toContainText("Sprecher fehlt");
});
