import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { readFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import type { neon } from "@neondatabase/serverless";
import { createApp } from "../../src/app.ts";
import { createNeonRepository } from "../../src/repository.ts";
import { createSocialRepository } from "../../src/social-repository.ts";
import { SocialProviderError } from "../../src/social-providers.ts";
import type { WorkerBindings } from "../../src/types.ts";

const api="https://api.example",web="https://commerce.example";
const env:WorkerBindings={TRIGENYS_COMMERCE_FACTORY_DATABASE_URL:"postgresql://test",TRIGENYS_COMMERCE_FACTORY_AUTH_BASE_URL:"https://auth.example/neondb/auth",TRIGENYS_COMMERCE_FACTORY_WEB_ORIGIN:web,SOCIAL_TOKENS_KEY:Buffer.from(new Uint8Array(32).fill(23)).toString("base64"),SOCIAL_RATE_LIMITER:{limit:async()=>({success:true})}};
const schema="social_"+crypto.randomUUID().replaceAll("-","");
let query:(s:string,v?:unknown[])=>Promise<{rows:any[]}>,exec:(s:string)=>Promise<unknown>;
let pool:Pool|undefined,pglite:PGlite|undefined,directory:string,storeId:string,otherStoreId:string;
let exchanges=0,providerUnavailable=false;
const tag=(async(strings:TemplateStringsArray,...values:unknown[])=>{
  const s=strings.reduce((text,part,index)=>text+(index ? "$"+index:"")+part,"");return (await query(s,values)).rows;
}) as ReturnType<typeof neon>;
const profile={id:"page-1",name:"Atelier social",profileUrl:"https://www.facebook.com/123",values:{name:"Atelier social",description:"Description autorisée",businessLocation:"Douala",contactEmail:"shop@example.com"},truncatedFields:[]};
function app(){return createApp({repositoryFactory:()=>createNeonRepository("",tag),socialRepositoryFactory:()=>createSocialRepository("",tag),verifyIdentity:async subject=>({subject,email:subject+"@example.com",emailVerified:true}),socialAdapterFactory:()=>({
  authorizationUrl:(state,redirect)=>"https://provider.example/authorize?"+new URLSearchParams({state,redirect_uri:redirect}),
  exchange:async()=>{exchanges++;return {accessToken:"test-provider-access-token",scopes:["profile"],expiresAt:new Date(Date.now()+3600000).toISOString()};},
  accounts:async(_t,id)=>{if(providerUnavailable)throw new SocialProviderError("PROVIDER_UNAVAILABLE");return !id || id===profile.id ? [profile]:[];}
})});}
async function request(path:string,method="GET",body?:unknown,subject?:string,headers:Record<string,string>={}) {
  return app().request(path.startsWith("https:") ? path:api+path,{method,headers:{"Content-Type":"application/json",...(subject ? {Authorization:"Bearer "+subject}:{}),...headers},...(body!==undefined ? {body:JSON.stringify(body)}:{})},env);
}
const connectionPath=(id=storeId)=>`/v1/admin/stores/${id}/connections`;
async function start(){
  const begin=await request(connectionPath()+"/facebook/start","POST",undefined,"owner");assert.equal(begin.status,201);
  const r=await request((await begin.json() as any).href);assert.equal(r.status,303);
  const cookie=r.headers.get("Set-Cookie")!;assert.match(cookie,/HttpOnly/i);assert.match(cookie,/Secure/i);assert.match(cookie,/SameSite=Lax/i);
  return {state:new URL(r.headers.get("Location")!).searchParams.get("state")!,cookie:cookie.split(";")[0]};
}
async function callback(s:Awaited<ReturnType<typeof start>>,query="code=authorized-code") {
  return request("/v1/social/callback/facebook?state="+s.state+"&"+query,"GET",undefined,undefined,{Cookie:s.cookie});
}
async function connect(){const s=await start(),cb=await callback(s);assert.equal(cb.status,303);
  const href=new URL(cb.headers.get("Location")!);assert.equal(href.origin,web);const p=new URLSearchParams(href.hash.slice(1));assert.equal(p.get("social_result"),"ready");
  const body={attempt:p.get("attempt"),ticket:p.get("ticket")};const complete=await request(connectionPath()+"/complete","POST",body,"owner");assert.equal(complete.status,200);return body;}
async function prepare(){const r=await request(connectionPath()+"/facebook/previews","POST",{accountId:profile.id},"owner");assert.equal(r.status,201);return (await r.json() as any).preview;}
async function apply(id:string,fields:string[],subject="owner",store=storeId){return request(connectionPath(store)+"/previews/"+id+"/apply","POST",{fields},subject);}

describe("persisted social account authorization and import",()=>{
  before(async()=>{
    if(process.env.TEST_DATABASE_URL){const connectionString=process.env.TEST_DATABASE_URL;const admin=new Pool({connectionString});await admin.query(`CREATE SCHEMA ${schema}`);await admin.end();pool=new Pool({connectionString,options:`-c search_path=${schema}`});query=async(s,v)=>(await pool!.query(s,v));exec=s=>pool!.query(s);}
    else{directory=await mkdtemp(join(tmpdir(),"commerce-social-pg-"));pglite=new PGlite(directory);query=async(s,v)=>({rows:(await pglite!.query(s,v)).rows});exec=s=>pglite!.exec(s);}
    const migrations=(await readdir(new URL("../../../db/migrations",import.meta.url))).filter(n=>/^000\d_/.test(n)).sort();
    for(let repeat=0;repeat<2;repeat++)for(const name of migrations)await exec(await readFile(new URL("../../../db/migrations/"+name,import.meta.url),"utf8"));
    for(const subject of ["owner","other-owner"]){const r=await request("/v1/admin/stores","POST",{name:"Original store",slug:subject,whatsappNumber:"+237670000001",description:"Original description",theme:"sport-stadium"},subject);assert.equal(r.status,201);const id=(await r.json() as any).store.id;if(subject==="owner")storeId=id;else otherStoreId=id;}
    await query("INSERT INTO store_members(store_id,auth_subject,role) VALUES($1,'staff','staff')",[storeId]);
  });
  after(async()=>{if(pool){await pool.end();const admin=new Pool({connectionString:process.env.TEST_DATABASE_URL});await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}else{await pglite!.close();await rm(directory,{recursive:true,force:true});}});
  test("anonymous, staff and another store owner cannot manage connections",async()=>{
    assert.equal((await request(connectionPath())).status,401);
    for(const path of [connectionPath(),connectionPath()+"/facebook/accounts"]){assert.equal((await request(path,"GET",undefined,"staff")).status,403);assert.equal((await request(path,"GET",undefined,"other-owner")).status,404);}
    assert.equal((await request(connectionPath()+"/facebook/start","POST",{},"staff")).status,403);
  });
  test("OAuth state requires the initiating browser and is consumed once",async()=>{
    const s=await start(),count=exchanges;
    const missing=await request("/v1/social/callback/facebook?state="+s.state+"&code=code");assert.equal(exchanges,count);assert.match(missing.headers.get("Location")!,/social_result=expired/);
    const wrong=await callback({state:s.state,cookie:"__Host-cf-social-facebook="+"a".repeat(64)});assert.match(wrong.headers.get("Location")!,/social_result=expired/);assert.equal(exchanges,count);
    const cb=await callback(s);assert.match(cb.headers.get("Location")!,/social_result=ready/);assert.equal(exchanges,count+1);
    const replay=await callback(s);assert.match(replay.headers.get("Location")!,/social_result=expired/);assert.equal(exchanges,count+1);
  });
  test("missing or exhausted limits prevent starting a provider flow",async()=>{
    const init={method:"POST",headers:{Authorization:"Bearer owner"}};
    assert.equal((await app().request(api+connectionPath()+"/facebook/start",init,{...env,SOCIAL_RATE_LIMITER:undefined})).status,503);
    const blocked=await app().request(api+connectionPath()+"/facebook/start",init,{...env,SOCIAL_RATE_LIMITER:{limit:async()=>({success:false})}});
    assert.equal(blocked.status,429);assert.equal(blocked.headers.get("Retry-After"),"60");
  });
  test("provider denial changes no store data and persists no token",async()=>{
    const s=await start(),count=exchanges;const cb=await callback(s,"error=access_denied");assert.match(cb.headers.get("Location")!,/social_result=cancelled/);assert.equal(exchanges,count);
    const rows=await query("SELECT phase,encrypted_token FROM social_oauth_attempts WHERE store_id=$1",[storeId]);assert.equal(rows.rows[0].phase,"failed");assert.equal(rows.rows[0].encrypted_token,null);
  });
  test("the final ticket requires the original owner; retries restore the same connection",async()=>{
    const s=await start(),cb=await callback(s),p=new URLSearchParams(new URL(cb.headers.get("Location")!).hash.slice(1));const body={attempt:p.get("attempt"),ticket:p.get("ticket")};
    assert.equal((await request(connectionPath(otherStoreId)+"/complete","POST",body,"other-owner")).status,409);
    assert.equal((await request(connectionPath()+"/complete","POST",body,"owner")).status,200);assert.equal((await request(connectionPath()+"/complete","POST",body,"owner")).status,200);
    const r=await request(connectionPath(),"GET",undefined,"owner"),text=await r.text();assert.ok(!text.includes("test-provider-access-token"));assert.ok(!text.includes("encrypted_token"));
    const stored=await query("SELECT encrypted_token FROM store_social_connections WHERE store_id=$1",[storeId]);assert.ok(stored.rows[0].encrypted_token.startsWith("v1."));assert.ok(!stored.rows[0].encrypted_token.includes("test-provider-access-token"));
  });
  test("preview is private and no fields change before owner confirmation",async()=>{
    const p=await prepare();assert.equal(p.currentValues.name,"Original store");assert.equal(p.values.name,"Atelier social");
    assert.equal((await request(connectionPath()+"/previews/"+p.id,"GET",undefined,"staff")).status,403);
    assert.equal((await apply(p.id,["name"],"other-owner",otherStoreId)).status,404);
    const before=(await query("SELECT name,status FROM stores WHERE id=$1",[storeId])).rows[0];assert.equal(before.name,"Original store");assert.equal(before.status,"draft");
    const done=await apply(p.id,["name"]);assert.equal(done.status,200);const store=(await done.json() as any).store;assert.equal(store.name,"Atelier social");assert.equal(store.description,"Original description");assert.equal(store.theme,"sport-stadium");assert.equal(store.whatsappNumber,"+237670000001");assert.equal(store.status,"draft");
    const retry=await apply(p.id,["name"]);assert.equal((await retry.json() as any).result,"already_applied");assert.equal((await apply(p.id,["description"])).status,409);
  });
  test("invalid or forged imports cannot add arbitrary values",async()=>{
    const p=await prepare();assert.equal((await apply(p.id,["price"])).status,400);assert.equal((await apply(p.id,["name","name"])).status,400);
    assert.equal((await request(connectionPath()+"/previews/"+p.id+"/apply","POST",{fields:["name"],values:{name:"forged"}},"owner")).status,400);
    assert.equal((await request(connectionPath()+"/facebook/previews","POST",{accountId:"unauthorized-account"},"owner")).status,404);
  });
  test("a newer store edit, reconnect or expiry blocks a stale preview",async()=>{
    const p=await prepare();await query("UPDATE stores SET description='Latest merchant edit' WHERE id=$1",[storeId]);
    const stale=await apply(p.id,["description"]);assert.equal((await stale.json() as any).error,"PREVIEW_CHANGED");
    const reconnectPreview=await prepare();await connect();assert.equal((await (await apply(reconnectPreview.id,["name"])).json() as any).error,"PREVIEW_CHANGED");
    const expired=await prepare();await query("UPDATE store_social_previews SET expires_at=now()-interval '1 second' WHERE id=$1",[expired.id]);assert.equal((await (await apply(expired.id,["name"])).json() as any).error,"PREVIEW_EXPIRED");
  });
  test("simultaneous confirmations do not apply an import twice",async()=>{
    const p=await prepare();const responses=await Promise.all([apply(p.id,["description"]),apply(p.id,["description"])]);const results=await Promise.all(responses.map(async r=>{assert.equal(r.status,200);return (await r.json() as any).result;}));assert.deepEqual(results.sort(),["already_applied","applied"]);
  });
  test("a detected provider revocation blocks an unconfirmed preview",async()=>{
    const p=await prepare(),repo=createSocialRepository("",tag),connection=await repo.getConnection("owner",storeId,"facebook");
    await repo.markError("owner",storeId,"facebook",connection!.revision,"PERMISSION_REQUIRED");
    assert.equal((await (await apply(p.id,["name"])).json() as any).error,"PREVIEW_CHANGED");await connect();
  });
  test("disconnect invalidates pending grants and previews without erasing imported data",async()=>{
    const p=await prepare(),s=await start();assert.equal((await request(connectionPath()+"/facebook","DELETE",undefined,"owner")).status,204);
    assert.match((await callback(s)).headers.get("Location")!,/social_result=expired/);assert.equal((await apply(p.id,["name"])).status,404);
    const stored=(await query("SELECT encrypted_token,status FROM store_social_connections WHERE store_id=$1",[storeId])).rows[0];assert.equal(stored.encrypted_token,null);assert.equal(stored.status,"disconnected");
    assert.equal((await query("SELECT name FROM stores WHERE id=$1",[storeId])).rows[0].name,"Atelier social");
  });
  test("concurrent disconnect and completion cannot restore a removed credential",async()=>{
    const s=await start(),cb=await callback(s),p=new URLSearchParams(new URL(cb.headers.get("Location")!).hash.slice(1));const body={attempt:p.get("attempt"),ticket:p.get("ticket")};
    const [complete,disconnect]=await Promise.all([request(connectionPath()+"/complete","POST",body,"owner"),request(connectionPath()+"/facebook","DELETE",undefined,"owner")]);
    assert.ok([200,409].includes(complete.status));assert.equal(disconnect.status,204);
    const row=(await query("SELECT status,encrypted_token FROM store_social_connections WHERE store_id=$1",[storeId])).rows[0];assert.equal(row.status,"disconnected");assert.equal(row.encrypted_token,null);
  });
  test("provider outage degrades only the optional connection",async()=>{
    await connect();providerUnavailable=true;const r=await request(connectionPath()+"/facebook/accounts","GET",undefined,"owner");assert.equal(r.status,502);
    assert.equal((await request("/v1/admin/me/stores","GET",undefined,"owner")).status,200);assert.equal((await request(`/v1/admin/stores/${storeId}/products`,"GET",undefined,"owner")).status,200);
    const connections=await (await request(connectionPath(),"GET",undefined,"owner")).json() as any;assert.equal(connections.connections[0].status,"degraded");providerUnavailable=false;
  });
  test("expired OAuth attempts and tokens are unusable and cleaned up",async()=>{
    const s=await start();await query("UPDATE social_oauth_attempts SET expires_at=now()-interval '1 second' WHERE store_id=$1",[storeId]);assert.match((await callback(s)).headers.get("Location")!,/social_result=expired/);
    await query("UPDATE store_social_connections SET expires_at=now()-interval '1 second' WHERE store_id=$1",[storeId]);await request(connectionPath(),"GET",undefined,"owner");
    assert.equal((await query("SELECT encrypted_token FROM store_social_connections WHERE store_id=$1",[storeId])).rows[0].encrypted_token,null);
    assert.equal((await query("SELECT count(*)::int AS n FROM social_oauth_attempts WHERE store_id=$1",[storeId])).rows[0].n,0);
  });
});
