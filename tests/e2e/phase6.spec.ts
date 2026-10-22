import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe.configure({ mode: "serial" });

/** Keine waagerechte Scrollleiste: die Seite passt in die Breite des Smartphones. */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("PWA: Manifest, Service Worker, Gesundheitsendpunkt", async ({ page, request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "impress", display: "standalone", start_url: "/", lang: "de" });
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(["192x192", "512x512", "512x512"]);
  expect((await request.get("/icons/icon-192.png")).headers()["content-type"]).toBe("image/png");

  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-store");
  expect(await sw.text()).toContain("notificationclick");

  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  const body = await health.json();
  expect(body.status).toBe("ok");
  expect(Object.keys(body.checks).sort()).toEqual(["datenbank", "ki", "sharepoint", "speicher"]);

  // der Service Worker lässt sich registrieren (localhost gilt als sicherer Kontext)
  await page.goto("/login");
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.register("/sw.js", { scope: "/" })).scope);
  expect(scope).toMatch(/\/$/);
});

test("Push einrichten: mehrere Geräte, einzeln entfernen, Testnachricht in der Glocke", async ({ page }) => {
  await loginAs(page, "Laura");
  await page.goto("/profil");
  await expect(page.getByRole("heading", { level: 1, name: "Profil" })).toBeVisible();
  const setup = page.getByTestId("push-setup");
  await expect(setup).toContainText("Ersatz-Modus");
  await expect(setup.getByRole("listitem").first()).toBeVisible();

  await setup.getByRole("button", { name: "Ersatz-Gerät registrieren" }).click();
  await expect(page.getByTestId("devices").getByRole("listitem")).toHaveCount(1);
  await setup.getByRole("button", { name: "Ersatz-Gerät registrieren" }).click();
  await expect(page.getByTestId("devices").getByRole("listitem")).toHaveCount(2);
  await page.getByTestId("devices").getByRole("button", { name: /Entfernen/ }).first().click();
  await expect(page.getByTestId("devices").getByRole("listitem")).toHaveCount(1);

  await page.getByRole("button", { name: "Testnachricht senden" }).click();
  await expect(page.getByText("Testnachricht an 1 Gerät gesendet.")).toBeVisible();
  await page.goto("/benachrichtigungen");
  await expect(page.getByText("Testnachricht von impress").first()).toBeVisible();
});

test("Verwaltung: Einstellungen, Integrationen, Kennzahlen, Protokoll", async ({ page }) => {
  test.setTimeout(90_000);
  await loginAs(page, "Lars Scholtyssyk");
  await page.goto("/verwaltung/einstellungen");
  await page.getByLabel("Eskalation an alle Freigabeberechtigten nach (Minuten)").fill("20");
  await page.getByLabel("Eskalation an den CVD vom Dienst nach (Minuten)").fill("50");
  await page.getByRole("button", { name: "Speichern" }).first().click();
  await expect(page.getByText("Gespeichert.").first()).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Eskalation an alle Freigabeberechtigten nach (Minuten)")).toHaveValue("20");

  await page.goto("/verwaltung/integrationen");
  const integrations = page.getByTestId("integrations");
  await expect(integrations.getByRole("row")).toHaveCount(7);
  await expect(integrations).toContainText("Microsoft-Login");
  await expect(integrations).toContainText("Ersatz");

  await page.goto("/verwaltung/kennzahlen");
  await expect(page.getByTestId("metric-active-users").getByRole("row")).toHaveCount(9);
  await expect(page.getByTestId("metric-tasks")).toContainText("Freigabe angefragt");
  await expect(page.getByTestId("metric-review-shifts")).toContainText("Diensten der letzten 30 Tage");

  await page.goto("/verwaltung/protokoll");
  await page.getByLabel("Aktion", { exact: true }).selectOption({ label: "Einstellung geändert" });
  await page.getByRole("button", { name: "Filtern" }).click();
  await expect(page.getByTestId("audit-count")).toHaveText("1 Eintrag");
  await page.getByLabel("Suche (Aktion, Person, Betroffen)").fill("Laura");
  await page.getByLabel("Aktion", { exact: true }).selectOption({ label: "alle Aktionen" });
  await page.getByRole("button", { name: "Filtern" }).click();
  await expect(page.getByTestId("audit")).toBeVisible();
});

test("Kennzahlen und Integrationen nur für Admins", async ({ page }) => {
  await loginAs(page, "Laura");
  const response = await page.goto("/verwaltung/kennzahlen");
  expect(response?.status()).toBe(404);
});

test.describe("Smartphone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("Dashboard, Freigabe und Kontaktanfragen passen auf das Smartphone", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAs(page, "Lukas");
    await expectNoHorizontalScroll(page);
    await expect(page.getByText("Wartet auf meine Freigabe")).toBeVisible();

    await page.getByRole("link", { name: /PM Standortentscheidung/ }).first().click();
    await expect(page.getByRole("button", { name: "Freigeben" }).first()).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.goto("/journo-hub/anfragen");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.goto("/profil");
    await expectNoHorizontalScroll(page);
  });
});
