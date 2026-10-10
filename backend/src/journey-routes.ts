import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppEnv } from "./app.ts";
import type { CommerceRepository, PublicStorefront, WorkerBindings } from "./types.ts";
import type { JourneyRepository } from "./journey-types.ts";
import { createJourneyRepository } from "./journey-repository.ts";
import { orderStatuses, paymentMethods, type CartSelection, type OrderCreateInput, type OrderLine, type OrderPatch } from "../../shared/commerce-journeys.ts";

const uuid = (value:unknown):value is string => typeof value==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const token = (value:unknown):value is string => typeof value==="string" && /^[a-f0-9]{64}$/.test(value);
export async function hashSecret(value:string):Promise<string> {return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,"0")).join("");}
export function randomSecret():string {return [...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,"0")).join("");}
function amount(minor:bigint):string {return (minor/100n).toString()+"."+(minor%100n).toString().padStart(2,"0");}
function minor(value:string):bigint {if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(value)) throw new Error("INVALID_PRICE");const [whole,part=""] = value.split(".");return BigInt(whole)*100n+BigInt(part.padEnd(2,"0"));}
function optionalText(value:unknown,max:number):string|null|false {if (value===undefined || value===null || value==="") return null;if (typeof value!=="string" || value.trim().length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))return false;return value.trim() || null;}
export function parseOrderInput(value:unknown):OrderCreateInput|null {
  if (!value || typeof value!=="object" || Array.isArray(value))return null;
  const v=value as Record<string,unknown>;
  if (!uuid(v.idempotencyKey) || !token(v.trackingToken) || !paymentMethods.includes(v.paymentMethod as any) || !Array.isArray(v.lines) || v.lines.length<1 || v.lines.length>50)return null;
  const name=optionalText(v.customerName,80),phone=optionalText(v.customerPhone,24),note=optionalText(v.note,500);
  if (name===false || phone===false || note===false || (phone && !/^\+?[0-9 ()-]{8,24}$/.test(phone)))return null;
  const lines:CartSelection[]=[];const keys=new Set<string>();
  for (const raw of v.lines) {
    if (!raw || typeof raw!=="object" || !uuid(raw.productId) || !Number.isInteger(raw.quantity) || raw.quantity<1 || raw.quantity>99 || !raw.variants || typeof raw.variants!=="object" || Array.isArray(raw.variants))return null;
    const entries=Object.entries(raw.variants).sort(([a],[b])=>a.localeCompare(b));
    if (entries.length>10 || entries.some(([key,val])=>key.length<1 || key.length>80 || typeof val!=="string" || val.length<1 || val.length>80))return null;
    const variants=Object.fromEntries(entries) as Record<string,string>;
    const key=raw.productId+JSON.stringify(variants);if (keys.has(key))return null;keys.add(key);
    lines.push({productId:raw.productId,quantity:raw.quantity,variants});
  }
  return {idempotencyKey:v.idempotencyKey,trackingToken:v.trackingToken,paymentMethod:v.paymentMethod as OrderCreateInput["paymentMethod"],lines,customerName:name,customerPhone:phone,note};
}
export function quoteCart(storefront:PublicStorefront,selections:CartSelection[]):{lines:OrderLine[];total:string}|null {
  const lines:OrderLine[]=[];let total=0n;
  try {
    for (const selected of selections) {
      const product=storefront.products.find(p=>p.id===selected.productId);
      if (!product || product.currencyCode!==storefront.store.currencyCode)return null;
      const groups=new Map<string,Set<string>>();
      for (const variant of product.variants) {if (!groups.has(variant.name))groups.set(variant.name,new Set());groups.get(variant.name)!.add(variant.value);}
      if (Object.keys(selected.variants).length!==groups.size || [...groups].some(([name,values])=>!Object.hasOwn(selected.variants,name) || !values.has(selected.variants[name])))return null;
      const price=minor(product.price);const lineAmount=price*BigInt(selected.quantity);total+=lineAmount;
      lines.push({...selected,name:product.name,slug:product.slug,unitPrice:amount(price),amount:amount(lineAmount)});
    }
    if (total>100000000000000n)return null;
    return {lines,total:amount(total)};
  } catch {return null;}
}

function whatsappOrderHref(order:import("../../shared/commerce-journeys.ts").PublicOrder,phone:string,english:boolean) {
  const message=[(english ? "Order request " : "Demande de commande ")+order.reference,...order.lines.map(l=>l.quantity+" × "+l.name+(Object.keys(l.variants).length ? " ("+Object.entries(l.variants).map(([k,v])=>k+": "+v).join(", ")+")" : "")+" — "+l.amount+" "+order.currencyCode),(english ? "Total: " : "Total : ")+order.total+" "+order.currencyCode,(english ? "Please confirm availability, payment and handover." : "Merci de confirmer la disponibilité, le paiement et la remise.")].join("\n");
  return "https://wa.me/"+phone.replace(/\D/g,"")+"?text="+encodeURIComponent(message);
}

export function registerJourneyRoutes(app:Hono<AppEnv>,coreFactory:(env:WorkerBindings)=>CommerceRepository,factory?: (env:WorkerBindings)=>JourneyRepository) {
  const repo=(env:WorkerBindings)=>factory ? factory(env) : createJourneyRepository(env.TRIGENYS_COMMERCE_FACTORY_DATABASE_URL || "");
  const rates=new Map<string,{count:number;until:number}>();
  function limited(ip:string,area:string,max:number) {
    const key=area+":"+ip;const now=Date.now();let entry=rates.get(key);
    if (!entry || entry.until<now) {entry={count:0,until:now+60000};rates.set(key,entry);}
    if (rates.size>10000) {for(const [k,v] of rates){if(v.until<now)rates.delete(k);}if(rates.size>10000)rates.delete(rates.keys().next().value!);}
    return ++entry.count>max;
  }
  for(const path of ["/v1/public/stores/:slug/orders","/v1/public/support","/v1/admin/stores/:storeId/orders/:id","/v1/admin/stores/:storeId/team/invitations","/v1/admin/invitations/accept","/v1/admin/platform/support/:id"]) app.use(path,bodyLimit({maxSize:65536,onError:c=>c.json({error:"REQUEST_TOO_LARGE"},413)}));
  app.get("/v1/admin/me/access",async c=>c.json({platform:await repo(c.env).hasPlatformAccess(c.get("identity").subject),email:c.get("identity").email || "",emailVerified:Boolean(c.get("identity").emailVerified)}));
  app.post("/v1/public/stores/:slug/orders",async c=>{
    if (limited(c.req.header("CF-Connecting-IP") || "unknown","order",30))return c.json({error:"RATE_LIMITED"},429);
    let payload:unknown;try {payload=await c.req.json();}catch{return c.json({error:"INVALID_JSON"},400);}
    const input=parseOrderInput(payload);if(!input)return c.json({error:"INVALID_ORDER"},400);
    const trackingHash=await hashSecret(input.trackingToken);
    const payloadHash=await hashSecret(JSON.stringify({...input,trackingToken:trackingHash}));
    const previous=await repo(c.env).getOrderRequest(c.req.param("slug"),input.idempotencyKey,trackingHash);
    if(previous){
      if(previous.payloadHash!==payloadHash)return c.json({error:"IDEMPOTENCY_CONFLICT"},409);
      return c.json({order:previous.order,href:whatsappOrderHref(previous.order,previous.whatsappNumber,(payload as any)?.language==="en")});
    }
    const storefront=await coreFactory(c.env).getPublicStorefront(c.req.param("slug"));if(!storefront)return c.json({error:"STORE_NOT_FOUND"},404);
    const quote=quoteCart(storefront,input.lines);if(!quote)return c.json({error:"CATALOG_CHANGED"},409);
    const result=await repo(c.env).createOrder(c.req.param("slug"),{id:crypto.randomUUID(),input,payloadHash,trackingHash,...quote,currencyCode:storefront.store.currencyCode});
    if(result.kind==="conflict")return c.json({error:"IDEMPOTENCY_CONFLICT"},409);
    if(result.kind==="catalog_changed")return c.json({error:"CATALOG_CHANGED"},409);
    const order=result.order;
    const href=whatsappOrderHref(order,storefront.store.whatsappNumber,(payload as any)?.language==="en");
    c.header("Cache-Control","no-store");return c.json({order,href},result.kind==="created" ? 201 : 200);
  });
  app.get("/v1/public/stores/:slug/order-requests/:key",async c=>{
    const key=c.req.param("key"),secret=c.req.header("X-Order-Token");if(!uuid(key)||!token(secret))return c.json({error:"ORDER_NOT_FOUND"},404);
    const previous=await repo(c.env).getOrderRequest(c.req.param("slug"),key,await hashSecret(secret));c.header("Cache-Control","no-store");
    return previous ? c.json({order:previous.order,href:whatsappOrderHref(previous.order,previous.whatsappNumber,c.req.query("lang")==="en")}) : c.json({error:"ORDER_NOT_FOUND"},404);
  });
  app.get("/v1/public/orders/:id",async c=>{
    const id=c.req.param("id"),secret=c.req.header("X-Order-Token");if(!uuid(id)||!token(secret))return c.json({error:"ORDER_NOT_FOUND"},404);
    const order=await repo(c.env).getPublicOrder(id,await hashSecret(secret));c.header("Cache-Control","no-store");return order ? c.json({order}) : c.json({error:"ORDER_NOT_FOUND"},404);
  });
  app.get("/v1/admin/stores/:storeId/orders",async c=>{
    const id=c.req.param("storeId");if(!uuid(id))return c.json({error:"STORE_NOT_FOUND"},404);
    const orders=await repo(c.env).listOrders(c.get("identity").subject,id);c.header("Cache-Control","no-store");return orders ? c.json({orders}) : c.json({error:"STORE_NOT_FOUND"},404);
  });
  app.patch("/v1/admin/stores/:storeId/orders/:id",async c=>{
    const storeId=c.req.param("storeId"),id=c.req.param("id");if(!uuid(id)||!uuid(storeId))return c.json({error:"ORDER_NOT_FOUND"},404);
    let p:any;try{p=await c.req.json();}catch{return c.json({error:"INVALID_JSON"},400);}
    if(!p || !Number.isInteger(p.expectedVersion) || p.expectedVersion<0 || p.expectedVersion>1000000 || (!p.status&&!p.paymentStatus) || (p.status&&!orderStatuses.includes(p.status)) || (p.paymentStatus&&!["pending","paid","refunded"].includes(p.paymentStatus)))return c.json({error:"INVALID_ORDER_PATCH"},400);
    const patch:OrderPatch={expectedVersion:p.expectedVersion,...(p.status ? {status:p.status}:{}),...(p.paymentStatus ? {paymentStatus:p.paymentStatus}:{})};
    const result=await repo(c.env).updateOrder(c.get("identity").subject,storeId,id,patch);
    if(result.kind==="not_found")return c.json({error:"ORDER_NOT_FOUND"},404);
    if(result.kind==="forbidden")return c.json({error:"OWNER_REQUIRED"},403);
    if(result.kind==="conflict")return c.json({error:"ORDER_CHANGED"},409);
    if(result.kind==="invalid_transition")return c.json({error:"INVALID_ORDER_TRANSITION"},409);
    return c.json({order:result.order});
  });
  app.get("/v1/admin/stores/:storeId/team",async c=>{
    const id=c.req.param("storeId");if(!uuid(id))return c.json({error:"STORE_NOT_FOUND"},404);
    const team=await repo(c.env).listTeam(c.get("identity").subject,id);return team ? c.json(team) : c.json({error:"OWNER_REQUIRED"},403);
  });
  app.post("/v1/admin/stores/:storeId/team/invitations",async c=>{
    const id=c.req.param("storeId");if(!uuid(id))return c.json({error:"STORE_NOT_FOUND"},404);
    let p:any;try{p=await c.req.json();}catch{return c.json({error:"INVALID_JSON"},400);}
    const email=typeof p?.email==="string" ? p.email.trim().toLowerCase() : "";
    if(email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return c.json({error:"INVALID_EMAIL"},400);
    const origin=c.env.TRIGENYS_COMMERCE_FACTORY_WEB_ORIGIN?.trim();
    if(!origin || !/^https:\/\/[^/]+\/?$/.test(origin))return c.json({error:"WEB_ORIGIN_NOT_CONFIGURED"},503);
    const secret=randomSecret();const inv=await repo(c.env).createInvitation(c.get("identity").subject,id,crypto.randomUUID(),email,await hashSecret(secret));
    if(!inv)return c.json({error:"OWNER_REQUIRED"},403);
    return c.json({invitation:inv,href:origin.replace(/\/$/,"")+"/app/accept-invitation#token="+secret},201);
  });
  app.delete("/v1/admin/stores/:storeId/team/invitations/:id",async c=>{
    const storeId=c.req.param("storeId"),id=c.req.param("id");if(!uuid(storeId)||!uuid(id))return c.json({error:"INVITATION_NOT_FOUND"},404);
    return await repo(c.env).revokeInvitation(c.get("identity").subject,storeId,id) ? c.body(null,204) : c.json({error:"INVITATION_NOT_FOUND"},404);
  });
  app.delete("/v1/admin/stores/:storeId/team/members/:id",async c=>{
    const storeId=c.req.param("storeId"),id=c.req.param("id");if(!uuid(storeId)||!uuid(id))return c.json({error:"MEMBER_NOT_FOUND"},404);
    return await repo(c.env).removeMember(c.get("identity").subject,storeId,id) ? c.body(null,204) : c.json({error:"MEMBER_NOT_FOUND"},404);
  });
  app.post("/v1/admin/invitations/accept",async c=>{
    let p:any;try{p=await c.req.json();}catch{return c.json({error:"INVALID_JSON"},400);}
    const identity=c.get("identity");if(!identity.email || !identity.emailVerified)return c.json({error:"EMAIL_VERIFICATION_REQUIRED"},403);
    if(!token(p?.token))return c.json({error:"INVITATION_NOT_FOUND"},404);
    const result=await repo(c.env).acceptInvitation(identity.subject,identity.email,await hashSecret(p.token));return result ? c.json(result) : c.json({error:"INVITATION_NOT_FOUND"},404);
  });
  app.post("/v1/public/support",async c=>{
    if(limited(c.req.header("CF-Connecting-IP") || "unknown","support",8))return c.json({error:"RATE_LIMITED"},429);
    let p:any;try{p=await c.req.json();}catch{return c.json({error:"INVALID_JSON"},400);}
    const name=optionalText(p?.name,120),email=optionalText(p?.email,254),message=optionalText(p?.message,4000),storeSlug=optionalText(p?.storeSlug,80);
    if(!uuid(p?.id)||!token(p?.trackingToken)||!name||!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!message||message.length<10||storeSlug===false||p?.website)return c.json({error:"INVALID_SUPPORT_REQUEST"},400);
    const ticket=await repo(c.env).createSupport({id:p.id,trackingHash:await hashSecret(p.trackingToken),name,email:email.toLowerCase(),message,storeSlug});c.header("Cache-Control","no-store");return c.json({ticket},201);
  });
  app.get("/v1/public/support/:id",async c=>{
    const id=c.req.param("id"),secret=c.req.header("X-Support-Token");if(!uuid(id)||!token(secret))return c.json({error:"REQUEST_NOT_FOUND"},404);
    const ticket=await repo(c.env).getPublicSupport(id,await hashSecret(secret));c.header("Cache-Control","no-store");return ticket ? c.json({ticket}) : c.json({error:"REQUEST_NOT_FOUND"},404);
  });
  app.get("/v1/admin/platform/stores",async c=>{
    const stores=await repo(c.env).listPlatformStores(c.get("identity").subject,(c.req.query("q")||"").slice(0,80));return stores ? c.json({stores}) : c.json({error:"PLATFORM_ACCESS_REQUIRED"},403);
  });
  app.get("/v1/admin/platform/support",async c=>{
    const tickets=await repo(c.env).listSupport(c.get("identity").subject);return tickets ? c.json({tickets}) : c.json({error:"PLATFORM_ACCESS_REQUIRED"},403);
  });
  app.patch("/v1/admin/platform/support/:id",async c=>{
    const id=c.req.param("id");if(!uuid(id))return c.json({error:"REQUEST_NOT_FOUND"},404);
    let p:any;try{p=await c.req.json();}catch{return c.json({error:"INVALID_JSON"},400);}
    const reply=optionalText(p?.reply,4000);if(!["open","in_progress","resolved"].includes(p?.status)||reply===false||(p.status==="resolved"&&!reply))return c.json({error:"INVALID_SUPPORT_REPLY"},400);
    const ticket=await repo(c.env).updateSupport(c.get("identity").subject,id,p.status,reply || "");return ticket ? c.json({ticket}) : c.json({error:"PLATFORM_ACCESS_REQUIRED"},403);
  });
}
