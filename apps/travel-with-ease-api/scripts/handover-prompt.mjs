// Run only in a private operator terminal. Assertions never enter argv/history.
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const [approvalReference] = process.argv.slice(2);
if (
  !process.stdin.isTTY ||
  process.env.APP_ENV !== "staging" ||
  process.argv.length !== 3 ||
  !/^[A-Za-z0-9][A-Za-z0-9._/-]{2,119}$/.test(approvalReference || "")
) {
  throw new Error(
    "Use a private interactive staging terminal and an approved reference. Production is not supported by this helper.",
  );
}
const muted = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});
const reader = createInterface({
  input: process.stdin,
  output: muted,
  terminal: true,
  historySize: 0,
});
let developerAssertion = "",
  clientAssertion = "";
const cancelled = new AbortController();
reader.on("SIGINT", () => cancelled.abort());
try {
  console.info(
    "STAGING ONLY: client becomes Owner; verified developer becomes Superadmin. Both must sign in again.",
  );
  process.stdout.write("Type STAGING HANDOVER to confirm (hidden): ");
  const answer = await reader.question("", { signal: cancelled.signal });
  // The reader is muted, including this confirmation, to keep all subsequent input private.
  if (answer !== "STAGING HANDOVER") throw new Error();
  process.stdout.write("Developer Access assertion (hidden): ");
  developerAssertion = (await reader.question("", { signal: cancelled.signal })).trim();
  process.stdout.write("\nClient Access assertion (hidden): ");
  clientAssertion = (await reader.question("", { signal: cancelled.signal })).trim();
  process.stdout.write("\n");
  reader.close();
  if (
    !developerAssertion ||
    !clientAssertion ||
    developerAssertion.length > 16000 ||
    clientAssertion.length > 16000
  )
    throw new Error();
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(new URL("./handover-developer.mjs", import.meta.url)),
      approvalReference,
      "--approved-handover",
    ],
    { stdio: ["pipe", "inherit", "inherit"], env: process.env },
  );
  child.stdin.on("error", () => {
    process.exitCode = 1;
  });
  child.stdin.end(JSON.stringify({ developerAssertion, clientAssertion }));
  developerAssertion = clientAssertion = "";
  child.on("error", () => {
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
} catch {
  console.error(
    "Handover input cancelled or invalid; no confirmed change. Check the audit history before retrying an uncertain result.",
  );
  process.exitCode = 1;
} finally {
  reader.close();
  developerAssertion = clientAssertion = "";
}
