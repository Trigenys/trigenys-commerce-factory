import assert from "node:assert/strict";
import { before, after, test, describe } from "node:test";
import { readFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import type { neon } from "@neondatabase/serverless";
import { createApp } from "../../src/app.ts";
import { createNeonRepository } from "../../src/repository.ts";
import { createJourneyRepository } from "../../src/journey-repository.ts";
import { parseOrderInput, quoteCart } from "../../src/journey-routes.ts";
import type { MerchantOrder, PublicOrder } from "../../../shared/commerce-journeys.ts";

const env={TRIGENYS_COMMERCE_FACTORY_DATABASE_URL:"postgresql://test",TRIGENYS_COMMERCE_FACTORY_AUTH_BASE_URL:"https://auth.example/neondb/auth",TRIGENYS_COMMERCE_FACTORY_WEB_ORIGIN:"https://commerce.example"};
let query:(sql:string,values?:unknown[])=>Promise<{rows:any[]}>;
let exec:(sql:string)=>Promise<unknown>;
let pool:Pool|undefined,pglite:PGlite|undefined,directory:string;
let storeId:string,productId:string,order:PublicOrder;
const secret="a".repeat(64),otherSecret="b".repeat(64),key=crypto.randomUUID();
const schema="journeys_"+crypto.randomUUID().replaceAll("-","");
const tag=(async(strings:TemplateStringsArray,...values:unknown[])=>{
  const statement=strings.reduce((text,part,index)=>text+(index ? "$"+index : "")+part,"");
  return (await query(statement,values)).rows;
}) as ReturnType<typeof neon>;
function app(){return createApp({repositoryFactory:()=>createNeonRepository("",tag),journeyRepositoryFactory:()=>createJourneyRepository("",tag),verifyIdentity:async token=>{
  if(token==="invalid")throw new Error("invalid signature");
  return {subject:token,email:token==="invitee"||token==="unverified" ? "staff@example.com" : token+"@example.com",emailVerified:token!=="unverified"};
}});}
async function request(path:string,method="GET",body?:unknown,subject?:string,headers:Record<string,string>={}){
  return app().request(path,{method,headers:{"Content-Type":"application/json",...(subject ? {Authorization:"Bearer "+subject}:{}),...headers},...(body!==undefined ? {body:JSON.stringify(body)}:{})},env);
}
function input(overrides:Record<string,unknown>={}){return {idempotencyKey:key,trackingToken:secret,lines:[{productId,quantity:2,variants:{Size:"M"}}],paymentMethod:"momo",customerName:"Test Buyer",customerPhone:"+237670000001",note:"Test note",...overrides};}
async function createOrder(overrides:Record<string,unknown>={}){return request("/v1/public/stores/atelier/orders","POST",input(overrides));}
async function patch(patch:Record<string,unknown>,subject="owner"){return request(`/v1/admin/stores/${storeId}/orders/${order.id}`,"PATCH",patch,subject);}

describe("persisted Commerce Factory user journeys",()=>{
  before(async()=>{
    if(process.env.TEST_DATABASE_URL){
      const connectionString=process.env.TEST_DATABASE_URL;
      const admin=new Pool({connectionString});await admin.query(`CREATE SCHEMA ${schema}`);await admin.end();
      pool=new Pool({connectionString,options:`-c search_path=${schema}`});
      query=async(sql,values)=>(await pool!.query(sql,values));exec=sql=>pool!.query(sql);
    }else{
      directory=await mkdtemp(join(tmpdir(),"commerce-pg-"));pglite=new PGlite(directory);
      query=async(sql,values)=>({rows:(await pglite!.query(sql,values)).rows});exec=sql=>pglite!.exec(sql);
    }
    const migrations=(await readdir(new URL("../../../db/migrations",import.meta.url))).filter(name=>/^000\d_/.test(name)).sort();
    for(let repeat=0;repeat<2;repeat++)for(const name of migrations)await exec(await readFile(new URL("../../../db/migrations/"+name,import.meta.url),"utf8"));
    const created=await request("/v1/admin/stores","POST",{name:"Atelier",slug:"atelier",whatsappNumber:"+237670000001",theme:"fashion-collection"},"owner");
    assert.equal(created.status,201,await created.clone().text());storeId=(await created.json() as any).store.id;
    const product=await request(`/v1/admin/stores/${storeId}/products`,"POST",{name:"Shirt",slug:"shirt",price:"1250.55",currencyCode:"XAF",status:"active",sortOrder:0,imageUrls:[],variants:[{name:"Size",value:"M"},{name:"Size",value:"L"}]},"owner");
    assert.equal(product.status,201,await product.clone().text());productId=(await product.json() as any).product.id;
    assert.equal((await request(`/v1/admin/stores/${storeId}/publish`,"POST",{},"owner")).status,200);
  });
  after(async()=>{
    if(pool){const connectionString=process.env.TEST_DATABASE_URL;await pool.end();const admin=new Pool({connectionString});await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}
    if(pglite){await pglite.close();await rm(directory,{recursive:true,force:true});}
  });
  test("catalog quotes trusted decimal prices and rejects malformed choices",async()=>{
    const storefront=(await request("/v1/public/stores/atelier").then(r=>r.json())) as any;
    assert.equal(quoteCart(storefront,input().lines)?.total,"2501.10");
    for(const variants of [{},{Size:"XXL"},{Size:"M",Injected:"yes"}] as Record<string,string>[])assert.equal(quoteCart(storefront,[{productId,quantity:2,variants}]),null);
    for(const payload of [input({lines:[]}),input({trackingToken:"short"}),input({lines:[{productId,quantity:100,variants:{}}]}),input({lines:[input().lines[0],input().lines[0]]}),input({customerPhone:"no"})])assert.equal(parseOrderInput(payload),null);
    const response=await createOrder({lines:[{productId,quantity:2,variants:{Size:"XXL"}}]});assert.equal(response.status,409);
  });
  test("concurrent retry saves one order and exposes no buyer data in private tracking",async()=>{
    const [a,b]=await Promise.all([createOrder(),createOrder()]);assert.ok([200,201].includes(a.status),await a.clone().text());assert.ok([200,201].includes(b.status),await b.clone().text());
    const first=await a.json() as any,second=await b.json() as any;order=first.order;assert.equal(order.id,second.order.id);assert.equal(order.total,"2501.10");assert.match(first.href,/^https:\/\/wa\.me\/237670000001\?text=/);
    assert.equal((await query("SELECT count(*)::int AS count FROM commerce_orders")).rows[0].count,1);
    const tracked=await request(`/v1/public/orders/${order.id}`,"GET",undefined,undefined,{"X-Order-Token":secret});assert.equal(tracked.status,200);assert.equal(tracked.headers.get("Cache-Control"),"no-store");
    const text=await tracked.text();for(const pii of ["Test Buyer","237670000001","Test note","tracking_hash","payload_hash","customerPhone","actor"])assert.ok(!text.includes(pii),pii);
    for(const value of ["",otherSecret])assert.equal((await request(`/v1/public/orders/${order.id}`,"GET",undefined,undefined,{"X-Order-Token":value})).status,404);
    assert.equal((await createOrder({trackingToken:otherSecret})).status,409);
  });
  test("a lost response can be recovered after archiving, and survives repository restart",async()=>{
    await query("UPDATE products SET status='archived',price=9999 WHERE id=$1",[productId]);
    assert.equal((await createOrder()).status,200);
    const resumed=await request(`/v1/public/stores/atelier/order-requests/${key}`,"GET",undefined,undefined,{"X-Order-Token":secret});assert.equal(resumed.status,200);assert.equal((await resumed.json() as any).order.total,"2501.10");
    assert.equal((await createOrder({idempotencyKey:crypto.randomUUID()})).status,409);
    if(pglite){await pglite.close();pglite=new PGlite(directory);}
    const reloaded=await request(`/v1/public/orders/${order.id}`,"GET",undefined,undefined,{"X-Order-Token":secret});assert.equal((await reloaded.json() as any).order.id,order.id);
    await query("UPDATE products SET status='active',price=1250.55 WHERE id=$1",[productId]);
  });
  test("email invitations require verification and owner control, and are revoked immediately",async()=>{
    const invitation=await request(`/v1/admin/stores/${storeId}/team/invitations`,"POST",{email:"STAFF@example.com"},"owner");assert.equal(invitation.status,201);
    const data=await invitation.json() as any;const token=new URL(data.href).hash.slice(7);assert.equal(token.length,64);assert.equal((await request("/v1/admin/invitations/accept","POST",{token},"unverified")).status,403);
    assert.equal((await request("/v1/admin/invitations/accept","POST",{token},"stranger")).status,404);
    assert.equal((await request("/v1/admin/invitations/accept","POST",{token},"invitee")).status,200);
    assert.equal((await request("/v1/admin/invitations/accept","POST",{token},"invitee")).status,404);
    const stores=await request("/v1/admin/me/stores","GET",undefined,"invitee");assert.equal((await stores.json() as any).stores[0].role,"staff");
    for(const [path,method,body] of [["team","GET",undefined],["analytics","GET",undefined],["publish","POST",{}],["","PATCH",{theme:"beauty-ecrin"}]] as const){const denied=await request(`/v1/admin/stores/${storeId}`+(path ? "/"+path : ""),method,body,"invitee");assert.ok([403,404].includes(denied.status),path);}
    const team=await request(`/v1/admin/stores/${storeId}/team`,"GET",undefined,"owner").then(r=>r.json()) as any;const member=team.members.find((m:any)=>m.role==="staff");assert.equal(member.email,"staff@example.com");
    assert.equal((await request(`/v1/admin/stores/${storeId}/team/members/${team.members.find((m:any)=>m.role==="owner").id}`,"DELETE",undefined,"owner")).status,404);
    assert.equal((await request(`/v1/admin/stores/${storeId}/orders`,"GET",undefined,"invitee")).status,200);
    assert.equal((await patch({expectedVersion:0,paymentStatus:"paid"},"invitee")).status,403);
    const products=await request(`/v1/admin/stores/${storeId}/products`,"GET",undefined,"invitee");assert.equal(products.status,200);
    assert.equal((await request(`/v1/admin/stores/${storeId}/products/${productId}`,"PATCH",{name:"Shirt staff",slug:"shirt",price:"1250.55",currencyCode:"XAF",status:"active",sortOrder:0,imageUrls:[],variants:[{name:"Size",value:"M"}]},"invitee")).status,200);
    assert.equal((await request(`/v1/admin/stores/${storeId}/team/members/${member.id}`,"DELETE",undefined,"owner")).status,204);
    assert.equal((await request(`/v1/admin/stores/${storeId}/orders`,"GET",undefined,"invitee")).status,404);
    assert.equal((await request(`/v1/admin/stores/${storeId}/products`,"GET",undefined,"stranger")).status,404);
  });
  test("expired and revoked invitation links cannot grant membership",async()=>{
    for(const reason of ["expired","revoked"]){const response=await request(`/v1/admin/stores/${storeId}/team/invitations`,"POST",{email:"staff@example.com"},"owner");const data=await response.json() as any;const token=new URL(data.href).hash.slice(7);
      if(reason==="expired")await query("UPDATE store_invitations SET expires_at=now()-interval '1 hour' WHERE id=$1",[data.invitation.id]);else assert.equal((await request(`/v1/admin/stores/${storeId}/team/invitations/${data.invitation.id}`,"DELETE",undefined,"owner")).status,204);
      assert.equal((await request("/v1/admin/invitations/accept","POST",{token},"invitee")).status,404);
    }
  });
  test("manual fulfillment cannot complete unpaid orders or overwrite concurrent changes",async()=>{
    assert.equal((await patch({expectedVersion:0,status:"completed"})).status,409);
    const [a,b]=await Promise.all([patch({expectedVersion:0,status:"confirmed"}),patch({expectedVersion:0,status:"cancelled"})]);assert.deepEqual([a.status,b.status].sort(),[200,409]);
    order=(await (a.status===200 ? a : b).json() as any).order;
    if(order.status==="cancelled"){
      const newOrder=await createOrder({idempotencyKey:crypto.randomUUID()});order=(await newOrder.json() as any).order;
      const confirmed=await patch({expectedVersion:order.version,status:"confirmed"});order=(await confirmed.json() as any).order;
    }
    const preparing=await patch({expectedVersion:order.version,status:"preparing"});order=(await preparing.json() as any).order;
    const ready=await patch({expectedVersion:order.version,status:"ready"});order=(await ready.json() as any).order;
    assert.equal((await patch({expectedVersion:order.version,status:"completed"})).status,409);
    const paid=await patch({expectedVersion:order.version,paymentStatus:"paid"});assert.equal(paid.status,200);order=(await paid.json() as any).order;
    const completed=await patch({expectedVersion:order.version,status:"completed"});assert.equal(completed.status,200);order=(await completed.json() as any).order;assert.equal(order.paymentStatus,"paid");assert.equal(order.history.length,6);
    assert.equal((await patch({expectedVersion:order.version,paymentStatus:"pending"})).status,409);
    assert.equal((await patch({expectedVersion:order.version,status:"requested"})).status,409);
    const tracked=await request(`/v1/public/orders/${order.id}`,"GET",undefined,undefined,{"X-Order-Token":secret});assert.equal((await tracked.json() as any).order.status,"completed");
    assert.equal((await request(`/v1/admin/stores/${storeId}/orders`,"GET",undefined,"stranger")).status,404);
  });
  test("support replies are private and audited, with no merchant self-promotion to platform",async()=>{
    const support={id:crypto.randomUUID(),trackingToken:secret,name:"Test User",email:"test@example.com",message:"Unable to reopen my store"};
    assert.equal((await request("/v1/public/support","POST",support)).status,201);assert.equal((await request("/v1/public/support","POST",support)).status,201);
    assert.equal((await request("/v1/public/support","POST",{...support,message:"A different request with the same key"})).status,409);
    assert.equal((await request("/v1/public/support","POST",{...support,trackingToken:otherSecret})).status,409);
    assert.equal((await query("SELECT count(*)::int AS count FROM support_requests")).rows[0].count,1);
    for(const subject of ["owner","stranger"]){assert.equal((await request("/v1/admin/platform/stores","GET",undefined,subject)).status,403);assert.equal((await request("/v1/admin/platform/support","GET",undefined,subject)).status,403);}
    assert.equal((await request("/v1/admin/platform/support")).status,401);
    await query("INSERT INTO platform_members(auth_subject,role)VALUES('support','support')");
    const tickets=await request("/v1/admin/platform/support","GET",undefined,"support");assert.equal((await tickets.json() as any).tickets[0].email,"test@example.com");
    const reply=await request(`/v1/admin/platform/support/${support.id}`,"PATCH",{status:"resolved",reply:"Your support response"},"support");assert.equal(reply.status,200);
    const publicReply=await request(`/v1/public/support/${support.id}`,"GET",undefined,undefined,{"X-Support-Token":secret});const data=await publicReply.json() as any;assert.equal(data.ticket.reply,"Your support response");assert.equal(data.ticket.email,undefined);assert.equal(data.ticket.message,undefined);
    assert.equal((await request(`/v1/public/support/${support.id}`,"GET",undefined,undefined,{"X-Support-Token":otherSecret})).status,404);
    assert.equal((await query("SELECT count(*)::int AS count FROM support_audit")).rows[0].count,1);
    const overview=await request("/v1/admin/platform/stores?q=Atelier","GET",undefined,"support");assert.equal((await overview.json() as any).stores.length,1);
    const noOrderAccess=await request(`/v1/admin/stores/${storeId}/orders`,"GET",undefined,"support");assert.equal(noOrderAccess.status,404);
  });
  test("database outages are recoverable 503 responses, while invalid identity stays 401",async()=>{
    const broken=createApp({repositoryFactory:()=>({...createNeonRepository("",tag),listOwnedStores:async()=>{throw new Error("private connection secret");}}),verifyIdentity:async()=>({subject:"owner"})});
    const response=await broken.request("/v1/admin/me/stores",{headers:{Authorization:"Bearer owner"}},env);assert.equal(response.status,503);assert.equal((await response.json() as any).error,"SERVICE_UNAVAILABLE");
    assert.equal((await request("/v1/admin/me/stores","GET",undefined,"invalid")).status,401);
  });
});
