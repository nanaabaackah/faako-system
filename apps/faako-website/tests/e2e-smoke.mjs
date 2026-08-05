import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium } from "playwright";

const baseUrl = process.env.FAAKO_PREVIEW_URL || "http://127.0.0.1:4176";
const localChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (existsSync(localChrome) ? localChrome : undefined);

const routes = [
  "/",
  "/about",
  "/case-studies",
  "/client-setup",
  "/configure",
  "/contact",
  "/dashboard",
  "/forgot-password",
  "/login",
  "/modules/crm",
  "/modules/delivery",
  "/modules/hr",
  "/modules/inventory",
  "/modules/reports",
  "/modules/website",
  "/pricing",
  "/privacy",
  "/signup",
  "/solutions",
  "/terms",
];

const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
});

const waitForIsland = (page, componentName) =>
  page.waitForFunction(
    (name) => {
      const island = Array.from(document.querySelectorAll("astro-island")).find(
        (item) => item.getAttribute("component-url")?.includes(name),
      );
      return Boolean(island && !island.hasAttribute("ssr"));
    },
    componentName,
  );

try {
  const context = await browser.newContext();

  for (const route of routes) {
    const page = await context.newPage();
    const runtimeErrors = [];
    await page.addInitScript(() => {
      window.addEventListener("astro:hydration-error", (event) => {
        console.error(
          `Astro hydration failed: ${event.detail?.error?.message || "unknown error"} (${event.detail?.componentUrl || "unknown island"})`,
        );
      });
    });
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });

    const response = await page.goto(`${baseUrl}${route}`, {
      waitUntil: "domcontentloaded",
    });
    assert.equal(response?.status(), 200, `${route} did not return 200`);
    assert.ok((await page.title()).trim(), `${route} has no title`);
    assert.ok(await page.locator("h1").first().isVisible(), `${route} has no visible h1`);
    await page.waitForTimeout(route === "/" ? 1800 : 350);
    assert.deepEqual(runtimeErrors, [], `${route} reported browser errors`);
    await page.close();
  }

  await context.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await waitForIsland(mobilePage, "SiteHeaderIsland");
  const navToggle = mobilePage.getByRole("button", { name: "Toggle navigation" });
  await navToggle.click();
  assert.equal(await navToggle.getAttribute("aria-expanded"), "true");
  assert.ok(await mobilePage.getByRole("link", { name: "Get started free" }).first().isVisible());
  await mobilePage.keyboard.press("Escape");
  assert.equal(await navToggle.getAttribute("aria-expanded"), "false");
  const rejectOptional = mobilePage.getByRole("button", { name: "Reject optional" });
  if (await rejectOptional.isVisible()) await rejectOptional.click();

  await mobilePage.goto(`${baseUrl}/contact`, { waitUntil: "domcontentloaded" });
  await waitForIsland(mobilePage, "ContactIsland");
  const contactForm = mobilePage.locator("form.contact-form-card");
  await contactForm.locator('[name="firstName"]').fill("Ama");
  await contactForm.locator('[name="lastName"]').fill("Mensah");
  await contactForm.locator('[name="email"]').fill("ama@example.com");
  await contactForm.locator('[name="phone"]').fill("12");
  await contactForm.locator('[name="message"]').fill("Please help us plan a system.");
  await contactForm.evaluate((form) => form.requestSubmit());
  await contactForm.getByText("Check the form").waitFor({ state: "visible" });
  await contactForm.locator('[name="phone"]').fill("55 500 0111");
  await contactForm.locator('[name="website"]').evaluate((input) => {
    input.value = "https://bot.invalid";
  });
  await contactForm.evaluate((form) => form.requestSubmit());
  await contactForm.getByText("Email hand-off started").waitFor({ state: "visible" });

  await mobilePage.goto(`${baseUrl}/signup`, { waitUntil: "domcontentloaded" });
  await waitForIsland(mobilePage, "SignupIsland");
  await mobilePage.getByRole("button", { name: "Continue" }).click();
  await mobilePage.locator(".signup-status-panel--error").waitFor({ state: "visible" });
  await mobile.close();

  const noJavaScript = await browser.newContext({ javaScriptEnabled: false });
  const noJavaScriptPage = await noJavaScript.newPage();
  const noJavaScriptResponse = await noJavaScriptPage.goto(`${baseUrl}/about`);
  assert.equal(noJavaScriptResponse?.status(), 200);
  assert.ok(await noJavaScriptPage.locator("h1").isVisible());
  assert.equal(
    await noJavaScriptPage.getByRole("link", { name: "Skip to content" }).count(),
    1,
  );
  await noJavaScript.close();

  const missing = await browser.newPage();
  const missingResponse = await missing.goto(`${baseUrl}/not-a-real-faako-route`);
  assert.equal(missingResponse?.status(), 404);
  assert.ok(await missing.locator("h1").isVisible());
  await missing.close();

  console.log(`Verified ${routes.length} public routes, mobile navigation/forms, no-JS content, and 404 handling.`);
} finally {
  await browser.close();
}
