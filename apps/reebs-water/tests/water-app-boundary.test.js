import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readWaterSource = (path) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

test("the Water API example is an absolute HTTPS origin, not a relative hostname", () => {
  const example = readWaterSource("../.env.example");
  const value = example.match(/^VITE_API_BASE_URL=(.*)$/m)?.[1].trim();
  assert.ok(value);
  const origin = new URL(value);
  assert.equal(origin.protocol, "https:");
  assert.equal(origin.origin, value);
});

test("Water shares the REEBS sidebar styling, not Portal business code", () => {
  const navigation = readWaterSource("../src/components/WaterNavigation.jsx");
  assert.match(navigation, /portal-sidebar__panel/);
  assert.match(navigation, /SidebarEdgeToggle/);
  assert.doesNotMatch(navigation, /ErpNavSidebar|reebs-portal/);
  assert.match(readWaterSource("../src/main.jsx"), /@faako\/ui\/reebs-sidebar.css/);
  assert.equal(readWaterSource("../../reebs-portal/src/components/PortalSidebar/PortalSidebar.css").trim(), '@import "@faako/ui/reebs-sidebar.css";');
});

test("Water has an independent entry point and uses the shared credentialed API client", () => {
  const app = readWaterSource("../src/App.jsx");
  const apiClient = readWaterSource("../src/api/client.js");
  const manifest = JSON.parse(readWaterSource("../package.json"));

  assert.match(app, /BrowserRouter/);
  assert.match(app, /\["\/", "\/orders", "\/customers", "\/stock"\]/);
  assert.match(app, /path="\/sales" element={<Navigate to="\/orders\?new=1" replace/);
  assert.match(app, /WaterLogin/);
  assert.match(apiClient, /credentials:\s*["']include["']/);
  assert.equal(manifest.name, "@faako/reebs-water");
  assert.equal(manifest.dependencies["@faako/auth"], "workspace:*");
  assert.equal(manifest.dependencies["@faako/water-domain"], "workspace:*");
});

test("the Water UI no longer imports Portal-owned frontend code", () => {
  const page = readWaterSource("../src/pages/Water/AdminWater.jsx");
  const components = [
    "WaterCustomerPicker.jsx",
    "WaterCollectionModal.jsx",
    "WaterKpiGrid.jsx",
    "WaterLedgerEditorModal.jsx",
    "WaterLedgersSection.jsx",
    "WaterOperationsGrid.jsx",
    "WaterOrderEditorModal.jsx",
    "WaterOrderFormCard.jsx",
    "WaterPricingCard.jsx",
    "WaterRestockCard.jsx",
  ].map((name) => readWaterSource(`../src/pages/Water/components/${name}`)).join("\n");
  const source = `${page}\n${components}`;

  assert.doesNotMatch(source, /apps\/reebs-portal|\/src\/components\/|\/src\/icons\/iconSet/);
});

test("restocking exposes the three current prices while keeping purchase cost separate", () => {
  const source = readWaterSource("../src/pages/Water/components/WaterRestockCard.jsx");

  for (const label of ["Retail Price", "Company Price", "Bulk Price"]) {
    assert.ok(source.includes(label), `${label} should be editable while restocking`);
  }
  assert.match(source, /Purchase cost per pack/);
  assert.doesNotMatch(source, /effective date|upcoming price|schedule price/i);
});
