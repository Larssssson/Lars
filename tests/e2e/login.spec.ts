import { expect, test, type Page } from "@playwright/test";

async function loginAs(page: Page, name: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(`Als ${name} anmelden`) }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Guten Tag");
}

test("ohne Anmeldung führt jede Seite zum Login", async ({ page }) => {
  await page.goto("/redaktion");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Entwickler-Login" })).toBeVisible();
});

test("Kundenauswahl gilt für alle Bereiche und bleibt gespeichert", async ({ page }) => {
  await loginAs(page, "Laura");
  const nav = page.getByRole("navigation", { name: "Hauptnavigation" }).first();
  for (const area of ["Dashboard", "Redaktion", "Pressespiegel", "Journo Hub", "Kunden", "Dienstplan"]) {
    await expect(nav.getByRole("link", { name: area })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: "Verwaltung" })).toHaveCount(0);

  await page.getByLabel("Kundenauswahl").selectOption({ label: "Covenant" });
  await expect(page.getByTestId("client-filter")).toHaveText("Gefiltert auf Covenant");

  await nav.getByRole("link", { name: "Redaktion" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Redaktion");
  await expect(page.getByTestId("client-filter")).toHaveText("Gefiltert auf Covenant");
  await expect(page.getByLabel("Kundenauswahl")).toHaveValue(/.+/);

  // gespeichert pro Nutzer: auch nach Abmelden und erneutem Anmelden
  await page.locator("summary", { hasText: "Laura" }).click();
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await loginAs(page, "Laura");
  await expect(page.getByTestId("client-filter")).toHaveText("Gefiltert auf Covenant");

  await page.getByLabel("Kundenauswahl").selectOption({ label: "Alle Kunden" });
  await expect(page.getByTestId("client-filter")).toHaveText("Alle Kunden");
});

test("CVD sieht die Verwaltung, Redakteure nicht", async ({ page }) => {
  await loginAs(page, "Lars Scholtyssyk");
  const nav = page.getByRole("navigation", { name: "Hauptnavigation" }).first();
  await nav.getByRole("link", { name: "Verwaltung" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Verwaltung");
});

test("Redakteure erreichen die Verwaltung auch nicht direkt", async ({ page }) => {
  await loginAs(page, "Mika");
  const response = await page.goto("/verwaltung");
  expect(response?.status()).toBe(404);
});
