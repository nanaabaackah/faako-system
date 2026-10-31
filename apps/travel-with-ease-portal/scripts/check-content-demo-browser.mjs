import { createRequire } from "node:module";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const require = createRequire(
  new URL("../../stroane-web/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");
const origin = process.env.TWE_TEST_PORTAL_ORIGIN || "http://127.0.0.1:5197";
assert.equal(new URL(origin).hostname, "127.0.0.1");
const output = await mkdtemp(path.join(tmpdir(), "twe-content-demo-"));
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      hasTouch: width < 768,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const requests = [];
    await page.route("**/api/**", (route) => {
      requests.push(route.request().url());
      return route.abort();
    });
    await page.goto(`${origin}/?demo=1`, { waitUntil: "domcontentloaded" });
    await page
      .getByRole("button", { name: "Content", exact: true })
      .first()
      .click();
    const select = async (value) => {
      await page.getByRole("button", { name: "Section", exact: true }).click();
      await page.getByRole("option", { name: value, exact: true }).click();
    };
    await select("journal");
    await page.getByLabel(/^Title/).fill("Changed demo article");
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
    await page
      .getByRole("button", { name: "Load review draft", exact: true })
      .click();
    assert.equal(
      await page.getByLabel(/^Heading/).inputValue(),
      "Privacy notice",
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Request publication", exact: true })
        .isEnabled(),
      false,
    );
    await page.screenshot({
      path: path.join(output, `policy-${width}.png`),
      fullPage: true,
    });
    page.once("dialog", async (dialog) => {
      assert.equal(dialog.message(), "Discard unsaved changes?");
      await dialog.accept();
    });
    await page
      .getByRole("button", { name: "Media", exact: true })
      .first()
      .click();
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
      .getByLabel(/^Source and licence evidence/)
      .fill("Synthetic browser fixture");
    await driveForm
      .getByRole("button", { name: "Import selected image", exact: true })
      .click();
    await page
      .getByText(
        "Demo image selected in the simulated library. No Drive or R2 request was made; nothing was sent or published.",
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
    await page
      .getByRole("button", { name: "Content", exact: true })
      .first()
      .click();
    await select("home");
    await page
      .getByRole("button", { name: "Choose image", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Use Drive interface fixture", exact: true })
      .click();
    await page
      .getByText(/Selected image: 20000000-0000-4000-8000-000000000001/)
      .waitFor();
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    assert.deepEqual(
      requests,
      [],
      "Demo content controls must never call the API",
    );
    await page.getByRole("button", { name: "Templates", exact: true }).first().click();
    await page.getByLabel(/^Heading/).fill("Synthetic acknowledgement");
    await page.getByRole("button", { name: "Preview email", exact: true }).click();
    await page.frameLocator('iframe[title="Enquiry acknowledgement preview"]')
      .getByRole("heading", { name: "Synthetic acknowledgement", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Activate saved template", exact: true }).isDisabled(), true);
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Activate saved template", exact: true }).click();
    await page.getByText("Draft revision 2 · Active revision 1", { exact: true }).waitFor();
    const emailType = page.getByRole("button", { name: "Email type", exact: true });
    await emailType.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("option", { name: "Staff invitation", exact: true }).click();
    await page.getByRole("heading", { name: "Staff invitation", exact: true }).waitFor();
    await page.getByLabel(/^Heading/).fill("Synthetic team invitation");
    page.once("dialog", dialog => dialog.dismiss());
    await emailType.click();
    await page.getByRole("option", { name: "Enquiry acknowledgement", exact: true }).click();
    assert.equal(await page.getByLabel(/^Heading/).inputValue(), "Synthetic team invitation", "Cancelling a type change retains unsaved copy");
    await page.getByRole("button", { name: "Preview email", exact: true }).click();
    const invitationPreview = page.frameLocator('iframe[title="Staff invitation preview"]');
    await invitationPreview.getByRole("heading", { name: "Synthetic team invitation", exact: true }).waitFor();
    assert.match(await invitationPreview.locator("body").innerText(), /does not grant workspace access/);
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    page.once("dialog", dialog => dialog.accept());
    await page.getByRole("button", { name: "Approve saved template", exact: true }).click();
    await page.getByText("Draft revision 2 · Approved revision 1", { exact: true }).waitFor();
    while (await notifications.count()) await notifications.first().click();
    await page.screenshot({ path: path.join(output, `invitation-template-${width}.png`), fullPage: true });
    await emailType.click();
    await page.getByRole("option", { name: "Enquiry acknowledgement", exact: true }).click();
    await page.getByRole("heading", { name: "Enquiry acknowledgement", exact: true }).waitFor();
    await page.getByText("Draft revision 2 · Active revision 1", { exact: true }).waitFor();
    assert.equal(await page.getByLabel(/^Heading/).inputValue(), "Synthetic acknowledgement");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    while (await notifications.count()) await notifications.first().click();
    await page.screenshot({ path: path.join(output, `templates-${width}.png`), fullPage: true });
    assert.deepEqual(requests, [], "Template demo must not send emails or call the API");
    await context.close();
  }
  console.log(
    JSON.stringify({
      passed: true,
      widths: [320, 390, 768, 1440],
      screenshots: output,
      scope: "Real portal components using the in-memory demo adapter",
    }),
  );
} finally {
  await browser.close();
}
