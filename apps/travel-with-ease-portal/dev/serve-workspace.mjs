import { createWorkspaceServer } from "./workspace-server.js";
const server = createWorkspaceServer(process.env);
server.listen(3090, "127.0.0.1", () => console.info("Isolated TWE workspace API: http://127.0.0.1:3090. No database, mail, Drive or publishing."));
server.on("error", error => {
  console.error(error.code === "EADDRINUSE" ? "Local workspace port 3090 is unavailable. Stop the existing dev:twe process first." : "Could not bind the loopback workspace server. Check local execution permissions.");
  process.exitCode = 1;
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close());
