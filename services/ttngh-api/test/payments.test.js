import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { toPesewas, donationInput, paymentConfig, fingerprint, validSignature, verifiedState } from "../src/payments/rules.js";
import { createPaystack } from "../src/payments/paystack.js";
import { createDonationStore } from "../src/payments/store.js";
const reference = `ttngh-test-${"a".repeat(32)}`;
const intent = {reference,mode:"test",amount_pesewas:"125",email:"donor@example.org"};
const provider = {reference,domain:"test",amount:125,currency:"GHS",status:"success",id:123,paid_at:"2026-10-13T12:00:00Z"};
const input = {amount:"1.25",currency:"GHS",email:intent.email,consent:true,submissionId:"aa837d8f-9826-4a85-bb0e-9ee115847c02"};
test("GHS conversion is exact, minimum is one cedi, no fundraising cap",()=>{
  for(const [value,expected] of [["1",100],["1.01",101],["1000000",100000000],["90071992547409.91",Number.MAX_SAFE_INTEGER]]) assert.equal(toPesewas(value),expected);
  for(const value of ["0.99","0","-1","1.001","1e5","NaN","Infinity","01","1."," 1","90071992547409.92",1,null]) assert.throws(()=>toPesewas(value));
});
test("donor schema rejects currency, injection, credentials and missing consent",()=>{
  assert.equal(donationInput.safeParse(input).success,true);
  for(const patch of [{currency:"USD"},{email:"x@example.org\r\nBcc: x"},{consent:false},{card:"123"},{amount:"0.5"},{submissionId:"guess"}]) assert.equal(donationInput.safeParse({...input,...patch}).success,false);
  assert.equal(fingerprint(input),fingerprint({...input,amount:"1.250".slice(0,-1)}));
  assert.notEqual(fingerprint(input),fingerprint({...input,amount:"2"}));
});
test("payments are disabled by default and live mode fails closed",()=>{
  assert.deepEqual(paymentConfig({}),{enabled:false});
  const env={TTNGH_DONATIONS_ENABLED:"true",PAYSTACK_MODE:"test",PAYSTACK_SECRET_KEY:"sk_test_synthetic_only",TTNGH_DATABASE_URL:"postgresql://localhost/ttngh_test",TTNGH_DONATION_RETURN_URL:"https://preview.example.org/donate/return"};
  assert.equal(paymentConfig(env).mode,"test");
  for(const patch of [{PAYSTACK_MODE:"live"},{TTNGH_DATABASE_URL:""},{TTNGH_DONATION_RETURN_URL:"https://example.org/donate/return?next=evil"},{PAYSTACK_SECRET_KEY:"sk_live_synthetic_only"}]) assert.throws(()=>paymentConfig({...env,...patch}));
  const live={...env,PAYSTACK_MODE:"live",PAYSTACK_SECRET_KEY:"sk_live_synthetic_only",NODE_ENV:"production",TTNGH_LIVE_PAYMENTS_APPROVED:"true",TTNGH_DONATION_RETURN_URL:"https://thethrivingnetworkgh.org/donate/return"};
  assert.equal(paymentConfig(live).mode,"live");
  assert.throws(()=>paymentConfig({...live,NODE_ENV:"development"}));
  assert.throws(()=>paymentConfig({...live,TTNGH_LIVE_PAYMENTS_APPROVED:"false"}));
});
test("webhook signature checks exact raw bytes and rejects malformed signatures",()=>{
  const raw=Buffer.from('{"event":"charge.success"}'),key="synthetic-secret";
  const signature=createHmac("sha512",key).update(raw).digest("hex");
  assert.equal(validSignature(raw,signature,key),true);
  for(const value of ["", "bad", "0".repeat(128),undefined]) assert.equal(validSignature(raw,value,key),false);
  assert.equal(validSignature(Buffer.concat([raw,Buffer.from(" ")]),signature,key),false);
});
test("verification matches intent and requires complete success evidence",()=>{
  assert.equal(verifiedState(intent,provider),"paid");
  for(const patch of [{reference:"other"},{amount:124},{amount:"125"},{currency:"USD"},{domain:"live"},{id:null},{paid_at:null},{status:"reversed"}]) assert.throws(()=>verifiedState(intent,{...provider,...patch}));
  for(const status of ["pending","processing","ongoing","queued"]) assert.equal(verifiedState(intent,{...provider,status}),"pending");
  assert.equal(verifiedState(intent,{...provider,status:"failed"}),"failed");
  assert.equal(verifiedState(intent,{...provider,status:"abandoned"}),"abandoned");
});
test("hosted initialization sends only intended fields without unsafe retries",async()=>{
  let calls=0;
  const api=createPaystack({key:"synthetic",callback:"https://preview.example.org/donate/return"},async(url,options)=>{
    calls++;assert.equal(url,"https://api.paystack.co/transaction/initialize");assert.equal(options.redirect,"error");
    assert.deepEqual(JSON.parse(options.body),{email:intent.email,amount:"125",currency:"GHS",reference,callback_url:"https://preview.example.org/donate/return"});
    return Response.json({status:true,data:{reference,authorization_url:"https://checkout.paystack.com/test"}});
  });
  assert.equal((await api.initialize(intent)).checkoutUrl,"https://checkout.paystack.com/test");assert.equal(calls,1);
});
test("unsafe redirect URLs, mismatched references and outages are rejected",async()=>{
  for(const data of [{reference,authorization_url:"https://evil.example/test"},{reference,authorization_url:"https://checkout.paystack.com.evil.example/test"},{reference,authorization_url:"https://user:secret@checkout.paystack.com/test"},{reference:"wrong",authorization_url:"https://checkout.paystack.com/test"}]) await assert.rejects(createPaystack({},async()=>Response.json({status:true,data})).initialize(intent));
  let calls=0;await assert.rejects(createPaystack({},async()=>{calls++;return new Response("private provider details",{status:503});}).verify(reference),/Payment provider unavailable/);assert.equal(calls,1);
});
test("verification discards donor and payment instrument metadata",async()=>{
  const result=await createPaystack({},async()=>Response.json({status:true,data:{...provider,authorization:{authorization_code:"private"},customer:{email:intent.email}}})).verify(reference);
  assert.deepEqual(result,provider);
  await assert.rejects(createPaystack({},()=>assert.fail("must not call provider")).verify("../other"));
});
test("paid transition, audit and unique receipt enqueue share a transaction",async()=>{
  const queries=[];
  const client={query:async(sql,values)=>{queries.push({sql,values});if(sql.startsWith("SELECT"))return {rows:[{...intent,state:"pending"}]};if(sql.startsWith("UPDATE"))return {rows:[{...intent,state:"paid"}]};return {rows:[]};},release:()=>queries.push({sql:"RELEASE"})};
  const result=await createDonationStore({connect:async()=>client}).reconcile(reference,provider,"webhook","request-id");
  assert.equal(result.state,"paid");assert.equal(queries[0].sql,"BEGIN");assert.match(queries[1].sql,/FOR UPDATE/);assert.ok(queries.some(q=>q.sql.includes("receipts")&&q.sql.includes("ON CONFLICT DO NOTHING")));assert.equal(queries.at(-2).sql,"COMMIT");assert.equal(queries.at(-1).sql,"RELEASE");
});
test("duplicate success does not enqueue another receipt; mismatch rolls back",async()=>{
  const queries=[];
  const client={query:async sql=>{queries.push(sql);return {rows:[{...intent,state:"paid",provider_id:123}]};},release:()=>{}};
  const store=createDonationStore({connect:async()=>client});
  assert.equal((await store.reconcile(reference,provider,"verify","request-id")).state,"paid");
  assert.equal(queries.some(sql=>sql.startsWith("INSERT")),false);
  await assert.rejects(store.reconcile(reference,{...provider,amount:999},"webhook","request-id"));assert.equal(queries.at(-1),"ROLLBACK");
});
