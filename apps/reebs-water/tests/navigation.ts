import { expect, type Page } from "@playwright/test";

export async function openWaterModule(page: Page, name: string) {
  const toggle = page.getByRole("button", { name: "Water navigation", exact: true });
  if (await toggle.isVisible() && await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  const navigation = page.getByRole("navigation", { name: "REEBS Water navigation", exact: true });
  await navigation.getByRole("link", { name, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(name === "Dashboard" ? "/$" : `/${name.toLowerCase()}$`));
}
