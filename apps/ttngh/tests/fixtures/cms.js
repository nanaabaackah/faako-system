// Synthetic fixtures only. Never imported by public application modules.
import { fixtureEvent } from "./event.js";
const image = fixtureEvent.image;
const seo = {description:"Synthetic publication for isolated automated verification, never approved public TTNGH content."};
const base = {publishState:"published",summary:"Synthetic summary for local verification only.",body:"Synthetic body.\n\nSecond paragraph for template verification.",seo,image};
export const fixtureDocuments = [
  {...base,_type:"programme",_id:"fixture-programme",title:"Fixture programme",slug:{current:"fixture-programme"},category:"Education",audience:"Fixture audience",format:"Fixture format",availability:"Fixture availability",owner:"Test owner",safeguardingState:"approved"},
  {...base,_type:"newsArticle",_id:"fixture-news",title:"Fixture news",slug:{current:"fixture-news"},seo:{description:"A synthetic news record for isolated automated rendering checks; not a real publication."},author:"Test author",publishedAt:"2026-01-01T12:00:00Z",relatedProgramme:"fixture-programme"},
  {...base,_type:"resource",_id:"fixture-resource",title:"Fixture resource",slug:{current:"fixture-resource"},seo:{description:"A synthetic resource used to check approved review metadata and linked sources in the template."},author:"Test author",owner:"Test owner",reviewer:"Test reviewer",reviewState:"approved",lastReviewed:"2026-01-02T12:00:00Z",publishedAt:"2026-01-01T12:00:00Z",sources:[{title:"Test source",url:"https://example.org/source"}],relatedProgrammes:["fixture-programme"]},
  {_type:"siteSettings",_id:"siteSettings",publishState:"published",organisationName:"TTNGH QA fixture",tagline:"Fixture tagline",summary:"Synthetic organisation summary",email:"test@example.org",registrationDetails:"Synthetic registration details for template verification only."},
  {_type:"homePage",_id:"homePage",publishState:"published",heroTitle:"Fixture homepage",heroSubtitle:"Synthetic subtitle",introduction:"Synthetic introduction",featuredProgrammes:["fixture-programme"],featuredEvent:fixtureEvent._id,featuredUpdates:["fixture-news","fixture-resource"],impact:["fixture-stat"],partners:["fixture-partner"],actions:[{label:"Explore fixture programme",href:"/programmes/fixture-programme"}]},
  {_type:"impactStat",_id:"fixture-stat",publishState:"published",value:"10",label:"Fixture count",period:"Test period",source:"Test source",owner:"Test owner",verificationStatus:"verified"},
  {_type:"teamMember",_id:"fixture-person",publishState:"published",name:"Fixture person",role:"Fixture role",biography:"Approved test biography",image,consentStatus:"approved",sortOrder:1},
  {_type:"partner",_id:"fixture-partner",publishState:"published",name:"Fixture partner",logo:image,context:"Test context",link:"https://example.org",sortOrder:1},
];
export const fixtureEvents = [{...fixtureEvent,relatedProgramme:"Fixture programme",relatedProgrammeSlug:"fixture-programme",capacity:20,capacityApproved:true}];
