import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./schema/index.js";
const projectId = process.env.SANITY_STUDIO_PROJECT_ID;
const dataset = process.env.SANITY_STUDIO_DATASET;
if (!projectId || !dataset) throw new Error("Configure SANITY_STUDIO_PROJECT_ID and SANITY_STUDIO_DATASET");
const singletons = ["siteSettings", "homePage"];
export default defineConfig({
 name:"ttngh",title:"The Thriving Network GH",projectId,dataset,
 plugins:[structureTool({structure:S=>S.list().title("TTNGH content").items([
   ...singletons.map(type=>S.listItem().id(type).title(type==="homePage"?"Homepage":"Site settings").child(S.document().schemaType(type).documentId(type))),
   ...S.documentTypeListItems().filter(item=>!singletons.includes(item.getId())),
 ])})],
 schema:{types:schemaTypes,templates:templates=>templates.filter(template=>!singletons.includes(template.schemaType))},
 document:{actions:(actions,context)=>singletons.includes(context.schemaType)?actions.filter(action=>!["duplicate","delete"].includes(action.action)):actions},
});
