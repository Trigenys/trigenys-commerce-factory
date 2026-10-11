import assert from "node:assert/strict";
import { mkdir,writeFile } from "node:fs/promises";
import { randomBytes,randomUUID } from "node:crypto";
import { createAuthClient } from "@neondatabase/neon-js/auth";
import { BetterAuthVanillaAdapter } from "@neondatabase/neon-js/auth/vanilla/adapters";
import { storeThemes } from "../shared/store-themes.ts";

// Fixed isolated targets: this smoke test must never create fixtures in production.
const api="https://commerce-factory-journeys-api.lawrynnjennifer.workers.dev";
const origin="https://commerce-factory-journeys.pages.dev";
const auth="https://ep-soft-river-b2at40xx.neonauth.c-6.eu-central-1.aws.neon.tech/commerce_factory/auth";
const report={checkedAt:new Date().toISOString(),api,origin,checks:[],unverified:["Email delivery to a real mailbox and manual email-code verification.","User studies and complete WCAG conformity."]};
const originalFetch=globalThis.fetch;
report.authRequests=[];
const cookies=new Map();
globalThis.fetch=async(input,init={})=>{
  const url=new URL(typeof input==="string"||input instanceof URL ? input : input.url);
  const headers=new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  headers.set("Origin",origin);
  if(url.origin===new URL(auth).origin&&cookies.size)headers.set("Cookie",[...cookies].map(([name,value])=>name+"="+value).join("; "));
  const response=await originalFetch(input,{...init,headers,signal:init.signal||AbortSignal.timeout(20000)});
  if(url.origin===new URL(auth).origin){let value;try{value=await response.clone().json();}catch{}report.authRequests.push({path:url.pathname,status:response.status,keys:value&&typeof value==="object" ? Object.keys(value):[],errorCode:value?.code,headerNames:[...response.headers.keys()]});}
  if(url.origin===new URL(auth).origin)for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(";")[0],eq=pair.indexOf("=");if(eq>0)cookies.set(pair.slice(0,eq),pair.slice(eq+1));}
  return response;
};
const client=createAuthClient(auth,{adapter:BetterAuthVanillaAdapter({fetchOptions:{credentials:"include"}})});
let jwt;
async function request(path,method="GET",body,authenticated=false,headers={}){
  const r=await fetch(api+path,{method,headers:{"Content-Type":"application/json",...(authenticated ? {Authorization:"Bearer "+jwt}:{}),...headers},...(body!==undefined ? {body:JSON.stringify(body)}:{})});
  const value=r.status===204 ? null:await r.json();return {status:r.status,value};
}
function expect(result,status){assert.equal(result.status,status,JSON.stringify(result.value));return result.value;}
try{
  const config=expect(await request("/v1/config"),200);assert.equal(config.authBaseUrl,auth);
  const email="commerce-qa-"+randomUUID()+"@example.com",password=randomBytes(24).toString("base64url")+"Aa1!";
  const signup=await client.signUp.email({name:"Commerce staging QA",email,password});
  assert.equal(signup.error,null,signup.error?.message);assert.ok(signup.data?.user?.id);
  const session=await client.getSession();assert.ok(session.data?.session&&session.data?.user);assert.equal(session.data.user.id,signup.data.user.id);
  const token=await client.token({fetchOptions:{headers:{"X-Force-Fetch":"true"}}});report.tokenResult={keys:Object.keys(token),dataKeys:token.data&&typeof token.data==="object" ? Object.keys(token.data):[],hasToken:Boolean(token.data?.token)};assert.equal(token.error,null,token.error?.message);assert.ok(token.data?.token);jwt=token.data.token;
  const claims=JSON.parse(Buffer.from(jwt.split(".")[1],"base64url"));
  report.identity={subject:signup.data.user.id,claimNames:Object.keys(claims),emailVerifiedClaim:claims.emailVerified===true||claims.email_verified===true};
  expect(await request("/v1/admin/me/stores","GET",undefined,true),200);
  expect(await request("/v1/admin/me/stores"),401);
  report.checks.push("Real signup, cookie session restoration and SDK token accepted by the deployed JWT verifier");
  const slug="qa-"+randomUUID().slice(0,8);
  const store=expect(await request("/v1/admin/stores","POST",{name:"Validation Commerce Factory",slug,whatsappNumber:"+237670000001",theme:"fashion-collection"},true),201).store;
  const product=expect(await request(`/v1/admin/stores/${store.id}/products`,"POST",{name:"Sac de validation",slug:"sac-validation",price:"1250.55",currencyCode:"XAF",status:"active",sortOrder:0,imageUrls:[],variants:[{name:"Taille",value:"M"}]},true),201).product;
  expect(await request(`/v1/admin/stores/${store.id}/publish`,"POST",{},true),200);
  for(const theme of Object.keys(storeThemes)){expect(await request(`/v1/admin/stores/${store.id}`,"PATCH",{theme},true),200);const saved=expect(await request("/v1/public/stores/"+slug),200);assert.equal(saved.store.theme,theme);}
  expect(await request(`/v1/admin/stores/${store.id}`,"PATCH",{theme:"fashion-collection"},true),200);
  report.checks.push(`${Object.keys(storeThemes).length} themes persist through deployed settings and public storefront API`);
  const trackingToken=randomBytes(32).toString("hex"),input={idempotencyKey:randomUUID(),trackingToken,paymentMethod:"momo",lines:[{productId:product.id,quantity:2,variants:{Taille:"M"}}],customerName:"QA buyer",note:"Isolated staging request"};
  const saved=expect(await request(`/v1/public/stores/${slug}/orders`,"POST",input),201);let order=saved.order;assert.equal(order.total,"2501.10");
  assert.equal(expect(await request(`/v1/public/stores/${slug}/orders`,"POST",input),200).order.id,order.id);
  expect(await request(`/v1/public/orders/${order.id}`),404);
  for(const patch of [{status:"confirmed"},{status:"preparing"},{status:"ready"},{paymentStatus:"paid"},{status:"completed"}])order=expect(await request(`/v1/admin/stores/${store.id}/orders/${order.id}`,"PATCH",{expectedVersion:order.version,...patch},true),200).order;
  const tracked=expect(await request(`/v1/public/orders/${order.id}`,"GET",undefined,false,{"X-Order-Token":trackingToken}),200).order;assert.equal(tracked.status,"completed");assert.equal(tracked.history.length,6);assert.ok(!JSON.stringify(tracked).includes("QA buyer"));
  const reloaded=expect(await request("/v1/admin/me/stores","GET",undefined,true),200);assert.ok(reloaded.stores.some(s=>s.id===store.id));
  report.store={id:store.id,slug};report.order={id:order.id,status:order.status,paymentStatus:order.paymentStatus};
  report.checks.push("Persisted order, identical retry, private tracking and manual payment/fulfillment through the deployed Worker");
  const logout=await client.signOut();assert.equal(logout.error,null,logout.error?.message);
  const login=await client.signIn.email({email,password});assert.equal(login.error,null,login.error?.message);
  const restored=await client.getSession();assert.equal(restored.data?.user?.id,signup.data.user.id);
  const logoutAgain=await client.signOut();assert.equal(logoutAgain.error,null,logoutAgain.error?.message);
  report.checks.push("Real sign-out and password sign-in restore the same account");
}catch(error){report.failure=error instanceof Error ? error.message:"Staging smoke failed";throw error;}
finally{await mkdir("artifacts/journeys",{recursive:true});await writeFile("artifacts/journeys/live-staging.json",JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
