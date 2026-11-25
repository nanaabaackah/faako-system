// Tests exercise the real API client; fixtures are not application code.
import { mockWorkspaceApi } from "../test/fixtures/browser-api.js";
import { createRequire } from "node:module";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const require = createRequire(
  new URL("../../stroane-web/package.json", import.meta.url),
);
const { chromium, expect } = require("@playwright/test");
const origin = process.env.TWE_TEST_PORTAL_ORIGIN || "http://127.0.0.1:5197";
assert.equal(new URL(origin).hostname, "127.0.0.1");
const output = await mkdtemp(path.join(tmpdir(), "twe-content-browser-"));
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
try {
  for (const width of [320, 390, 768, 1440]) {
    console.log("Checking isolated CMS content at " + width + "px");
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      hasTouch: width < 768,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const requests = [];
    const writes = [];
    const navigate=async(name)=>{let button=page.getByRole('button',{name,exact:true}).filter({visible:true}).first();if(!await button.count()){await page.getByRole('button',{name:/^Menu/}).click();button=page.getByRole('button',{name,exact:true}).filter({visible:true}).first();}await button.click();};
    await mockWorkspaceApi(page, {role: "owner", requests, writes, templateDelay: 100, contentDelay: 200});
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.locator(".session-toolbar").waitFor();
    if (width <= 800) {
      const nav = page.locator(".twe-bottom-nav");
      const navBox = await nav.boundingBox();
      assert.ok(Math.abs(navBox.x + navBox.width / 2 - width / 2) <= 1, "Floating navigation is centred");
      await expect(nav.getByRole("button", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
      for (const button of await nav.getByRole("button").all()) {
        const box = await button.boundingBox();
        assert.ok(box.width >= 44 && box.height >= 44, "Bottom navigation retains touch targets");
      }
    }
    const filteredRequest = page.waitForRequest(request => { const url = new URL(request.url()); return url.pathname === "/api/agent/inquiries" && url.searchParams.get("status") === "new"; });
    await page.getByRole("button", { name: "Open new enquiries", exact: true }).click();
    await filteredRequest;
    await expect(page.getByRole("button", { name: "Status", exact: true })).toContainText("new");
    await navigate(width <= 800 ? "Home" : "Overview");
    await page.getByRole("button", { name: "Open website drafts", exact: true }).click();
    await page.getByRole("heading", { name: "Pages with drafts", exact: true }).waitFor();
    await page.getByRole("button", { name: /^About · Version/ }).click();
    await expect(page.getByRole("button", { name: "Section", exact: true })).toContainText("About");
    await navigate("Account");
    await page.getByRole("heading", { name: "Account and workspace settings", exact: true }).waitFor();
    assert.equal(await page.locator(".account-summary").evaluate(node => getComputedStyle(node).backgroundColor), "rgb(1, 12, 51)");
    assert.equal(await page.locator(".account-details").getByText("synthetic-workspace", { exact: true }).isVisible(), true);
    await page.locator(".account-workspace").getByRole("button", { name: "Sign out all devices", exact: true }).click();
    const signOutDialog = page.locator(".ui-erp-dialog-backdrop");
    await signOutDialog.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(await page.locator(".account-workspace").isVisible(), true, "Cancelling sign-out preserves the session");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(output, `account-${width}.png`), fullPage: true });
    await navigate("Content");
    for (const label of ["Packages", "Journal", "Travel Tips", "Footprint"]) {
      assert.equal(await page.locator(".portal-shell > aside nav").getByRole("button", { name: label, exact: true }).count(), 0, "Collections stay inside Content");
    }
    const headingInput = page.getByLabel(/^Heading/);
    assert.equal(await headingInput.evaluate(element => getComputedStyle(element).borderTopWidth), "0px", "No nested input border");
    await headingInput.focus();
    assert.equal(await headingInput.evaluate(element => getComputedStyle(element.closest(".ui-field__control")).outlineWidth), "3px", "Wrapper keeps visible focus");
    const select = async (value) => {
      await page.getByRole("button", { name: "Section", exact: true }).click();
      const label = value.replaceAll("-", " ");
      await page.getByRole("option", { name: label[0].toUpperCase() + label.slice(1), exact: true }).click();
    };
    // Travel Tips remain a separately publishable collection while Journal
    // manages its own articles and optional tip series/CTAs.
    await page.getByRole("button", { name: "Section", exact: true }).click();
    assert.equal(await page.getByRole("option", { name: "Travel tips", exact: true }).count(), 1,
      "Travel Tips remains available as its own CMS collection");
    await page.getByRole("option", { name: "Journal", exact: true }).click();
    await page.getByLabel("Travel tip series").first().waitFor();
    await page.getByLabel("Website CTA button text (optional)").first().waitFor();
    await page.getByRole("group", { name: "Article card & listing", exact: true }).first().getByLabel(/^Article title/).fill("Changed demo article");
    const articleEditor = page.getByRole("group", { name: "Article detail page", exact: true }).first();
    const articleBody = articleEditor.getByRole("textbox", { name: /^Full article/ });
    await articleBody.fill("Pack your bag\nCheck your passport");
    await articleBody.evaluate(node => node.setSelectionRange(0, 4));
    await articleEditor.getByRole("button", { name: "Bold", exact: true }).click();
    await expect(articleBody).toHaveValue("**Pack** your bag\nCheck your passport");
    await articleBody.evaluate(node => node.setSelectionRange(0, node.value.length));
    await articleEditor.getByRole("button", { name: "Bulleted list", exact: true }).click();
    await expect(articleBody).toHaveValue("- **Pack** your bag\n- Check your passport");
    await articleEditor.getByRole("button", { name: "Preview", exact: true }).click();
    const formattedPreview = articleEditor.locator(".twe-rich-preview");
    await expect(formattedPreview.locator("li strong")).toHaveText("Pack");
    await expect(formattedPreview.locator("li")).toHaveCount(2);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Formatting controls wrap without overflow");
    await page.getByLabel("Website CTA button text (optional)").first().fill("Plan my trip");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page
      .getByRole("button", { name: "Preview saved content", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Changed demo article", exact: true })
      .waitFor();
    await select("travel-footprint");
    await page
      .getByLabel(/^Combined verified total/)
      .first()
      .fill("13");
    await page.screenshot({ path: path.join(output, "footprint-before-preview-" + width + ".png") });
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page
      .getByRole("button", { name: "Preview saved content", exact: true })
      .click();
    await page
      .getByText("Kenya: 13 verified combined trips", { exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: path.join(output, `footprint-${width}.png`),
      fullPage: true,
    });
    await select("privacy");
    // The section changes before its async draft is ready: the old draft must
    // be locked and must not be written to the new or previous section.
    const approvedCopy = page.getByRole("button", { name: "Load approved copy", exact: true });
    await expect(approvedCopy).toBeDisabled();
    await expect(page.getByLabel(/^Heading/)).toBeDisabled();
    await expect(page.getByLabel(/^Heading/)).toHaveValue("Demo privacy");
    await expect(approvedCopy).toBeEnabled();
    await approvedCopy.click();
    await expect(page.getByLabel(/^Heading/)).toHaveValue("Privacy notice");
    await page.waitForFunction(() => document.querySelector(".draft-save-status")?.textContent.includes("Saved · version 2"));
    assert.ok(requests.includes("/api/agent/content/privacy"), "Privacy draft fetched after section switch");
    assert.ok(
      writes.some(write => write.path === "/api/agent/content/privacy/draft" && write.heading === "Privacy notice"),
      "Approved Privacy content saves to the Privacy draft",
    );
    assert.equal(
      writes.some(write => write.path === "/api/agent/content/travel-footprint/draft" && write.heading === "Privacy notice"),
      false,
      "Approved Privacy content never writes to the Footprint draft",
    );
    assert.equal(await page.getByRole("button", { name: "Publish saved changes", exact: true }).isEnabled(), true);
    await page.screenshot({
      path: path.join(output, `policy-${width}.png`),
      fullPage: true,
    });
    await navigate("Media");
    await page
      .getByRole("button", { name: "Refresh Drive folder", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Drive image", exact: true })
      .click();
    await page
      .getByRole("option", {
        name: "Demo photo — no Drive connection",
        exact: true,
      })
      .click();
    const driveForm = page.getByRole("group", {
      name: "Import from the approved folder",
      exact: true,
    });
    await driveForm
      .getByLabel(/^Alternative text/)
      .fill("Drive interface fixture");
    await driveForm
      .getByRole("button", { name: "Import selected image", exact: true })
      .click();
    await page
      .getByText(
        "Drive image imported into private R2 storage. Select it in a draft, save and request publication. The live website has not changed.",
        { exact: true },
      )
      .waitFor();
    const notifications = page.getByRole("button", {
      name: "Dismiss notification",
      exact: true,
    });
    while (await notifications.count()) await notifications.first().click();
    await page.screenshot({
      path: path.join(output, `drive-media-${width}.png`),
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await navigate("Content");
    // Reselecting the already-active home section must not leave its controls
    // disabled indefinitely (no page-change effect would run in that case).
    await page.getByLabel(/^Heading/).waitFor();
    await select("home");
    await expect(page.getByLabel(/^Heading/)).toBeEnabled();
    await page
      .getByRole("button", { name: "Choose image", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Use Drive interface fixture", exact: true })
      .click();
    // The editor confirms selection without exposing an internal media UUID.
    await page.getByText("Image selected", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    assert.ok(requests.length > 0, "Actual API client exercised against isolated HTTP fixtures");
    await navigate("Templates");
    await page.getByLabel(/^Heading/).fill("Synthetic acknowledgement");
    await page.getByRole("button", { name: "Preview email", exact: true }).click();
    await page.frameLocator('iframe[title="Enquiry acknowledgement preview"]')
      .getByRole("heading", { name: "Synthetic acknowledgement", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Activate saved template", exact: true }).isDisabled(), true);
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByRole("button", { name: "Activate saved template", exact: true }).click();
    await page.locator(".ui-erp-dialog-backdrop")
      .getByRole("button", { name: "Activate template", exact: true }).click();
    await page.getByText("Draft revision 2 · Active revision 1", { exact: true }).waitFor();
    const emailType = page.getByRole("button", { name: "Email type", exact: true });
    await emailType.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("option", { name: "Staff invitation", exact: true }).click();
    await expect(emailType).toContainText("Staff invitation");
    await page.getByText("Draft revision 0 · Default invitation copy", { exact: true }).waitFor();
    await expect(page.getByLabel(/^Heading/)).toBeEnabled();
    await page.getByLabel(/^Heading/).fill("Synthetic team invitation");
    await emailType.click();
    await page.getByRole("option", { name: "Staff invitation", exact: true }).click();
    await expect(page.getByLabel(/^Heading/)).toHaveValue("Synthetic team invitation");
    await emailType.click();
    await page.getByRole("option", { name: "Enquiry acknowledgement", exact: true }).click();
    await page.locator(".ui-erp-dialog-backdrop")
      .getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal(await page.getByLabel(/^Heading/).inputValue(), "Synthetic team invitation", "Cancelling a type change retains unsaved copy");
    await page.getByRole("button", { name: "Preview email", exact: true }).click();
    const invitationPreview = page.frameLocator('iframe[title="Staff invitation preview"]');
    await invitationPreview.getByRole("heading", { name: "Synthetic team invitation", exact: true }).waitFor();
    assert.match(await invitationPreview.locator("body").innerText(), /does not grant workspace access/);
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByRole("button", { name: "Approve saved template", exact: true }).click();
    await page.locator(".ui-erp-dialog-backdrop")
      .getByRole("button", { name: "Approve template", exact: true }).click();
    await page.getByText("Draft revision 2 · Approved revision 1", { exact: true }).waitFor();
    while (await notifications.count()) await notifications.first().click();
    await page.screenshot({ path: path.join(output, `invitation-template-${width}.png`), fullPage: true });
    await emailType.click();
    await page.getByRole("option", { name: "Enquiry acknowledgement", exact: true }).click();
    await expect(emailType).toContainText("Enquiry acknowledgement");
    await page.getByText("Draft revision 2 · Active revision 1", { exact: true }).waitFor();
    await expect(page.getByLabel(/^Heading/)).toHaveValue("Synthetic acknowledgement");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    while (await notifications.count()) await notifications.first().click();
    await page.screenshot({ path: path.join(output, `templates-${width}.png`), fullPage: true });
    await emailType.click();
    await page.getByRole("option", { name: "Package — Sample journey", exact: true }).click();
    await page.getByText("Draft revision 0 · Using shared package template", { exact: true }).waitFor();
    await expect(page.getByLabel(/^Heading/)).toBeEnabled();
    await page.getByLabel(/^Heading/).fill("Your sample journey enquiry");
    await page.getByRole("button", { name: "Preview email", exact: true }).click();
    const packagePreview = page.frameLocator('iframe[title="Sample journey preview"]');
    await packagePreview.getByRole("heading", { name: "Your sample journey enquiry", exact: true }).waitFor();
    assert.match(await packagePreview.locator("body").innerText(), /Sample journey/);
    await page.getByRole("button", { name: "Mobile", exact: true }).click();
    await expect(page.locator('iframe[title="Sample journey preview"]')).toHaveClass("template-preview-mobile");
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    await page.getByRole("button", { name: "Activate saved template", exact: true }).click();
    await page.locator(".ui-erp-dialog-backdrop").getByRole("button", { name: "Activate template", exact: true }).click();
    await page.getByText("Draft revision 2 · Active revision 1", { exact: true }).waitFor();
    await emailType.click();
    await page.getByRole("option", { name: "Enquiry acknowledgement", exact: true }).click();
    await expect(page.getByLabel(/^Heading/)).toHaveValue("Synthetic acknowledgement");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.ok(requests.length > 0, "Actual API client exercised against isolated HTTP fixtures");
    await context.close();
  }
  console.log(
    JSON.stringify({
      passed: true,
      widths: [320, 390, 768, 1440],
      screenshots: output,
      scope: "Real portal components and API transport using isolated Playwright HTTP fixtures",
    }),
  );
} finally {
  await browser.close();
}
