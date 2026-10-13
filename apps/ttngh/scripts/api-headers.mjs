import { readFile, writeFile } from "node:fs/promises";
export default function apiHeaders(){return {name:"ttngh-api-headers",hooks:{"astro:build:done":async({dir})=>{
 const contact=await readFile(new URL("contact/index.html",dir),"utf8");
 const origin=contact.match(/data-api="([^"]*)"/)?.[1];
 if(!origin)return;
 const parsed=new URL(origin);
 if(parsed.protocol!=="https:"||parsed.origin!==origin)throw new Error("Invalid API CSP origin");
 const file=new URL("_headers",dir);
 const headers=await readFile(file,"utf8");
 await writeFile(file,headers.replace("connect-src 'self'",`connect-src 'self' ${origin}`));
}}};}
