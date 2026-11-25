// Exercise the real navigation instead of bypassing the guarded workspace.
export async function navigateWorkspace(page, name) {
  const sidebar = page.getByRole("navigation", { name: "Staff navigation" });
  if (await sidebar.isVisible()) {
    const groups = { Content: ["Website"], Appearance: ["Website", "Brand & appearance"],
      Templates: ["Communications"], Staff: ["Administration", "Staff access"],
      Activity: ["Administration", "Activity"], System: ["Administration", "System administration"],
      "Enquiry forms": ["Enquiries", "Enquiry forms"], "Detailed questionnaire": ["Enquiries", "Detailed questionnaire"],
      Home: ["Overview"] };
    if (name === "Account") {
      await page.locator(".twe-faako-sidebar").getByRole("button", {name, exact: true}).click();
      return;
    }
    const [module, child] = groups[name] || [name];
    await sidebar.getByRole("button", { name: module, exact: true }).click();
    if (child) await sidebar.getByRole("button", { name: child, exact: true }).click();
    return;
  }
  const dock = page.getByRole("navigation", { name: "Workspace shortcuts" });
  const shortcut = dock.getByRole("button", { name: name === "Overview" ? "Home" : name, exact: true });
  if (await shortcut.isVisible()) { await shortcut.click(); return; }
  await page.getByRole("button", { name: /^Menu/ }).click();
  await page.getByRole("dialog", { name: "Travel With Ease menu" }).getByRole("button", { name, exact: true }).click();
}
