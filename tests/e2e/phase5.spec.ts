import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { loginAs, selectClient } from "./helpers";

test.describe.configure({ mode: "serial" });

const article = (page: Page, headline: string) => page.getByTestId("article").filter({ hasText: headline });

test("Import der Beispieldatei, Heute relevant, Aufnehmen, Aktionen, Pressespiegel, Kachel", async ({ page }) => {
  test.setTimeout(180_000);
  await loginAs(page, "Mika");
  await page.goto("/pressespiegel/import");
  await page.getByLabel("Meltwater-Export (CSV oder XLSX)").setInputFiles(path.join(process.cwd(), "fixtures/monitoring/meltwater_sample.csv"));
  await page.getByRole("button", { name: "Hochladen" }).click();
  await expect(page.getByText("Spaltenzuordnung")).toBeVisible();
  await page.getByRole("button", { name: "Importieren" }).click();
  // 19 bekannte Autoren nach dem Seed; im Gesamtlauf kommen Kontakte aus dem Import-Test von Phase 4 hinzu
  await expect(page.getByText(/^Importiert: 37 Artikel, 3 gleiche zusammengefasst, (19|\d\d) bekannten Autoren zugeordnet\.$/)).toBeVisible();

  await selectClient(page, "Covenant");
  await page.goto("/pressespiegel");
  const today = page.getByTestId("today-Covenant");
  await expect(today.getByTestId("article")).toHaveCount(10);
  await expect(today.getByTestId("article").first()).toContainText("Neue Produktionsstätte für Rüstungsgüter in Sachsen geplant");
  await expect(today.getByTestId("article").first()).toContainText("Wert: 95");

  const a1 = article(page, "Neue Produktionsstätte für Rüstungsgüter in Sachsen geplant");
  await a1.getByLabel("Aufnehmen für Covenant").check();
  await expect(a1.getByRole("button", { name: "Einschätzung erzeugen" })).toBeVisible();
  await a1.getByRole("button", { name: "Einschätzung erzeugen" }).click();
  await expect(a1.getByText("Aufgabe mit KI-Entwurf angelegt.")).toBeVisible();
  await a1.getByRole("button", { name: "Autor in Journo Hub übernehmen" }).click();
  await expect(a1.getByText("Der Autor ist schon im Journo Hub.")).toBeVisible();

  const g1 = article(page, "Wehrtechnik: Neue Fertigung für Munition in Planung");
  await g1.getByLabel("Aufnehmen für Covenant").check();
  await g1.getByRole("button", { name: "Autor in Journo Hub übernehmen" }).click();
  await expect(g1.getByText("Kontakt mit dem Label Pressespiegel angelegt.")).toBeVisible();

  await page.reload();
  await a1.getByTestId("article-actions").getByRole("link", { name: "Einschätzung" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Einschätzung: Neue Produktionsstätte");
  await page.goto("/pressespiegel");

  await today.getByRole("button", { name: "Pressespiegel erstellen" }).click();
  await expect(today.getByText("Pressespiegel angelegt.")).toBeVisible();

  await page.goto("/");
  const tile = page.getByTestId("monitoring-tile");
  // Seed-Artikel (13.2) entstehen beim Seed ebenfalls "heute"
  await expect(tile).toContainText(/\d+ Artikel heute importiert/);
  await expect(tile).toContainText("2 aufgenommen");

  await page.goto("/pressespiegel/alle?q=Wehrtechnik");
  await expect(page.getByTestId("article-count")).toHaveText(/\d+ Artikel/);
  await expect(article(page, "Wehrtechnik: Neue Fertigung für Munition in Planung")).toBeVisible();
});

test("Artikel von Hand anlegen", async ({ page }) => {
  await loginAs(page, "Mika");
  await page.goto("/pressespiegel/import");
  await page.getByLabel("Headline").fill("Gastbeitrag zur Verteidigungspolitik");
  await page.getByLabel("Medium").fill("Tagesblatt Nord");
  await page.getByRole("button", { name: "Artikel anlegen" }).click();
  await expect(page.getByText("Artikel angelegt.")).toBeVisible();
  await page.goto("/pressespiegel/alle?q=Gastbeitrag");
  await expect(page.getByTestId("article-count")).toHaveText("1 Artikel");
});
