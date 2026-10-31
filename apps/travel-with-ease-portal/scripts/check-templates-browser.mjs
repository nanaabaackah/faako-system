import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const require = createRequire(
  new URL("../../stroane-web/package.json", import.meta.url),
);
const { chromium } = require("@playwright/test");
const browser = await chromium.launch({
  headless: true,
  executablePath:
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
});
const output = await mkdtemp(path.join(tmpdir(), "twe-templates-fonts-"));
const web = process.env.TWE_TEST_WEB || "http://127.0.0.1:4338";
const portal = process.env.TWE_TEST_PORTAL || "http://127.0.0.1:5198";
for (const origin of [web, portal])
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname));
try {
  for (const width of [320, 390, 768, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
      hasTouch: width < 768,
    });
    const page = await context.newPage();
    const apiRequests = [];
    await page.route("**/api/**", (route) => {
      apiRequests.push(route.request().url());
      return route.abort();
    });
    await page.goto(web + "/demo", { waitUntil: "networkidle" });
    assert.equal(
      await page
        .locator("[data-cookie-notice]")
        .evaluate((node) => node.matches(":modal")),
      true,
      "The first privacy notice must be a real popup",
    );
    assert.equal(
      await page.locator(".hero-signature").innerText(),
      "A Little More You",
    );
    assert.match(
      await page
        .locator(".hero-signature")
        .evaluate((node) => getComputedStyle(node).fontFamily),
      /Bonheur Royale/,
    );
    assert.equal(
      await page
        .locator("main h2, footer h2, dialog h2")
        .evaluateAll((nodes) =>
          nodes.every(
            (node) =>
              getComputedStyle(node).fontFamily.includes("Montserrat") &&
              getComputedStyle(node).fontWeight === "800",
          ),
        ),
      true,
    );
    assert.equal(
      await page.evaluate(
        () =>
          document.fonts.check('400 24px "Bonheur Royale"') &&
          document.fonts.check("800 24px Montserrat"),
      ),
      true,
    );
    assert.equal(
      await page
        .locator("footer .travel-footprint")
        .evaluate((node) => getComputedStyle(node).backgroundColor),
      "rgba(0, 0, 0, 0)",
    );
    assert.equal(await page.locator(".demo-email-preview").count(), 0);
    if (width > 600) {
      const groupTops = await page.locator("footer .footer-links > nav").evaluateAll(
        (nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().top)),
      );
      assert.equal(new Set(groupTops).size, 1, "Footer link groups must share one desktop row");
    }
    await page.screenshot({ path: path.join(output, `website-${width}.png`) });
    await page
      .getByRole("button", { name: "Essential only", exact: true })
      .click();
    for (const selector of [
      "#demo-footprint .footprint-map",
      "footer .footprint-map",
    ]) {
      const size = await page
        .locator(selector)
        .evaluate((node) => ({
          width: node.getBoundingClientRect().width,
          container: node.closest(".travel-footprint").getBoundingClientRect()
            .width,
        }));
      assert.ok(
        Math.abs(size.width - size.container) <= 1,
        "Maps must fill their available row",
      );
      assert.ok(
        size.width >= width * 0.85,
        "Maps must not be confined to a narrow column",
      );
    }
    await page
      .locator("#demo-footprint")
      .screenshot({ path: path.join(output, `map-${width}.png`) });
    await page
      .locator("footer.twe-public-footer")
      .screenshot({ path: path.join(output, `footer-${width}.png`) });
    await page.locator("footer [data-cookie-settings]").focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Cookie preferences" });
    await dialog.waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await dialog.isVisible(), false);
    assert.equal(
      await page
        .locator("footer [data-cookie-settings]")
        .evaluate((node) => node === document.activeElement),
      true,
    );
    await page.keyboard.press("Enter");
    await dialog.getByLabel("Optional analytics").check();
    await dialog.getByRole("button", { name: "Save preferences" }).click();
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("twe-demo-cookie-consent-v1"))
            .analytics,
      ),
      true,
    );
    const card = page.locator(".journey-card").first();
    await card.scrollIntoViewIfNeeded();
    await card.click({ position: { x: 30, y: 30 } });
    await page
      .getByRole("heading", { name: "Sample package enquiry" })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.goto(portal + "/?demo=1", { waitUntil: "networkidle" });
    await page
      .getByRole("button", { name: "Templates", exact: true })
      .first()
      .click();
    await page
      .getByRole("heading", { name: "Enquiry acknowledgement", exact: true })
      .waitFor();
    await page.getByLabel(/^Heading/).fill("Thank you for planning with us");
    await page
      .getByRole("button", { name: "Preview email", exact: true })
      .click();
    await page
      .frameLocator('iframe[title="Enquiry acknowledgement preview"]')
      .getByRole("heading", { name: "Thank you for planning with us" })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Activate saved template", exact: true })
        .isDisabled(),
      true,
    );
    await page.getByRole("button", { name: "Save draft", exact: true }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Activate saved template", exact: true })
      .click();
    await page.getByText("Draft revision 2 · Active revision 1").waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    const dismiss = page.getByRole("button", {
      name: "Dismiss notification",
      exact: true,
    });
    while (await dismiss.count()) await dismiss.first().click();
    await page.screenshot({
      path: path.join(output, `templates-${width}.png`),
      fullPage: true,
    });
    assert.deepEqual(apiRequests, []);
    await context.close();
  }
  console.log(
    JSON.stringify({ passed: true, widths: [320, 390, 768, 1440], output }),
  );
} finally {
  await browser.close();
}
