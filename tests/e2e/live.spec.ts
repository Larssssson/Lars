import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test("Erwähnung mit Vorschlag, farbig im Kommentar, Hinweis oben bei der erwähnten Person, Export als Mail", async ({ browser }) => {
  test.setTimeout(120_000);
  const robin = await (await browser.newContext()).newPage();
  const lukas = await (await browser.newContext()).newPage();
  await loginAs(robin, "Robin");
  await loginAs(lukas, "Lukas");

  await lukas.goto("/redaktion?status=ALLE");
  await lukas.getByRole("link", { name: "PM Standortentscheidung" }).first().click();
  await expect(lukas.getByRole("heading", { level: 1 })).toHaveText("PM Standortentscheidung", { timeout: 30_000 });

  const input = lukas.getByLabel("Kommentar zum ganzen Text");
  await input.click();
  await input.pressSequentially("Bitte gegenlesen @Rob");
  const option = lukas.getByRole("option", { name: "@Robin" });
  await expect(option).toBeVisible();
  await input.press("Enter");
  await expect(input).toHaveValue("Bitte gegenlesen @Robin ");
  await lukas.getByRole("button", { name: "Kommentieren", exact: true }).click();
  await expect(lukas.getByTestId("comment-threads").locator("[data-mention]", { hasText: "@Robin" })).toBeVisible();

  // Robin bekommt oben einen Hinweis (Abfrage alle 20 Sekunden)
  const notice = robin.getByTestId("live-notice");
  await expect(notice).toContainText("Du wurdest erwähnt", { timeout: 30_000 });
  await expect(notice).toContainText("Lukas hat dich erwähnt: PM Standortentscheidung");

  // Export: Version wählbar, Mail-Entwurf als .eml
  const card = lukas.getByTestId("export-card");
  await expect(card.getByLabel("Version")).toBeVisible();
  await card.getByLabel("Ton").selectOption("nuechtern");
  const download = lukas.waitForEvent("download");
  await card.getByRole("link", { name: "Als Outlook-Mail öffnen" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.eml$/);
});
