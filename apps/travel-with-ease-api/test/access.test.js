import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, SignJWT, createLocalJWKSet, exportJWK } from "jose";
import { readAccessConfig } from "../src/auth/access-config.js";
import { createAccessVerifier } from "../src/auth/access.js";
import { accessFailureReason } from "../src/auth/access-diagnostics.js";
import { ROLE_PERMISSIONS, hasPermission, validSupportGrant } from "../src/auth/permissions.js";
import { once } from "node:events";
import { createApp, createLimiter } from "../src/app.js";
import { createStaffAuth } from "../src/auth/routes.js";

const env={APP_ENV:"test",TWE_AUTH_MODE:"cloudflare_access",TWE_ACCESS_TEAM_DOMAIN:"https://synthetic.cloudflareaccess.com",TWE_ACCESS_AUDIENCE:"a".repeat(64),TWE_PORTAL_ORIGIN:"http://localhost:5188"};
test("Access config fails closed; never infers OIDC or development auth",()=>{
  assert.equal(readAccessConfig({}),null);
  const settings=readAccessConfig(env);assert.equal(settings.secure,false);
  for(const changes of [{TWE_AUTH_MODE:"oidc"},{TWE_ACCESS_AUDIENCE:""},{TWE_ACCESS_TEAM_DOMAIN:"https://synthetic.cloudflareaccess.com.attacker.invalid"},{TWE_ACCESS_TEAM_DOMAIN:"https://synthetic.cloudflareaccess.com/path"},{TWE_PORTAL_ORIGIN:"https://user:secret@portal.invalid"},{TWE_OIDC_CLIENT_SECRET:"synthetic"},{APP_ENV:"production"}]) assert.throws(()=>readAccessConfig({...env,...changes}));
});
test("cryptographic Access validation rejects forged, expired, wrong-app and service identities",async()=>{
  const pair=await generateKeyPair("RS256");const other=await generateKeyPair("RS256");
  const jwk={...await exportJWK(pair.publicKey),kid:"test-key",alg:"RS256"};
  const verifier=createAccessVerifier(readAccessConfig(env),createLocalJWKSet({keys:[jwk]}));
  const now=Math.floor(Date.now()/1000);
  const claims={iss:env.TWE_ACCESS_TEAM_DOMAIN,aud:[env.TWE_ACCESS_AUDIENCE],sub:"stable-subject",email:"test@example.invalid",type:"app",identity_nonce:"synthetic",iat:now,nbf:now,exp:now+300};
  const sign=(changes={},header={},key=pair.privateKey)=>new SignJWT({...claims,...changes}).setProtectedHeader({alg:"RS256",kid:"test-key",typ:"JWT",...header}).sign(key);
  const valid=await verifier.verify(await sign());assert.equal(valid.subject,"stable-subject");assert.equal(valid.audience,env.TWE_ACCESS_AUDIENCE);
  for(const change of [{iss:"https://other.cloudflareaccess.com"},{aud:["b".repeat(64)]},{aud:[env.TWE_ACCESS_AUDIENCE,"extra"]},{exp:now-1},{nbf:now+60},{iat:now+60},{type:"org"},{sub:""},{identity_nonce:undefined},{service_token_id:"machine"},{common_name:"machine.access"},{exp:undefined}]) await assert.rejects(verifier.verify(await sign(change)));
  // Safe diagnostics identify which *verified* shape check rejected the JWT.
  for (const [change, expected] of [
    [{type:"org"}, "app_type_invalid"],
    [{aud:env.TWE_ACCESS_AUDIENCE}, "audience_shape_invalid"],
    [{sub:""}, "subject_invalid"],
    [{identity_nonce:undefined}, "identity_nonce_missing"],
    [{common_name:"machine.access"}, "service_identity_detected"],
    [{iat:now+60}, "issued_in_future"],
  ]) {
    try {
      await verifier.verify(await sign(change));
      assert.fail(`A JWT with ${expected} must be rejected`);
    } catch (error) {
      assert.equal(accessFailureReason(error), expected);
    }
  }
  try {
    await verifier.verify(await sign({}, {typ:"other"}));
    assert.fail("Unexpected JWT type accepted");
  } catch (error) {
    assert.equal(accessFailureReason(error), "jwt_type_invalid");
  }
  await assert.rejects(verifier.verify(await sign({}, {typ:"other"})));
  await assert.rejects(verifier.verify(await sign({}, {}, other.privateKey)));
  for(const token of [undefined,"", "x.y.z", "a".repeat(17000)]) await assert.rejects(verifier.verify(token));
  const rotated={...await exportJWK(other.publicKey),kid:"rotated-key",alg:"RS256"};
  const rotating=createAccessVerifier(readAccessConfig(env),createLocalJWKSet({keys:[jwk,rotated]}));
  assert.equal((await rotating.verify(await sign({}, {kid:"rotated-key"},other.privateKey))).subject,"stable-subject");
});
test("permission matrix has no technical-to-business inheritance or cross-tenant authority",()=>{
  for(const role of Object.keys(ROLE_PERMISSIONS)) {
    const actor={id:"actor",role,organisationId:"tenant-a"};
    for(const permission of ROLE_PERMISSIONS[role]) {assert.equal(hasPermission(actor,permission,"tenant-a"),true);assert.equal(hasPermission(actor,permission,"tenant-b"),false);}
  }
  const actor={id:"actor",role:"platform_admin",organisationId:"tenant-a"};
  for(const permission of ["content.read","content.publish","enquiries.read","staff.manage","support.approve"])assert.equal(hasPermission(actor,permission,"tenant-a"),false);
  assert.equal(hasPermission({...actor,role:"owner"},"system.read","tenant-a"),false);
  assert.equal(hasPermission({...actor,role:"editor"},"content.publish","tenant-a"),false);
  assert.equal(hasPermission({...actor,role:"__proto__"},"anything","tenant-a"),false);
});
test("support elevation is bounded, revocable, tenant-scoped, approved and read-only",()=>{
  const now=Date.now(),actor={id:"platform",role:"platform_admin",organisationId:"tenant-a"};
  const grant={organisation_id:"tenant-a",user_id:"platform",approved_by:"owner",permission:"enquiries.read",reason_reference:"SUP-123",created_at:new Date(now-1000).toISOString(),expires_at:new Date(now+60000).toISOString()};
  assert.equal(validSupportGrant(grant,actor,"enquiries.read","tenant-a",now),true);
  for(const change of [{organisation_id:"tenant-b"},{user_id:"other"},{approved_by:"platform"},{reason_reference:""},{revoked_at:new Date().toISOString()},{expires_at:new Date(now).toISOString()},{expires_at:new Date(now+31*60000).toISOString()},{created_at:"invalid"}])assert.equal(validSupportGrant({...grant,...change},actor,"enquiries.read","tenant-a",now),false);
  assert.equal(validSupportGrant(grant,actor,"content.publish","tenant-a",now),false);
});

test("private HTTP endpoints require both verified Access and a bound local session",async context=>{
  const pair=await generateKeyPair("RS256"),settings=readAccessConfig(env);
  const verifier=createAccessVerifier(settings,createLocalJWKSet({keys:[{...await exportJWK(pair.publicKey),kid:"http-key",alg:"RS256"}]}));
  const now=Math.floor(Date.now()/1000);
  const jwt=await new SignJWT({type:"app",identity_nonce:"synthetic",iss:settings.issuer,aud:[settings.audience],sub:"platform",iat:now,nbf:now,exp:now+300}).setProtectedHeader({alg:"RS256",typ:"JWT",kid:"http-key"}).sign(pair.privateKey);
  const sessions=new Map(),used=new Set();let denials=0;
  const store={organisationId:"tenant-a",async createSession(identity,hash,csrf){if(used.has(identity.assertionHash))throw new Error("replayed");used.add(identity.assertionHash);sessions.set(hash,{id:"platform",role:"platform_admin",issuer:identity.issuer,subject:identity.subject,access_audience:identity.audience,access_assertion_hash:identity.assertionHash,csrf_hash:csrf,expires_at:identity.expiresAt});return {id:"platform"};},async getSession(hash){return sessions.get(hash);},async revoke(hash){sessions.delete(hash);},async recordDenied(){denials++;}};
  const auth=createStaffAuth({store,provider:verifier,settings,limiter:createLimiter({limit:100,windowMs:60000})});
  auth.router.get("/system-test",auth.requireStaff,auth.requirePermission("system.read"),(_req,res)=>res.sendStatus(204));
  const server=createApp({staffAuth:auth,contentRepository:{list:async()=>[]},publicationRepository:{enqueue(){throw new Error("Editor must not publish");}},repository:{listLeads(){throw new Error("Private records must not be read");}}}).listen(0,"127.0.0.1");
  await once(server,"listening");context.after(()=>server.close());
  const base=`http://127.0.0.1:${server.address().port}`;
  const exchange=()=>fetch(base+"/api/auth/access-session",{method:"POST",headers:{origin:settings.portalOrigin,"X-TWE-Session-Init":"1","Cf-Access-Jwt-Assertion":jwt}});
  assert.equal((await fetch(base+"/api/agent/leads",{headers:{"Cf-Access-Jwt-Assertion":"forged","Cf-Access-Authenticated-User-Email":"dev.nanaabaackah@gmail.com"}})).status,401);
  const login=await exchange();assert.equal(login.status,201);
  const cookie=login.headers.get("set-cookie").split(";")[0];
  assert.equal((await fetch(base+"/api/auth/session",{headers:{cookie}})).status,401);
  const headers={cookie,"Cf-Access-Jwt-Assertion":jwt};
  const response=await fetch(base+"/api/auth/session",{headers});assert.equal(response.status,200);
  const session=(await response.json()).data;
  assert.equal((await fetch(base+"/api/auth/system-test",{headers})).status,204);
  assert.equal((await fetch(base+"/api/agent/leads",{headers})).status,403);
  assert.equal((await fetch(base+"/api/agent/content",{headers})).status,403);
  const stored=[...sessions.values()][0];stored.role="owner";
  assert.equal((await fetch(base+"/api/auth/system-test",{headers})).status,403);
  stored.role="editor";
  assert.equal((await fetch(base+"/api/agent/content/home/publish",{method:"POST",headers:{...headers,origin:settings.portalOrigin,"X-CSRF-Token":session.csrfToken,"Content-Type":"application/json"},body:JSON.stringify({expectedVersion:1})})).status,403);
  stored.role="platform_admin";
  assert.equal((await exchange()).status,401);
  assert.equal((await fetch(base+"/api/auth/logout",{method:"POST",headers})).status,403);
  assert.equal((await fetch(base+"/api/auth/logout",{method:"POST",headers:{...headers,origin:settings.portalOrigin,"X-CSRF-Token":session.csrfToken}})).status,200);
  assert.equal((await fetch(base+"/api/auth/system-test",{headers})).status,401);
  assert.ok(denials>=2);
});
