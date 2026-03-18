/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tasks = [
  { label: "Vendors", script: "importVendors.js" },
  { label: "Products", script: "importProducts.js" },
  { label: "Users & Customers", script: "importOrders.js" },
  { label: "Expenses + Maintenance", script: "importExpenses.js" },
  { label: "Timesheets", script: "importTimesheets.js" },
];

const runTask = ({ label, script }) => {
  const scriptPath = path.join(__dirname, script);
  console.log(`\n▶️  Running ${label} (${script})`);
  execFileSync("node", [scriptPath], { stdio: "inherit" });
};

try {
  for (const task of tasks) {
    runTask(task);
  }
  console.log("\n✅ All imports completed.");
} catch (err) {
  console.error("\n❌ Import runner failed.");
  process.exit(1);
}
