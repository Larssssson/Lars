import { expect, type Page } from "@playwright/test";

export async function loginAs(page: Page, name: string) {
  await page.goto("/login");
  await page.getByRole("button", { name: new RegExp(`Als ${name} anmelden`) }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Guten Tag");
}

export async function selectClient(page: Page, label: string) {
  await page.getByLabel("Kundenauswahl").selectOption({ label });
  await expect(page.getByLabel("Kundenauswahl")).toHaveValue(/.*/);
}

export function nav(page: Page) {
  return page.getByRole("navigation", { name: "Hauptnavigation" }).first();
}
