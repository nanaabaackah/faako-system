import { parentPort, workerData } from "node:worker_threads";
import { normalizeCalendar } from "./normalize.js";
try { parentPort.postMessage({ events: normalizeCalendar(workerData.ics, workerData.from, workerData.to) }); }
catch { parentPort.postMessage({ error: true }); }
