import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { encodeSignatureHeader } from "@sanity/webhook";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
const config={origins:["https://ttngh.example"],enabled:true,secret:"test-only",hostnames:["ttngh.example"],resendKey:"test-only",from:"sender@example.org",to:"team@example.org",replyTo:"thethrivingnetwork@gmail.com",acknowledgement:false,trustedProxies:[],limit:100,windowMs:60000,webhookSecret:"test-webhook-only",buildHook:"https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/test",project:"fixture",dataset:"test"};
const input={name:"Test Visitor",email:"visitor@example.org",topic:"Events",message:"Please tell me about your next event.",consent:true,website:"",turnstileToken:"test-token",submissionId:"aa837d8f-9826-4a85-bb0e-9ee115847c02"};
function createTestStore() {
  const enquiries = new Map(), jobs = [];
  return {
    enquiries, jobs,
    async create(data, { acknowledgement }) {
      if (enquiries.has(data.submissionId)) return { created: false };
      enquiries.set(data.submissionId, data);
      const add = recipient_kind => jobs.push({
        id: jobs.length + 1, recipient_kind, submission_id: data.submissionId,
        name: data.name, email: data.email, topic: data.topic, message: data.message,
        lease_token: "test-lease", state: "queued", blocked: false,
      });
      add("staff");
      if (acknowledgement) add("visitor");
      return { created: true };
    },
    async claim(submissionId) {
      const job = jobs.find(j => j.state === "queued" && !j.blocked &&
        (!submissionId || j.submission_id === submissionId) &&
        (j.recipient_kind === "staff" ||
          jobs.some(s => s.submission_id === j.submission_id && s.recipient_kind === "staff" && s.state === "sent")));
      if (!job) return null;
      job.state = "sending";
      return job;
    },
    async sent(job, providerId) { job.state = "sent"; job.provider_id = providerId; },
    async failed(job) { job.state = "queued"; job.blocked = true; },
  };
}
async function withApi(t,request,overrides={}) {
  const { enquiryStore = createTestStore(), ...configOverrides } = overrides;
  const server = createApp({...config,...configOverrides},{request,enquiryStore}).listen(0,"127.0.0.1");
  await once(server,"listening");
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const post = async(body=input,options={})=>fetch(`http://127.0.0.1:${server.address().port}${options.path||"/api/enquiries"}`,{
    method:"POST",headers:{Origin:"https://ttngh.example","Content-Type":"application/json",...options.headers},
    body:typeof body==="string"?body:JSON.stringify(body)
  });
  post.store = enquiryStore;
  return post;
}
function provider({check={},mailOk=true,throwCheck=false}={}){const calls=[];return {calls,request:async(url,options)=>{calls.push({url,options});if(url.includes("siteverify")){if(throwCheck)throw new Error("test failure");return Response.json({success:true,hostname:"ttngh.example",action:"ttngh_enquiry",challenge_ts:new Date().toISOString(),...check});}return Response.json(mailOk?{id:"message-id"}:{error:"private provider error"},{status:mailOk?200:503});}};}
test("valid enquiry sends branded staff email with safe Reply-To", async t => {
  const mock = provider();
  const post = await withApi(t, mock.request);

  const response = await post();

  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.accepted, true);
  assert.equal(response.headers.get("cache-control"), "no-store, private");
  assert.ok(response.headers.get("x-request-id"));

  const mail = JSON.parse(mock.calls[1].options.body);

  assert.equal(
    mail.subject,
    `New TTNGH website enquiry — ${input.topic}`
  );

  assert.equal(mail.reply_to, input.email);
  assert.equal(mail.from, "The Thriving Network GH <sender@example.org>");
  assert.deepEqual(mail.to, [config.to]);

  // Plain-text fallback remains available.
  assert.equal(typeof mail.text, "string");
  assert.match(mail.text, /NEW WEBSITE ENQUIRY/);
  assert.match(mail.text, /Test Visitor/);
  assert.match(mail.text, /visitor@example\.org/);
  assert.match(mail.text, /Events/);
  assert.match(mail.text, /Please tell me about your next event\./);

  // Branded HTML version.
  assert.equal(typeof mail.html, "string");
  assert.match(mail.html, /The Thriving Network GH/);
  assert.match(mail.html, /Peace Over Everything\./);
  assert.match(mail.html, /ttngh-logo-transparent\.png/);
  assert.match(mail.html, /Test Visitor/);
  assert.match(mail.html, /visitor@example\.org/);
  assert.match(mail.html, /Events/);
  assert.match(mail.html, /Please tell me about your next event\./);

  assert.equal(mock.calls.length, 2);
  assert.equal(post.store.enquiries.size, 1);
  assert.equal(post.store.jobs[0].state, "sent");
});
test("invalid input, consent, injection and honeypot never contact providers",async t=>{const mock=provider();const post=await withApi(t,mock.request);for(const patch of [{name:"x"},{email:"a@example.org\r\nBcc:x@example.org"},{consent:false},{topic:"arbitrary"},{message:"short"},{website:"spam"},{extra:"field"},{turnstileToken:""}])assert.equal((await post({...input,...patch})).status,400);assert.equal(mock.calls.length,0);});
test("origins, content types, malformed and oversized bodies are rejected",async t=>{const mock=provider();const post=await withApi(t,mock.request);assert.equal((await post(input,{headers:{Origin:"https://evil.example"}})).status,403);assert.equal((await post(input,{headers:{"Content-Type":"text/plain"}})).status,415);assert.equal((await post("{invalid")).status,400);assert.equal((await post({...input,message:"x".repeat(20000)})).status,413);assert.equal(mock.calls.length,0);});
for(const [name,check]of Object.entries({failed:{success:false},expired:{challenge_ts:"2000-01-01T00:00:00Z"},hostname:{hostname:"evil.example"},action:{action:"other"},replay:{success:false,"error-codes":["timeout-or-duplicate"]}}))test(`Turnstile ${name} prevents email`,async t=>{const mock=provider({check});const post=await withApi(t,mock.request);assert.equal((await post()).status,400);assert.equal(mock.calls.length,1);});
test("replayed token cannot deliver twice",async t=>{let checks=0,mails=0;const post=await withApi(t,async url=>url.includes("siteverify")?Response.json({success:++checks===1,hostname:"ttngh.example",action:"ttngh_enquiry",challenge_ts:new Date().toISOString()}):(mails++,Response.json({id:"test"})));assert.equal((await post()).status,200);assert.equal((await post()).status,400);assert.equal(mails,1);});
test("Turnstile outage rejects without storing visitor details",async t=>{
  const mock=provider({throwCheck:true});const post=await withApi(t,mock.request);
  const res=await post();assert.equal(res.status,503);assert.equal(post.store.enquiries.size,0);
  assert.doesNotMatch(await res.text(),/test failure|test-token|visitor@/);
});
test("Resend outage retains enquiry and queues notification for retry",async t=>{
  const mock=provider({mailOk:false});const post=await withApi(t,mock.request);
  const res=await post();assert.equal(res.status,200);
  assert.equal((await res.json()).data.accepted,true);
  assert.equal(post.store.enquiries.size,1);
  assert.equal(post.store.jobs[0].state,"queued");
  assert.equal(post.store.jobs[0].blocked,true);
});
test("storage outage rejects the submission without sending email",async t=>{
  const mock=provider(); const post=await withApi(t,mock.request,{
    enquiryStore:{async create(){throw new Error("private database failure");}}
  });
  const res=await post();assert.equal(res.status,503);
  assert.equal(mock.calls.length,1);
  assert.doesNotMatch(await res.text(),/private database failure/);
});
test("valid duplicate submission ID does not enqueue duplicate notifications",async t=>{
  const mock=provider();const post=await withApi(t,mock.request);
  assert.equal((await post()).status,200);
  assert.equal((await post()).status,200);
  assert.equal(post.store.enquiries.size,1);
  assert.equal(post.store.jobs.length,1);
  assert.equal(mock.calls.filter(call=>call.url.includes("/emails")).length,1);
});
test("rate limit prevents repeated sends and returns retry guidance",async t=>{const mock=provider();const post=await withApi(t,mock.request,{limit:1});await post();const res=await post();assert.equal(res.status,429);assert.ok(res.headers.get("retry-after"));assert.equal(mock.calls.length,2);});
test("acknowledgements are branded and do not echo enquiry contents", async t => {
  const mock = provider();
  const post = await withApi(t, mock.request, {
    acknowledgement: true
  });

  assert.equal((await post()).status, 200);

  const ack = JSON.parse(mock.calls[2].options.body);

  assert.deepEqual(ack.to, [input.email]);
  assert.equal(ack.from,"The Thriving Network GH <sender@example.org>");
  assert.equal(ack.reply_to,"thethrivingnetwork@gmail.com");
  assert.equal(post.store.jobs[0].state,"sent");
  assert.equal(post.store.jobs[1].state,"sent");

  assert.equal(
    ack.subject,
    "We’ve received your enquiry | The Thriving Network GH"
  );

  // Plain-text fallback.
  assert.equal(typeof ack.text, "string");
  assert.match(ack.text, /Hello Test Visitor/);
  assert.match(ack.text, /The Thriving Network GH/);
  assert.match(ack.text, /Peace Over Everything\./);
  assert.match(ack.text, /DIDN’T SUBMIT THIS ENQUIRY/);

  // Never echo the visitor's submitted message back.
  assert.ok(!ack.text.includes(input.message));

  // HTML version.
  assert.equal(typeof ack.html, "string");
  assert.match(ack.html, /ttngh-logo-transparent\.png/);
  assert.match(ack.html, /The Thriving Network GH/);
  assert.match(ack.html, /Peace Over Everything\./);
  assert.match(ack.html, /Didn’t submit this enquiry\?/);

  // Same privacy rule for HTML.
  assert.ok(!ack.html.includes(input.message));
});
test("acknowledgement failure does not falsely report staff delivery failure",async t=>{let calls=0;const mock=provider();const post=await withApi(t,async(...args)=>++calls===3?new Response("",{status:503}):mock.request(...args),{acknowledgement:true});assert.equal((await post()).status,200);});
test("disabled service fails closed",async t=>{const mock=provider();const post=await withApi(t,mock.request,{enabled:false});assert.equal((await post()).status,503);assert.equal(mock.calls.length,0);});
test("Sanity signatures, freshness, dataset and duplicate delivery",async t=>{const mock=provider();const post=await withApi(t,mock.request);const body=JSON.stringify({id:"event-a",type:"event",projectId:"fixture",dataset:"test",revision:"revision-a"});const signature=await encodeSignatureHeader(body,Date.now(),config.webhookSecret);const options={path:"/api/webhooks/sanity",headers:{"sanity-webhook-signature":signature}};assert.equal((await post(body,options)).status,200);assert.equal((await post(body,options)).status,200);assert.equal(mock.calls.length,1);assert.equal((await post(body,{...options,headers:{"sanity-webhook-signature":"bad"}})).status,401);const stale=await encodeSignatureHeader(body,Date.now()-600000,config.webhookSecret);assert.equal((await post(body,{...options,headers:{"sanity-webhook-signature":stale}})).status,401);const wrong=JSON.stringify({id:"drafts.x",type:"event",projectId:"fixture",dataset:"test"});assert.equal((await post(wrong,{...options,headers:{"sanity-webhook-signature":await encodeSignatureHeader(wrong,Date.now(),config.webhookSecret)}})).status,400);});
test("webhook upstream failure permits retry",async t=>{let calls=0;const post=await withApi(t,async()=>new Response("",{status:++calls===1?503:200}));const body=JSON.stringify({id:"x",type:"partner",projectId:"fixture",dataset:"test",revision:"1"});const headers={"sanity-webhook-signature":await encodeSignatureHeader(body,Date.now(),config.webhookSecret)};assert.equal((await post(body,{path:"/api/webhooks/sanity",headers})).status,503);assert.equal((await post(body,{path:"/api/webhooks/sanity",headers})).status,200);});
test("configuration rejects wildcard origins, incomplete activation and unsafe hooks",()=>{assert.throws(()=>loadConfig({TTNGH_ALLOWED_ORIGINS:"*"}));assert.throws(()=>loadConfig({TTNGH_ALLOWED_ORIGINS:"https://example.org",TTNGH_CONTACT_ENABLED:"true"}));assert.throws(()=>loadConfig({TTNGH_ALLOWED_ORIGINS:"https://example.org",CLOUDFLARE_BUILD_HOOK_URL:"http://127.0.0.1"}));});
test("email HTML escapes visitor supplied content", async t => {
  const mock = provider();
  const post = await withApi(t, mock.request, {
    acknowledgement: true
  });

  const maliciousInput = {
    ...input,
    name: '<img src=x onerror="alert(1)">',
    message: '<script>alert("xss")</script> This is a sufficiently long message.'
  };

  const response = await post(maliciousInput);

  assert.equal(response.status, 200);

  const staff = JSON.parse(mock.calls[1].options.body);
  const acknowledgement = JSON.parse(mock.calls[2].options.body);

  // Raw user HTML must never appear in HTML emails.
  assert.ok(!staff.html.includes("<script>"));
  assert.ok(!staff.html.includes("<img src=x"));

  assert.match(staff.html, /&lt;script&gt;/);
  assert.match(staff.html, /&lt;img/);

  assert.ok(!acknowledgement.html.includes("<img src=x"));
  assert.match(acknowledgement.html, /&lt;img/);

  // Acknowledgement must still not repeat the submitted message.
  assert.ok(!acknowledgement.text.includes(maliciousInput.message));
  assert.ok(!acknowledgement.html.includes("sufficiently long message"));
});
test("acknowledgement is enabled by default for the complete contact setup",()=>{
  const active=loadConfig({
    TTNGH_ALLOWED_ORIGINS:"https://ttngh.example",TTNGH_CONTACT_ENABLED:"true",
    TTNGH_DATABASE_URL:"postgresql://test:test@localhost:5432/ttngh",
    TURNSTILE_SECRET_KEY:"test-secret",TURNSTILE_HOSTNAMES:"ttngh.example",
    RESEND_API_KEY:"test-api-key",TTNGH_MAIL_FROM:"sender@example.org",
    TTNGH_ENQUIRY_TO:"team@example.org"
  });
  assert.equal(active.acknowledgement,true);
  assert.equal(active.replyTo,"thethrivingnetwork@gmail.com");
});
