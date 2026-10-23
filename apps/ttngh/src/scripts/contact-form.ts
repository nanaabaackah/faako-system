import { createBrowserApiClient } from "@faako/api-client/browser";
import { setAsyncButtonState } from "../lib/async-button.js";
type Turnstile = { render: (element: Element, options: Record<string, unknown>) => string; reset: (id: string) => void };
const form = document.querySelector<HTMLFormElement>("[data-contact-form]");
if (form?.dataset.api && form.dataset.sitekey) {
 const submit=form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
 const status=form.querySelector<HTMLElement>("[data-form-status]")!;
 const load=form.querySelector<HTMLButtonElement>("[data-load-verification]")!;
 const container=form.querySelector<HTMLElement>("[data-turnstile]")!;
 const fields=form.querySelector<HTMLFieldSetElement>("fieldset")!;
 const client=createBrowserApiClient({baseUrl:form.dataset.api,credentials:"omit"});
 let token="",widget="",provider:Turnstile|undefined,busy=false,submissionId=crypto.randomUUID();
 let deliveryOutcome="";
 const topics:Record<string,string>={events:"Events",volunteering:"Volunteering",donations:"Donations",partnerships:"Partnerships",privacy:"Privacy question"};
 const selected=topics[new URLSearchParams(location.search).get("topic")||""];
 if(selected)(form.elements.namedItem("topic") as HTMLSelectElement).value=selected;
 form.addEventListener("input",()=>{if(!busy){submissionId=crypto.randomUUID();deliveryOutcome="";setAsyncButtonState(submit,"idle");submit.disabled=!token;}});
 load.addEventListener("click",()=>{
  load.disabled=true; status.textContent="Loading security check…";
  const script=document.createElement("script");script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";script.async=true;
  script.addEventListener("load",()=>{
   provider=(window as Window & {turnstile?:Turnstile}).turnstile;
   if(!provider){status.textContent="Security check unavailable. Please try again later.";load.disabled=false;script.remove();return;}
   widget=provider.render(container,{sitekey:form.dataset.sitekey,action:"ttngh_enquiry",size:"flexible",callback:(value:string)=>{token=value;submit.disabled=busy;if(!deliveryOutcome)status.textContent="Security check complete.";},"expired-callback":()=>{token="";submit.disabled=true;if(!deliveryOutcome)status.textContent="Security check expired. Please complete it again.";},"error-callback":()=>{token="";submit.disabled=true;if(!deliveryOutcome)status.textContent="Security check failed. Please try again.";}});
   load.hidden=true;
  },{once:true});
  script.addEventListener("error",()=>{status.textContent="Unable to load security check. Please try again.";load.disabled=false;script.remove();},{once:true});
  document.head.append(script);
 });
 form.addEventListener("submit",async event=>{
  event.preventDefault();
  if(busy)return;
  if(!form.reportValidity()){status.textContent="Please complete the required fields.";return;}
  if(!token){status.textContent="Please complete the security check.";return;}
  deliveryOutcome="";busy=true;submit.disabled=true;setAsyncButtonState(submit,"working");form.setAttribute("aria-busy","true");status.textContent="Sending your enquiry…";
  const data=new FormData(form);
  fields.disabled=true;
  try {
   await client.post("/api/enquiries",{json:{name:String(data.get("name")||"").trim(),email:String(data.get("email")||"").trim(),topic:data.get("topic"),message:String(data.get("message")||"").trim(),website:String(data.get("website")||""),consent:data.get("consent")==="on",turnstileToken:token,submissionId},signal:AbortSignal.timeout(30000)});
   form.reset();submissionId=crypto.randomUUID();deliveryOutcome="Thank you. Your enquiry has been sent to the TTNGH team.";status.textContent=deliveryOutcome;setAsyncButtonState(submit,"success");
  } catch {
   deliveryOutcome="Delivery could not be confirmed. Please complete a new security check and try again, or use the contact details on this page.";status.textContent=deliveryOutcome;setAsyncButtonState(submit,"error");
  } finally {busy=false;fields.disabled=false;token="";submit.disabled=submit.dataset.asyncState!=="error";form.removeAttribute("aria-busy");provider?.reset(widget);status.focus();}
 });
}
