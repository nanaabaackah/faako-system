import { validateCmsDocuments } from "./cms-validation.js";
const imageProjection = `{"url": asset->url,"width":asset->metadata.dimensions.width,"height":asset->metadata.dimensions.height,alt}`;
const query = `*[_type in ["siteSettings","homePage","programme","newsArticle","resource","teamMember","impactStat","partner"] && publishState == "published" && !(_id in path("drafts.**")) && !(_id in path("versions.**"))]{
_id,_type,publishState,title,slug,summary,body,seo{...,"socialImage":select(defined(socialImage.asset)=>socialImage${imageProjection})},organisationName,tagline,email,phone,whatsapp,address,socials,registrationDetails,
heroTitle,heroSubtitle,introduction,actions,"featuredProgrammes":featuredProgrammes[]._ref,"featuredEvent":featuredEvent._ref,"featuredUpdates":featuredUpdates[]._ref,"impact":impact[]._ref,"partners":partners[]._ref,
category,audience,format,availability,location,actionLabel,actionHref,safeguardingState,owner,author,publishedAt,reviewer,lastReviewed,reviewState,sources,urgentSupportRelevant,urgentSupportNotice,
"relatedProgramme":relatedProgramme._ref,"relatedProgrammes":relatedProgrammes[]._ref,"relatedResources":relatedResources[]._ref,
name,role,biography,publicLinks,publicLinksApproved,consentStatus,sortOrder,value,label,period,source,verificationStatus,link,context,
"image":select(defined(image.asset)=>image${imageProjection}),"logo":select(defined(logo.asset)=>logo${imageProjection})
}`;
let cached;
const buildEnv = import.meta.env || {};
export async function fetchCmsDocuments(env, request = fetch) {
 const project=env.SANITY_PROJECT_ID?.trim(),dataset=env.SANITY_DATASET?.trim();
 if(!project&&!dataset&&env.TTNGH_CMS_REQUIRED!=="true")return [];
 if(!/^[a-z0-9]+$/.test(project||"")||!/^[a-z0-9_-]+$/.test(dataset||""))throw new Error("Configure the TTNGH Sanity project and dataset");
 const url=new URL(`https://${project}.api.sanity.io/v2025-02-19/data/query/${dataset}`);
 url.searchParams.set("query",query);url.searchParams.set("perspective","published");
 const response=await request(url,{headers:env.SANITY_READ_TOKEN?{Authorization:`Bearer ${env.SANITY_READ_TOKEN}`}:{},signal:AbortSignal.timeout(15000),redirect:"error"});
 if(!response.ok)throw new Error("CMS unavailable; deployment stopped");
 return validateCmsDocuments((await response.json()).result);
}
export function getCmsDocuments(){return cached??=fetchCmsDocuments(buildEnv);}
export const cmsConfigured = Boolean(buildEnv.SANITY_PROJECT_ID || buildEnv.SANITY_DATASET || buildEnv.TTNGH_CMS_REQUIRED === "true");
export async function contentOfType(type){return (await getCmsDocuments()).filter(doc=>doc._type===type).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));}
export const contentPath=doc=>`/${{programme:"programmes",newsArticle:"news",resource:"resources"}[doc._type]}/${doc.slug.current}`;
