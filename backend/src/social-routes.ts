import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { isSocialProvider, parseImportFields, socialProviders, type SocialProvider } from "../../shared/social-connections.ts";
import type { AppEnv } from "./app.ts";
import { createSocialAdapter, SocialProviderError, validProviderToken } from "./social-providers.ts";
import { createSocialRepository } from "./social-repository.ts";
import { decryptToken, encryptToken, hashSecret, randomSecret } from "./social-secrets.ts";
import type { SocialAdapterFactory, SocialRepository } from "./social-types.ts";
import type { CommerceRepository, WorkerBindings } from "./types.ts";

const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const secret = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const cookieName = (provider: SocialProvider) => "__Host-cf-social-"+provider;
const tokenContext = (storeId: string, provider: SocialProvider, revision: string) => "commerce-social:v1:"+storeId+":"+provider+":"+revision;
function webOrigin(env: WorkerBindings): string | null {
  try {
    const u=new URL(env.TRIGENYS_COMMERCE_FACTORY_WEB_ORIGIN || "");
    return u.protocol==="https:" && !u.username && !u.password && !u.search && !u.hash && u.pathname==="/" ? u.origin : null;
  } catch {return null;}
}

export function registerSocialRoutes(app: Hono<AppEnv>, coreFactory: (env: WorkerBindings) => CommerceRepository,
  repositoryFactory?: (env: WorkerBindings) => SocialRepository, adapterFactory: SocialAdapterFactory = createSocialAdapter) {
  const repository = (env: WorkerBindings) => repositoryFactory ? repositoryFactory(env) : createSocialRepository(env.TRIGENYS_COMMERCE_FACTORY_DATABASE_URL || "");
  async function allowed(c:Context<AppEnv>, actor:string):Promise<boolean> {
    if(!c.env.SOCIAL_RATE_LIMITER)return false;
    return (await c.env.SOCIAL_RATE_LIMITER.limit({key:await hashSecret(actor)})).success;
  }
  for (const path of ["/v1/social/*","/v1/admin/stores/:storeId/connections*"]) app.use(path,async(c,next)=>{
    c.header("Cache-Control","private, no-store");c.header("Referrer-Policy","no-referrer");await next();
  });
  app.use("/v1/admin/stores/:storeId/connections/*",bodyLimit({maxSize:8192,onError:c=>c.json({error:"REQUEST_TOO_LARGE"},413)}));
  function returnHref(env: WorkerBindings, result: string, provider: SocialProvider, storeId?: string, extra: Record<string,string>={}) {
    const origin=webOrigin(env);if (!origin) throw new Error("SOCIAL_WEB_ORIGIN_NOT_CONFIGURED");
    return origin+"/app/connections"+(storeId ? "?store="+storeId : "")+"#"+new URLSearchParams({social_result:result,provider,...extra});
  }
  app.get("/v1/admin/stores/:storeId/connections",async c=>{
    const storeId=c.req.param("storeId");if (!uuid(storeId)) return c.json({error:"STORE_NOT_FOUND"},404);
    const repo=repository(c.env);await repo.cleanupExpired();
    const connections=await repo.listConnections(c.get("identity").subject,storeId);
    if (!connections) return c.json({error:"OWNER_REQUIRED"},403);
    return c.json({connections:socialProviders.map(provider=>({provider,status:"disconnected",accountName:null,connectedAt:null,expiresAt:null,importedAt:null,lastError:null,
      ...connections.find(v=>v.provider===provider),available:Boolean(c.env.SOCIAL_RATE_LIMITER && adapterFactory(provider,c.env))}))});
  });
  app.post("/v1/admin/stores/:storeId/connections/:provider/start",async c=>{
    const storeId=c.req.param("storeId"),provider=c.req.param("provider");
    if (!uuid(storeId) || !isSocialProvider(provider)) return c.json({error:"CONNECTION_NOT_FOUND"},404);
    if (!c.env.SOCIAL_RATE_LIMITER || !adapterFactory(provider,c.env) || !webOrigin(c.env)) return c.json({error:"CONNECTION_UNAVAILABLE"},503);
    if(!await allowed(c,"owner:"+c.get("identity").subject)){c.header("Retry-After","60");return c.json({error:"RATE_LIMITED"},429);}
    const origin=new URL(c.req.url).origin;if (!origin.startsWith("https://")) return c.json({error:"CONNECTION_UNAVAILABLE"},503);
    const repo=repository(c.env);await repo.cleanupExpired();
    const ticket=randomSecret();const id=crypto.randomUUID();
    const ok=await repo.createAttempt({id,storeId,provider,subject:c.get("identity").subject,redirectUri:origin+"/v1/social/callback/"+provider},await hashSecret(ticket));
    return ok ? c.json({href:origin+"/v1/social/start/"+provider+"?ticket="+ticket},201) : c.json({error:"OWNER_REQUIRED"},403);
  });
  app.get("/v1/social/start/:provider",async c=>{
    const provider=c.req.param("provider"),ticket=c.req.query("ticket");
    if (!isSocialProvider(provider) || !secret(ticket)) return c.json({error:"INVALID_CONNECTION_REQUEST"},400);
    const adapter=adapterFactory(provider,c.env);if (!c.env.SOCIAL_RATE_LIMITER || !adapter || !webOrigin(c.env)) return c.json({error:"CONNECTION_UNAVAILABLE"},503);
    if(!await allowed(c,"public:"+(c.req.header("CF-Connecting-IP") || "unknown"))){c.header("Retry-After","60");return c.json({error:"RATE_LIMITED"},429);}
    const state=randomSecret(),browser=randomSecret();
    const attempt=await repository(c.env).startAttempt(await hashSecret(ticket),await hashSecret(state),await hashSecret(browser));
    if (!attempt || attempt.provider!==provider) return c.redirect(returnHref(c.env,"expired",provider),303);
    if (new URL(c.req.url).origin+"/v1/social/callback/"+provider !== attempt.redirectUri) return c.redirect(returnHref(c.env,"expired",provider),303);
    setCookie(c,cookieName(provider),browser,{httpOnly:true,secure:true,sameSite:"Lax",path:"/",maxAge:600});
    return c.redirect(adapter.authorizationUrl(state,attempt.redirectUri),303);
  });
  app.get("/v1/social/callback/:provider",async c=>{
    const provider=c.req.param("provider"),state=c.req.query("state");
    if (!isSocialProvider(provider)) return c.json({error:"CONNECTION_NOT_FOUND"},404);
    if (!webOrigin(c.env)) return c.json({error:"CONNECTION_UNAVAILABLE"},503);
    const browser=getCookie(c,cookieName(provider));
    if (!secret(state) || !secret(browser)) return c.redirect(returnHref(c.env,"expired",provider),303);
    if(!c.env.SOCIAL_RATE_LIMITER)return c.redirect(returnHref(c.env,"failed",provider),303);
    if(!await allowed(c,"public:"+(c.req.header("CF-Connecting-IP") || "unknown"))){c.header("Retry-After","60");return c.json({error:"RATE_LIMITED"},429);}
    const repo=repository(c.env),attempt=await repo.claimCallback(provider,await hashSecret(state),await hashSecret(browser));
    if (!attempt) return c.redirect(returnHref(c.env,"expired",provider),303);
    deleteCookie(c,cookieName(provider),{httpOnly:true,secure:true,sameSite:"Lax",path:"/"});
    const adapter=adapterFactory(provider,c.env),code=c.req.query("code");
    if (!adapter || new URL(c.req.url).origin+"/v1/social/callback/"+provider!==attempt.redirectUri || c.req.query("error") || !code || code.length>2048) {
      await repo.failAttempt(attempt.id);
      return c.redirect(returnHref(c.env,c.req.query("error")==="access_denied" ? "cancelled" : "failed",provider,attempt.storeId),303);
    }
    try {
      const token=await adapter.exchange(code,attempt.redirectUri);
      if (!validProviderToken(token) || Date.parse(token.expiresAt)<=Date.now()) throw new Error("INVALID_PROVIDER_TOKEN");
      const encrypted=await encryptToken(token,c.env.SOCIAL_TOKENS_KEY!,tokenContext(attempt.storeId,provider,attempt.id));
      const result=randomSecret();
      if (!await repo.readyAttempt(attempt.id,encrypted,token.expiresAt,await hashSecret(result))) throw new Error("CONNECTION_EXPIRED");
      // Only this browser receives the final ticket. A bearer-authenticated owner must redeem it.
      return c.redirect(returnHref(c.env,"ready",provider,attempt.storeId,{attempt:attempt.id,ticket:result}),303);
    } catch {
      await repo.failAttempt(attempt.id);
      return c.redirect(returnHref(c.env,"failed",provider,attempt.storeId),303);
    }
  });
  app.post("/v1/admin/stores/:storeId/connections/complete",async c=>{
    let p:any;try {p=await c.req.json();} catch {return c.json({error:"INVALID_JSON"},400);}
    const storeId=c.req.param("storeId");
    if (!uuid(storeId) || !uuid(p?.attempt) || !secret(p?.ticket) || Object.keys(p).some(k=>!["attempt","ticket"].includes(k))) return c.json({error:"INVALID_CONNECTION_REQUEST"},400);
    const ok=await repository(c.env).finishAttempt(c.get("identity").subject,storeId,p.attempt,await hashSecret(p.ticket));
    return ok ? c.json({connected:true}) : c.json({error:"CONNECTION_EXPIRED_OR_WRONG_ACCOUNT"},409);
  });
  async function accountList(c: Context<AppEnv>, selectedId?: string) {
    const {storeId,provider}=c.req.param();
    if (!uuid(storeId) || !isSocialProvider(provider)) return {kind:"error" as const,error:"CONNECTION_NOT_FOUND",status:404 as const};
    const adapter=adapterFactory(provider,c.env);if (!c.env.SOCIAL_RATE_LIMITER || !adapter) return {kind:"error" as const,error:"CONNECTION_UNAVAILABLE",status:503 as const};
    if(!await allowed(c,"owner:"+c.get("identity").subject)){c.header("Retry-After","60");return {kind:"error" as const,error:"RATE_LIMITED",status:429 as const};}
    const repo=repository(c.env),subject=c.get("identity").subject;
    const connection=await repo.getConnection(subject,storeId,provider);
    if (!connection) return {kind:"error" as const,error:"CONNECTION_REQUIRED",status:409 as const};
    try {
      const t=await decryptToken(connection.encryptedToken,c.env.SOCIAL_TOKENS_KEY!,tokenContext(storeId,provider,connection.revision));
      if (!validProviderToken(t) || Date.parse(t.expiresAt)<=Date.now()) throw new SocialProviderError("TOKEN_EXPIRED");
      const accounts=await adapter.accounts(t,selectedId);
      return {kind:"ok" as const,accounts,connection,subject,storeId,provider};
    } catch (error) {
      const code=error instanceof SocialProviderError ? error.code : "PROVIDER_UNAVAILABLE";
      await repo.markError(subject,storeId,provider,connection.revision,code);
      return {kind:"error" as const,error:code,status:code==="PROVIDER_UNAVAILABLE" ? 502 as const : 409 as const};
    }
  }
  app.get("/v1/admin/stores/:storeId/connections/:provider/accounts",async c=>{
    const result=await accountList(c);
    return result.kind === "error" ? c.json({error:result.error},result.status) : c.json({accounts:result.accounts.map(({id,name,profileUrl})=>({id,name,profileUrl}))});
  });
  app.post("/v1/admin/stores/:storeId/connections/:provider/previews",async c=>{
    let p:any;try {p=await c.req.json();} catch {return c.json({error:"INVALID_JSON"},400);}
    if (!p || typeof p.accountId!=="string" || !p.accountId || p.accountId.length>255 || Object.keys(p).some(k=>k!=="accountId")) return c.json({error:"INVALID_ACCOUNT"},400);
    const result=await accountList(c,p.accountId);
    if (result.kind === "error") return c.json({error:result.error},result.status);
    const selected=result.accounts.find(v=>v.id===p.accountId);
    if (!selected) return c.json({error:"ACCOUNT_NOT_AUTHORIZED"},404);
    const preview=await repository(c.env).createPreview(result.subject,result.storeId,result.provider,result.connection.revision,selected);
    return preview ? c.json({preview},201) : c.json({error:"CONNECTION_CHANGED"},409);
  });
  app.get("/v1/admin/stores/:storeId/connections/previews/:id",async c=>{
    const storeId=c.req.param("storeId"),id=c.req.param("id");if (!uuid(storeId) || !uuid(id)) return c.json({error:"PREVIEW_NOT_FOUND"},404);
    const preview=await repository(c.env).getPreview(c.get("identity").subject,storeId,id);
    return preview ? c.json({preview}) : c.json({error:"PREVIEW_NOT_FOUND"},404);
  });
  app.post("/v1/admin/stores/:storeId/connections/previews/:id/apply",async c=>{
    let p:any;try {p=await c.req.json();} catch {return c.json({error:"INVALID_JSON"},400);}
    const storeId=c.req.param("storeId"),id=c.req.param("id"),fields=parseImportFields(p?.fields);
    if (!uuid(storeId) || !uuid(id) || !fields || Object.keys(p).some(k=>k!=="fields")) return c.json({error:"INVALID_IMPORT"},400);
    const result=await repository(c.env).applyPreview(c.get("identity").subject,storeId,id,fields);
    if (result!=="applied" && result!=="already_applied") return c.json({error:"PREVIEW_"+result.toUpperCase()},result==="not_found" ? 404 : 409);
    const store=await coreFactory(c.env).getOwnedStore(c.get("identity").subject,storeId);
    return store ? c.json({store,result}) : c.json({error:"OWNER_REQUIRED"},403);
  });
  app.delete("/v1/admin/stores/:storeId/connections/:provider",async c=>{
    const storeId=c.req.param("storeId"),provider=c.req.param("provider");if (!uuid(storeId) || !isSocialProvider(provider)) return c.json({error:"CONNECTION_NOT_FOUND"},404);
    return await repository(c.env).disconnect(c.get("identity").subject,storeId,provider) ? c.body(null,204) : c.json({error:"OWNER_REQUIRED"},403);
  });
}
