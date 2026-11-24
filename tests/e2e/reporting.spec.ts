import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test("Reporting: Export hochladen, Vorlage und Bausteine wählen, Vorschau, PowerPoint, Freigabe durch zweite Person", async ({ browser }) => {
  test.setTimeout(150_000);
  const laura = await (await browser.newContext()).newPage();
  laura.on("dialog", (d) => d.accept());
  await loginAs(laura, "Laura");
  await laura.getByRole("link", { name: "Reporting" }).first().click();
  await laura.getByRole("link", { name: "Neues Reporting" }).click();
  await laura.waitForLoadState("networkidle");
  await laura.locator("#r-client").selectOption({ label: "Covenant" });
  await expect(laura).toHaveURL(/kunde=/);
  await expect(laura.locator("#r-from")).toBeVisible();
  await laura.waitForLoadState("networkidle");
  await laura.locator("#r-from").fill("2026-10-01");
  await laura.locator("#r-to").fill("2026-10-31");
  await laura.getByRole("radio", { name: /Management/ }).check();
  await laura.getByRole("checkbox", { name: "Medienliste am Ende" }).check();
  await laura.locator("#r-file").setInputFiles("fixtures/reports/meltwater_reporting_sample.csv");
  await laura.locator("#r-comp").fill("Northwind Defence\nHelix Systems");
  await laura.getByRole("button", { name: "Reporting erstellen" }).click();
  await expect(laura.getByRole("heading", { level: 1 })).toHaveText("Medienreporting Covenant · Oktober 2026", { timeout: 60_000 });

  const preview = laura.frameLocator('[data-testid="report-preview"]');
  await expect(preview.getByRole("heading", { name: "Share of Voice" })).toBeVisible({ timeout: 30_000 });
  await expect(preview.getByRole("heading", { name: "Medienliste" })).toBeVisible();
  await expect(preview.getByText("Entwurf, nicht freigegeben").first()).toBeVisible();
  await expect(laura.getByRole("button", { name: "Freigeben" })).toHaveCount(0);

  const download = laura.waitForEvent("download");
  await laura.getByRole("link", { name: /Executive-Version/ }).click();
  expect((await download).suggestedFilename()).toMatch(/_Executive\.pptx$/);

  const lukas = await (await browser.newContext()).newPage();
  await loginAs(lukas, "Lukas");
  await lukas.goto(laura.url());
  await lukas.getByRole("button", { name: "Freigeben" }).click();
  await expect(lukas.getByText(/Freigegeben von Lukas/).first()).toBeVisible({ timeout: 15_000 });
});
