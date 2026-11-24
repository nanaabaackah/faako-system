import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (file) => readFileSync(new URL(file, import.meta.url), "utf8");

test("activation presents a clear invitation action without revealing identity implementation", () => {
  const activation = source("../src/components/Activation.jsx");
  assert.match(activation, /Activate your account/);
  assert.match(activation, /Signed in as/);
  assert.match(activation, /invitation\.expiresAt/);
  assert.match(activation, /invitation\.role/);
  assert.match(activation, /Check account status/);
  assert.match(activation, /\(error \|\| status\.status === "disabled"\)/);
  assert.doesNotMatch(activation, /Your identity has passed Cloudflare|Your role is determined by the invitation|Activate your approved account/);
});

test("global portal avoids duplicate success toasts, sign-out buttons and routine connection checks", () => {
  const app = source("../src/App.jsx");
  const account = source("../src/components/AccountSettings.jsx");
  assert.doesNotMatch(app, /The server confirmed the action|pushToast|updateToast/);
  assert.match(app, /!dirty && state\.error/);
  assert.doesNotMatch(app, /Sign out all devices/);
  assert.match(account, /Sign out all devices/);
});

test("media and CMS copy do not expose developer or infrastructure setup details", () => {
  const media = source("../src/components/MediaLibrary.jsx");
  const contentEditor = source("../src/components/WebsiteContent.jsx");
  assert.doesNotMatch(media, /Baaba|R2 setup before uploads|notification worker/);
  assert.match(media, /Media uploads are unavailable/);
  assert.doesNotMatch(contentEditor, /November 16 two-path process|Re-select managed R2 images|free-checklist offers/);
  assert.match(contentEditor, /The site changes only after deployment is verified/);
  assert.doesNotMatch(contentEditor, /Your update is live only after deployment succeeds/);
});

test("Help menu retains all tutorial actions but does not show five controls by default", () => {
  const tutorials = source("../src/components/TutorialWorkspace.jsx");
  const menuStart = tutorials.indexOf('<details className="tutorial-menu">');
  const menuEnd = tutorials.indexOf("</details>", menuStart);
  assert.ok(menuStart >= 0 && menuEnd > menuStart);
  const contents = tutorials.slice(menuStart, menuEnd);
  for (const label of [
    "Tutorial Mode:", "View available tutorials", "Resume tutorial",
    "Restart tutorial", "Mark tutorial completed",
  ]) assert.ok(contents.includes(label), `Missing ${label} from Help disclosure`);
  assert.match(contents, /Help &amp; tutorials/);
  assert.doesNotMatch(tutorials, /Introduction completed\. Tutorials remain available/);
});

test("website removes technical configuration prose while keeping consent and pricing requirements", () => {
  const form = source("../../travel-with-ease-web/src/components/EnquiryForm.jsx");
  const wizard = source("../../travel-with-ease-web/src/components/EnquiryWizard.jsx");
  const cookie = source("../../travel-with-ease-web/src/components/CookieNotice.astro");
  const service = source("../../travel-with-ease-web/src/pages/services/[slug].astro");
  const packageDetail = source("../../travel-with-ease-web/src/components/PackageDetail.astro");
  assert.doesNotMatch(form + wizard, /security check needs configuration/);
  assert.match(form, /enquiry-consent/);
  assert.match(wizard, /enquiry-consent/);
  assert.match(cookie, /data-cookie-essential/);
  assert.match(cookie, /data-cookie-analytics/);
  assert.match(cookie, /Cookie settings in the footer/);
  assert.doesNotMatch(cookie, /Your privacy, your choice/);
  assert.doesNotMatch(service, /Let’s start with your plans|Your approximate budget and the support you need/);
  assert.match(packageDetail, /per person sharing/i);
  assert.match(packageDetail, /booking/i);
});
