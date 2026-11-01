import {open} from "node:fs/promises";
import {resolve} from "node:path";
import {createDrive} from "../src/media-sync/drive.js";
import {mediaConfig,syncMedia} from "../src/media-sync/sync.js";

let store, reportFile;
try {
  const args=process.argv.slice(2);
  const apply=args.includes("--apply");
  const reportIndex=args.indexOf("--report");
  if(reportIndex<0 || !args[reportIndex+1] || args.some((arg,index)=>arg!=="--apply" && arg!=="--report" && index!==reportIndex+1))throw new Error("Use media:sync [--apply] --report /absolute/private/inventory.json");
  const reportPath=resolve(args[reportIndex+1]);
  if(!reportPath.endsWith(".json"))throw new Error("Inventory report must be a JSON file");
  const config=mediaConfig(process.env,{apply});
  // Exclusive create: never overwrite an old review inventory or follow a symlink.
  reportFile=await open(reportPath,"wx",0o600);
  let transform;
  if(apply) {
    const [{createR2},{imageVariants}]=await Promise.all([import("../src/media-sync/r2.js"),import("../src/media-sync/images.js")]);
    store=createR2(config);transform=imageVariants;
  }
  const report=await syncMedia({drive:createDrive(config.serviceAccount),store,transform,config,apply});
  await reportFile.writeFile(JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({mode:report.mode,environment:report.environment,files:report.entries.length,eligible:report.entries.filter(entry=>entry.status!=="excluded").length,uploaded:report.uploaded,existing:report.existing,report:reportPath}));
} catch {
  // No provider body, credential, private key or source filename reaches routine logs.
  console.error("TTNGH media sync stopped. Check server configuration, read-only Drive access, report path and provider availability. No source files or existing objects were removed.");
  process.exitCode=1;
} finally {await reportFile?.close();store?.close();}
