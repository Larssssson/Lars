import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { loginAs, selectClient } from "./helpers";

test.describe.configure({ mode: "serial" });

async function logout(page: Page, name: string) {
  await page.locator("summary", { hasText: name }).click();
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/login$/);
}

async function openContact(page: Page, name: string) {
  await page.goto("/journo-hub");
  await page.getByRole("link", { name, exact: true }).click();
  await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
}

test("Liste mit Filtern, verdeckte Kontaktdaten, Anfrage, Freigabe, Aufdecken", async ({ page }) => {
  test.setTimeout(120_000);
  await loginAs(page, "Laura");
  await page.goto("/journo-hub");
  await expect(page.getByTestId("contacts")).toContainText("Jana Hofmann");
  await expect(page.getByTestId("contacts")).not.toContainText("example.org");
  await page.getByLabel("Status").selectOption({ label: "Verifiziert RP" });
  await page.getByRole("button", { name: "Filtern" }).click();
  await expect(page.getByTestId("contact-count")).toHaveText("3 Kontakte");

  await openContact(page, "Jana Hofmann");
  await expect(page.getByTestId("detail-TELEFON")).toHaveText(/01$/);
  await expect(page.getByTestId("contact-details").getByRole("button", { name: "Aufdecken" })).toHaveCount(0);
  await expect(page.getByTestId("articles").getByRole("listitem")).toHaveCount(3);
  await page.getByLabel("Kunde", { exact: true }).selectOption({ label: "Covenant" });
  await page.getByLabel("Anliegen").fill("Interview zum Standort");
  await page.getByRole("button", { name: "Anfrage senden" }).click();
  await expect(page.getByText("Anfrage gesendet.")).toBeVisible();
  await logout(page, "Laura");

  await loginAs(page, "Lukas");
  await page.goto("/benachrichtigungen");
  await expect(page.getByText(/Kontaktanfrage für Covenant/).first()).toBeVisible();
  await page.goto("/journo-hub/anfragen");
  const toMe = page.getByTestId("requests-to-me");
  await expect(toMe).toContainText("Interview zum Standort");
  await toMe.getByRole("button", { name: "Freigeben" }).click();
  await expect(toMe).toContainText("freigegeben");
  await logout(page, "Lukas");

  await loginAs(page, "Laura");
  await selectClient(page, "Covenant");
  await openContact(page, "Jana Hofmann");
  await page.getByTestId("contact-details").getByRole("button", { name: "Aufdecken" }).first().click();
  await expect(page.getByTestId("contact-details")).toContainText(/\+49305550101|jana\.hofmann@example\.org/);
  await expect(page.getByRole("button", { name: "Als Owner eintragen" })).toBeVisible();
});

test("Wer kennt jemanden bei diesem Medium, Verifizieren mit Pflichtangaben", async ({ page }) => {
  await loginAs(page, "Robin");
  await openContact(page, "Tim Neumann");
  await expect(page.getByTestId("who-knows")).toContainText("Miriam Krause");
  await expect(page.getByTestId("who-knows")).toContainText("Juliana");

  await openContact(page, "Stefan Lorenz");
  await expect(page.getByTestId("verify-missing")).toHaveText("Zum Verifizieren fehlt: Datum des ersten Kontakts.");
  await expect(page.getByRole("button", { name: "Verifizieren" })).toBeDisabled();
  await page.getByText("Bearbeiten", { exact: true }).click();
  await page.getByLabel("Datum des ersten Kontakts").fill("2026-09-01");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Gespeichert.")).toBeVisible();
  await page.getByRole("button", { name: "Verifizieren" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Stefan Lorenz" }).locator("xpath=..").getByText("Verifiziert RP")).toBeVisible();
  await expect(page.getByTestId("owners")).toContainText("Robin");
  await expect(page.getByTestId("contact-history")).toContainText("verifiziert von Robin");
});

test("Import CSV mit Zuordnung, Dubletten und Vorschau", async ({ page }) => {
  test.setTimeout(90_000);
  await loginAs(page, "Mika");
  await page.goto("/journo-hub/import");
  await page.getByLabel("Datei (CSV, XLSX oder vCard)").setInputFiles(path.resolve("fixtures/contacts/kontakte_sample.csv"));
  await page.getByRole("button", { name: "Hochladen" }).click();
  await expect(page.getByLabel("E-Mail", { exact: true })).toHaveValue("email");
  await page.getByRole("button", { name: "Weiter zur Vorschau" }).click();
  const preview = page.getByTestId("import-preview");
  await expect(preview).toContainText("Dublette zu Jana Hofmann (gleiche Mailadresse)");
  await expect(preview).toContainText("Dublette zu Peter Albrecht (gleiche Telefonnummer)");
  await expect(preview).toContainText("Dublette zu Stefan Lorenz (gleicher Name und Medium)");
  await expect(preview).toContainText("keine Mailadresse");
  await page.getByLabel("Zuordnung speichern als (optional)").fill("Kontakte Semikolon");
  await page.getByRole("button", { name: "Übernehmen" }).click();
  await expect(page.getByText("Übernommen: 22 neu, 3 zusammengeführt, 0 übersprungen.")).toBeVisible();
  await page.goto("/journo-hub?status=IMPORT");
  await expect(page.getByTestId("contacts")).toContainText("Karl Fischer");
});

test("Reiter Journalisten im Editor, Vormerken und Empfängervorschlag beim Versand", async ({ page }) => {
  test.setTimeout(90_000);
  await loginAs(page, "Hannah");
  await page.goto("/redaktion?status=ALLE");
  await page.getByRole("link", { name: "Pitch Luftverteidigung" }).click();
  await page.getByRole("tab", { name: "Journalisten" }).click();
  const panel = page.getByTestId("journalist-suggestions");
  const ole = panel.getByRole("listitem").filter({ hasText: "Ole Brandt" });
  await expect(ole).toContainText("Zielmedium des Kunden");
  await expect(ole).toContainText("Owner: Robin");
  await ole.getByRole("button", { name: "Vormerken" }).click();
  await expect(ole.getByRole("button", { name: "Vorgemerkt" })).toBeVisible();
  await page.getByLabel("An Medien").check();
  await page.getByTestId("recipient-suggestions").getByRole("button", { name: "+ Ole Brandt (Wehrtechnik Aktuell)" }).click();
  await expect(page.getByLabel("Empfänger")).toHaveValue("Ole Brandt (Wehrtechnik Aktuell)");
});

test("CVD: Pflege, Auskunft, Löschen, Offboarding", async ({ page }) => {
  test.setTimeout(120_000);
  page.on("dialog", (dialog) => dialog.accept());
  await loginAs(page, "Lars Scholtyssyk");
  await page.goto("/journo-hub/pflege");
  await expect(page.getByRole("heading", { name: "Mögliche Dubletten" })).toBeVisible();

  await openContact(page, "Lea Schubert");
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Auskunft als JSON" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("Auskunft_Schubert_Lea.json");
  await page.getByRole("button", { name: "Kontakt endgültig löschen" }).click();
  await expect(page).toHaveURL(/\/journo-hub$/);
  await expect(page.getByTestId("contacts")).not.toContainText("Lea Schubert");

  await page.goto("/verwaltung/nutzer");
  await page.getByRole("link", { name: "Juliana", exact: true }).click();
  await page.getByRole("link", { name: "Offboarding starten" }).click();
  await page.getByRole("button", { name: "Offboarding abschließen" }).click();
  await expect(page.getByText(/offene Aufgabe/)).toBeVisible();
  const tasks = page.getByTestId("offboarding-tasks");
  const open = await tasks.getByRole("listitem").count();
  for (let i = open; i > 0; i--) {
    const item = tasks.getByRole("listitem").first();
    await item.getByRole("combobox").selectOption({ label: "Robin" });
    await item.getByRole("button", { name: "Übertragen" }).click();
    if (i > 1) await expect(tasks.getByRole("listitem")).toHaveCount(i - 1);
  }
  await expect(page.getByText("Keine offenen Aufgaben.")).toBeVisible();
  const contacts = page.getByTestId("offboarding-contacts");
  await contacts.getByRole("listitem").first().getByRole("button", { name: "Als inaktiven Owner stehen lassen" }).click();
  await expect(page.getByText("Keine Kontakte.")).toBeVisible();
  await page.getByRole("button", { name: "Offboarding abschließen" }).click();
  await expect(page.getByText("Offboarding abgeschlossen. Der Zugang ist gesperrt.")).toBeVisible();
  await openContact(page, "Miriam Krause");
  await expect(page.getByTestId("owners")).toContainText("Juliana");
  await expect(page.getByTestId("owners")).toContainText("inaktiv");
});
