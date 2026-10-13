import { contentIssues } from "../../src/lib/cms-validation.js";
import { text, choice, refs, ref, image, seo, slug, links } from "./fields.js";
const titled = [text("title", 120, true), slug, text("summary", 320, true), seo];
const date = name => ({ name, type: "datetime", validation: Rule => Rule.required() });
const bool = name => ({ name, type: "boolean", initialValue: false });
const order = { name: "sortOrder", type: "number", initialValue: 0 };
const documents = {
 siteSettings: [text("organisationName",120,true),text("tagline",120,true),text("summary",1000,true),text("email",160,true),text("phone",80),text("whatsapp",80),text("address",500),links("socials"),seo,text("registrationDetails",2000)],
 homePage: [text("heroTitle",120,true),text("heroSubtitle",320,true),text("introduction",2000,true),refs("featuredProgrammes",["programme"]),ref("featuredEvent","event"),refs("featuredUpdates",["newsArticle","resource"]),refs("impact",["impactStat"]),links("actions"),refs("partners",["partner"])],
 programme: [...titled,text("body",20000,true),text("category",120,true),text("audience",600,true),text("format",200,true),text("availability",500,true),text("location",500),image(),text("actionLabel",60),text("actionHref",2048),choice("safeguardingState",["pending","approved"]),text("owner",160,true)],
 event: [...titled,text("description",20000,true),date("start"),date("end"),{...text("timezone",80,true),initialValue:"Africa/Accra"},choice("format",["in-person","online"]),text("venue",180),text("address",400),text("onlineUrl",2048),text("registrationUrl",2048),choice("registrationState",["not-open","open","closed","not-required"]),{name:"capacity",type:"number",validation:Rule=>Rule.integer().positive()},bool("capacityApproved"),text("accessibility",1200,true),ref("relatedProgramme","programme"),image(),text("owner",160,true)],
 newsArticle: [...titled,text("body",20000,true),text("author",160,true),date("publishedAt"),image(),text("category",120),ref("relatedProgramme","programme")],
 resource: [...titled,text("body",20000,true),text("category",120),text("owner",160,true),text("author",160,true),text("reviewer",160,true),date("publishedAt"),date("lastReviewed"),choice("reviewState",["pending","approved"]),{name:"sources",type:"array",of:[{type:"object",fields:[text("title",200,true),{name:"url",type:"url",validation:Rule=>Rule.required().uri({scheme:["https"]})}]}]},bool("urgentSupportRelevant"),text("urgentSupportNotice",2000),refs("relatedResources",["resource"]),refs("relatedProgrammes",["programme"]),image()],
 teamMember: [text("name",120,true),text("role",160,true),text("biography",5000,true),image(),links("publicLinks"),bool("publicLinksApproved"),order,choice("consentStatus",["pending","approved","withdrawn"])],
 impactStat: [text("value",60,true),text("label",180,true),text("period",180,true),text("source",2000,true),text("owner",160,true),choice("verificationStatus",["pending","verified"])],
 partner: [text("name",120,true),image("logo"),text("link",2048),text("context",2000),order],
};
export const schemaTypes = Object.entries(documents).map(([name, fields]) => ({
 name, type:"document", title:name.replace(/([A-Z])/g," $1").replace(/^./,c=>c.toUpperCase()),
 fields:[choice("publishState",["draft","published"]),...fields], initialValue:{publishState:"draft"},
 validation:Rule=>Rule.custom(doc=>!doc || doc.publishState!=="published" || contentIssues(doc).join(" ") || true),
 preview:{select:{title:["siteSettings"].includes(name)?"organisationName":name==="homePage"?"heroTitle":name==="impactStat"?"label":["teamMember","partner"].includes(name)?"name":"title",media:name==="partner"?"logo":"image"}},
}));
