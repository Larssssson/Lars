import { expect, test } from "@playwright/test";
import { loginAs, nav, selectClient } from "./helpers";

test.describe.configure({ mode: "serial" });

test("Redakteurin legt eine einfache Aufgabe an und erledigt sie", async ({ page }) => {
  await loginAs(page, "Laura");
  await selectClient(page, "Covenant");
  await page.getByRole("link", { name: "Neue Aufgabe" }).first().click();
  await expect(page.getByLabel("Kunde", { exact: true })).toHaveValue(/.+/);
  await page.getByLabel("Kategorie").selectOption({ label: "Medienarbeit" });
  await page.getByLabel("Einfache Aufgabe").check();
  await page.getByLabel("Titel").fill("E2E Rückruf Tagesblatt");
  // Owner: Redakteurin darf nur sich selbst wählen
  await expect(page.getByLabel("Owner")).toBeDisabled();
  await expect(page.getByRole("button", { name: "in 3 Werktagen" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Aufgabe anlegen" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E Rückruf Tagesblatt");
  await expect(page.getByText("Offen", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Beginnen" }).click();
  await expect(page.getByText("In Bearbeitung", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Erledigt" }).click();
  await expect(page.getByRole("button", { name: "Wieder öffnen" })).toBeVisible();
  // Redakteure stufen nicht hoch
  await expect(page.getByRole("button", { name: "Als dringend markieren" })).toHaveCount(0);
});

test("CVD legt eine Dokument-Aufgabe für eine Redakteurin an, sie sieht sie in der Glocke", async ({ page }) => {
  await loginAs(page, "Lars Scholtyssyk");
  await page.goto("/aufgaben/neu");
  await page.getByLabel("Kunde", { exact: true }).selectOption({ label: "Ground A" });
  await expect(page).toHaveURL(/kunde=/);
  await page.getByLabel("Kategorie").selectOption({ label: "Medienarbeit" });
  await page.getByLabel("Darstellungsform").selectOption({ label: "Pressemitteilung" });
  await page.getByLabel("Titel").fill("E2E PM Messeauftritt");
  await page.getByLabel("Owner").selectOption({ label: "Mika" });
  await page.getByRole("button", { name: "Aufgabe anlegen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E PM Messeauftritt");
  await expect(page.locator(".template-block-label").getByText("Ortsmarke und Datum")).toBeVisible();

  await page.locator("summary", { hasText: "Lars Scholtyssyk" }).click();
  await page.getByRole("button", { name: "Abmelden" }).click();
  await loginAs(page, "Mika");
  await expect(page.getByTestId("unread-count")).toHaveText(/[1-9]/);
  await page.getByRole("link", { name: /Benachrichtigungen/ }).click();
  await page.getByRole("link", { name: "Dir wurde eine Aufgabe zugewiesen: E2E PM Messeauftritt" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E PM Messeauftritt");
});

test("CVD stuft eine Aufgabe auf Dringend hoch und nimmt es zurück", async ({ page }) => {
  await loginAs(page, "Lukas");
  await page.goto("/redaktion");
  await page.getByRole("link", { name: "LinkedIn-Beitrag Messe" }).click();
  await page.getByRole("button", { name: "Als dringend markieren" }).click();
  await expect(page.getByText("Vom CVD als dringend markiert")).toBeVisible();
  await page.getByRole("button", { name: "Markierung „dringend“ entfernen" }).click();
  await expect(page.getByText("Vom CVD als dringend markiert")).toHaveCount(0);
});

test("Redaktion: Liste mit Filtern und Tafel nach Status", async ({ page }) => {
  await loginAs(page, "Juliana");
  await page.goto("/redaktion");
  await page.getByLabel("Owner").selectOption({ label: "Juliana" });
  await page.getByRole("button", { name: "Filtern" }).click();
  await expect(page).toHaveURL(/owner=/);
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Statement zur Förderung" })).toBeVisible();

  await page.getByRole("link", { name: "Tafel" }).click();
  await expect(page.getByRole("region", { name: "Änderungen angefordert" }).getByText("Statement zur Förderung")).toBeVisible();
  await page.getByRole("link", { name: "Zurücksetzen" }).click();
  await expect(page.getByRole("region", { name: "Freigabe angefragt" }).getByText("PM Standortentscheidung")).toBeVisible();

  await page.getByLabel("Darstellungsform").selectOption({ label: "Einfache Aufgabe" });
  await page.getByRole("button", { name: "Filtern" }).click();
  await expect(page.getByRole("region", { name: "Offen" }).getByText("Profil aufsetzen")).toBeVisible();
  await expect(page.getByText("PM Standortentscheidung")).toHaveCount(0);
});

test("Dashboard: Blöcke für Redakteure, Team-Ansicht nur für CVDs", async ({ page }) => {
  await loginAs(page, "Laura");
  await expect(page.getByRole("heading", { name: "Meine Aufgaben" })).toBeVisible();
  await expect(page.getByRole("link", { name: /PM Standortentscheidung/ })).toBeVisible();
  await expect(page.getByTestId("shifts-today")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Wartet auf meine Freigabe" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Team-Ansicht" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Warnungen" })).toHaveCount(0);

  await page.locator("summary", { hasText: "Laura" }).click();
  await page.getByRole("button", { name: "Abmelden" }).click();
  await loginAs(page, "Lukas");
  await expect(page.getByRole("heading", { name: "Wartet auf meine Freigabe" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Warnungen" })).toBeVisible();
  await expect(page.getByText(/Journalisten-Roundtable: 0 von 1/)).toBeVisible();
  await page.getByRole("link", { name: "Team-Ansicht" }).click();
  await expect(page.getByRole("heading", { name: "Offene Aufgaben nach Person" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Freigaben, die länger als 2 Stunden warten" })).toBeVisible();
});

test("Dienstplan: CVD trägt ein und kopiert die Woche, Redakteure sehen nur", async ({ page }) => {
  await loginAs(page, "Lars Scholtyssyk");
  await nav(page).getByRole("link", { name: "Dienstplan" }).click();
  const saturday = page.getByLabel(/^Wochenenddienst, Sa\./);
  await saturday.selectOption({ label: "Hannah" });
  await page.getByRole("button", { name: /^Eintragen: Wochenenddienst, Sa\./ }).click();
  await expect(page.getByRole("button", { name: "Hannah austragen" })).toBeVisible();
  await page.getByRole("button", { name: "Woche in die nächste Woche kopieren" }).click();
  await expect(page.getByText(/Dienste? kopiert\./)).toBeVisible();
  await page.getByRole("link", { name: "Nächste Woche" }).click();
  await expect(page.getByRole("button", { name: "Hannah austragen" }).first()).toBeVisible();

  await page.locator("summary", { hasText: "Lars Scholtyssyk" }).click();
  await page.getByRole("button", { name: "Abmelden" }).click();
  await loginAs(page, "Robin");
  await page.goto("/dienstplan");
  await expect(page.getByText("Den Dienstplan pflegen CVDs.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Eintragen/ })).toHaveCount(0);
});

test("Verwaltung: Zusatzrecht vergeben erscheint im Protokoll", async ({ page }) => {
  await loginAs(page, "Lars Scholtyssyk");
  await page.goto("/verwaltung/nutzer");
  await page.getByRole("link", { name: "Laura" }).click();
  await page.getByLabel("Recht", { exact: true }).selectOption({ label: "Freigaberecht" });
  await page.getByLabel("Kunde", { exact: true }).selectOption({ label: "Covenant" });
  await page.getByRole("button", { name: "Recht vergeben" }).click();
  await expect(page.getByText(/Freigaberecht · Covenant/)).toBeVisible();
  await expect(page.getByText(/vergeben von Lars Scholtyssyk/)).toBeVisible();
  await page.getByRole("link", { name: "Protokoll" }).click();
  await expect(page.getByRole("cell", { name: "Zusatzrecht vergeben" }).first()).toBeVisible();
});

test("Kunden: CVD legt einen Kunden an und archiviert ihn", async ({ page }) => {
  await loginAs(page, "Lukas");
  await nav(page).getByRole("link", { name: "Kunden" }).click();
  await page.getByRole("link", { name: "Neuer Kunde" }).click();
  await page.getByLabel("Name", { exact: true }).fill("E2E Testkunde");
  await page.getByLabel("Kurzname").fill("E2E Test");
  await page.getByLabel("Kunden-Lead").selectOption({ label: "Hannah" });
  await page.getByRole("button", { name: "Kunden anlegen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E Testkunde");
  await expect(page.getByText("Hannah · Kunden-Lead")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Archivieren" }).click();
  await expect(page.getByRole("button", { name: "Wiederherstellen" })).toBeVisible();
  await expect(page.getByLabel("Kundenauswahl").locator("option", { hasText: "E2E Testkunde" })).toHaveCount(0);
});

test("Suche findet Aufgaben und Kunden", async ({ page }) => {
  await loginAs(page, "Robin");
  await page.getByRole("searchbox", { name: "Suche" }).fill("Standort");
  await page.getByRole("searchbox", { name: "Suche" }).press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ergebnisse für „Standort“");
  await expect(page.getByRole("link", { name: "PM Standortentscheidung" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Suche" }).fill("Rafael");
  await page.getByRole("searchbox", { name: "Suche" }).press("Enter");
  await page.getByRole("main").getByRole("link", { name: "Rafael", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rafael");
});
