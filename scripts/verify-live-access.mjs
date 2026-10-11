import assert from "node:assert/strict";
import { readFile,writeFile,mkdir,unlink } from "node:fs/promises";
import { randomBytes,randomUUID } from "node:crypto";
import { createAuthClient } from "@neondatabase/neon-js/auth";
import { BetterAuthVanillaAdapter } from "@neondatabase/neon-js/auth/vanilla/adapters";

// Controlled fixtures on the isolated branch only. No production account grants.
const api="https://commerce-factory-journeys-api.lawrynnjennifer.workers.dev";
const origin="https://commerce-factory-journeys.pages.dev";
const auth="https://ep-soft-river-b2at40xx.neonauth.c-6.eu-central-1.aws.neon.tech/commerce_factory/auth";
const fixtureFile="/tmp/commerce-journeys-57-access.json";
let cookies=new Map();const nativeFetch=globalThis.fetch;
globalThis.fetch=async(input,init={})=>{
  const url=new URL(typeof input==="string"||input instanceof URL ? input : input.url),headers=new Headers(init.headers);
  headers.set("Origin",origin);
  if(url.origin===new URL(auth).origin&&cookies.size)headers.set("Cookie",[...cookies].map(([name,value])=>name+"="+value).join("; "));
  const r=await nativeFetch(input,{...init,headers,signal:AbortSignal.timeout(20000)});
  if(url.origin===new URL(auth).origin)for(const raw of r.headers.getSetCookie()){const p=raw.split(";")[0],eq=p.indexOf("=");if(eq>0)cookies.set(p.slice(0,eq),p.slice(eq+1));}
  return r;
};
const client=createAuthClient(auth,{adapter:BetterAuthVanillaAdapter({fetchOptions:{credentials:"include"}})});
const fresh={fetchOptions:{headers:{"X-Force-Fetch":"true"}}};
async function request(path,method="GET",body,jwt,headers={}){const r=await fetch(api+path,{method,headers:{"Content-Type":"application/json",...(jwt ? {Authorization:"Bearer "+jwt}:{}),...headers},...(body!==undefined ? {body:JSON.stringify(body)}:{})});return {status:r.status,value:r.status===204 ? null:await r.json()};}
function expect(r,status){assert.equal(r.status,status,r.value?.error || "Unexpected HTTP status");return r.value;}
async function account(role){cookies=new Map();const email="commerce-access-"+role+"-"+randomUUID()+"@example.com";const r=await client.signUp.email({name:"Staging "+role,email,password:randomBytes(24).toString("base64url")+"Aa1!"});assert.equal(r.error,null,r.error?.message);const session=await client.getSession(fresh);assert.equal(session.data?.user?.id,r.data?.user?.id);const t=await client.token(fresh);assert.ok(t.data?.token);return {id:r.data.user.id,email,jwt:t.data.token,cookies:[...cookies]};}

if(process.argv[2]==="prepare"){
  const owner=await account("owner"),slug="qa-access-"+randomUUID().slice(0,8);
  const store=expect(await request("/v1/admin/stores","POST",{name:"Validation des accès",slug,whatsappNumber:"+237670000001",theme:"sport-stadium"},owner.jwt),201).store;
  const product=expect(await request(`/v1/admin/stores/${store.id}/products`,"POST",{name:"Maillot QA",slug:"maillot-qa",price:"17000",currencyCode:"XAF",status:"active",sortOrder:0,imageUrls:[],variants:[]},owner.jwt),201).product;
  expect(await request(`/v1/admin/stores/${store.id}/publish`,"POST",{},owner.jwt),200);
  const order=expect(await request(`/v1/public/stores/${slug}/orders`,"POST",{idempotencyKey:randomUUID(),trackingToken:randomBytes(32).toString("hex"),paymentMethod:"cash",lines:[{productId:product.id,quantity:1,variants:{}}]}),201).order;
  const staff=await account("staff"),support=await account("support");
  const invitation=expect(await request(`/v1/admin/stores/${store.id}/team/invitations`,"POST",{email:staff.email},owner.jwt),201);
  const invitationToken=new URL(invitation.href).hash.slice(7);
  expect(await request("/v1/admin/invitations/accept","POST",{token:invitationToken},staff.jwt),403);
  expect(await request("/v1/admin/platform/support","GET",undefined,support.jwt),403);
  await writeFile(fixtureFile,JSON.stringify({owner,staff,support,store,product,order,invitationToken}),{mode:0o600});
  console.log(JSON.stringify({prepared:true,staff:{id:staff.id,email:staff.email},support:{id:support.id,email:support.email},note:"Staff email verification and platform grant are isolated test fixtures, not email-delivery proof."}));
}else if(process.argv[2]==="verify"){
  const state=JSON.parse(await readFile(fixtureFile,"utf8")),{owner,staff,support,store,product,order,invitationToken}=state;
  const report={checkedAt:new Date().toISOString(),origin,checks:[],fixtureBoundary:"Verified-email flag and explicit platform role were provisioned only for reserved test accounts on the isolated Neon branch. This does not verify email delivery."};
  cookies=new Map(staff.cookies);const freshStaff=await client.token(fresh);assert.ok(freshStaff.data?.token);staff.jwt=freshStaff.data.token;
  const claims=JSON.parse(Buffer.from(staff.jwt.split(".")[1],"base64url"));assert.equal(claims.emailVerified,true);
  expect(await request("/v1/admin/invitations/accept","POST",{token:invitationToken},staff.jwt),200);
  expect(await request("/v1/admin/invitations/accept","POST",{token:invitationToken},staff.jwt),404);
  const stores=expect(await request("/v1/admin/me/stores","GET",undefined,staff.jwt),200);assert.equal(stores.stores.find(s=>s.id===store.id)?.role,"staff");
  expect(await request(`/v1/admin/stores/${store.id}/products`,"GET",undefined,staff.jwt),200);
  expect(await request(`/v1/admin/stores/${store.id}/products/${product.id}`,"PATCH",{name:"Maillot modifié par l’équipe",slug:product.slug,price:"17000",currencyCode:"XAF",status:"active",sortOrder:0,imageUrls:[],variants:[]},staff.jwt),200);
  expect(await request(`/v1/admin/stores/${store.id}/orders`,"GET",undefined,staff.jwt),200);
  expect(await request(`/v1/admin/stores/${store.id}/orders/${order.id}`,"PATCH",{expectedVersion:0,paymentStatus:"paid"},staff.jwt),403);
  expect(await request(`/v1/admin/stores/${store.id}/team`,"GET",undefined,staff.jwt),403);
  expect(await request(`/v1/admin/stores/${store.id}/analytics`,"GET",undefined,staff.jwt),403);
  report.checks.push("Actual signed verified-email claim accepts an invitation once; staff can edit products and read orders, while owner-only payment/team/analytics remain denied");
  const ticketInput={id:randomUUID(),trackingToken:randomBytes(32).toString("hex"),name:"QA support",email:"qa-support@example.com",message:"Demande de validation du parcours support",storeSlug:store.slug};
  expect(await request("/v1/public/support","POST",ticketInput),201);expect(await request("/v1/public/support","POST",ticketInput),201);
  expect(await request("/v1/public/support","POST",{...ticketInput,message:"Demande différente avec la même identité"}),409);
  expect(await request(`/v1/public/support/${ticketInput.id}`),404);
  expect(await request("/v1/admin/platform/support","GET",undefined,owner.jwt),403);
  expect(await request("/v1/admin/platform/support","GET",undefined,support.jwt),200);
  expect(await request(`/v1/admin/platform/support/${ticketInput.id}`,"PATCH",{status:"resolved",reply:"Réponse de validation disponible dans le suivi privé."},support.jwt),200);
  const tracked=expect(await request(`/v1/public/support/${ticketInput.id}`,"GET",undefined,undefined,{"X-Support-Token":ticketInput.trackingToken}),200).ticket;
  assert.equal(tracked.status,"resolved");assert.ok(tracked.reply);assert.equal(tracked.email,undefined);assert.equal(tracked.message,undefined);
  expect(await request(`/v1/admin/stores/${store.id}/orders`,"GET",undefined,support.jwt),404);
  report.checks.push("Explicit platform support grant, persisted reply, private receipt and no platform access to buyer orders");
  const team=expect(await request(`/v1/admin/stores/${store.id}/team`,"GET",undefined,owner.jwt),200),member=team.members.find(m=>m.subject===staff.id);
  assert.ok(member);expect(await request(`/v1/admin/stores/${store.id}/team/members/${member.id}`,"DELETE",undefined,owner.jwt),204);
  expect(await request(`/v1/admin/stores/${store.id}/products`,"GET",undefined,staff.jwt),404);
  report.checks.push("Owner revocation immediately removes staff access despite a still-valid identity JWT");
  await mkdir("artifacts/journeys",{recursive:true});await writeFile("artifacts/journeys/live-access.json",JSON.stringify(report,null,2));await unlink(fixtureFile);console.log(JSON.stringify(report));
}else throw new Error("Use prepare, provision the isolated fixture grants, then verify.");
