import type { ImportField, SocialAccount, SocialProvider } from "../../shared/social-connections.ts";
import { validEncryptionKey } from "./social-secrets.ts";
import type { ProviderToken, SocialAdapterFactory } from "./social-types.ts";

export class SocialProviderError extends Error {
  readonly code: "PERMISSION_REQUIRED" | "PROVIDER_UNAVAILABLE" | "TOKEN_EXPIRED";
  constructor(code: SocialProviderError["code"]) { super(code); this.code=code; }
}
const fail = (code: SocialProviderError["code"] = "PROVIDER_UNAVAILABLE"): never => { throw new SocialProviderError(code); };
const numericId = (value: unknown): value is string => typeof value === "string" && /^\d{1,40}$/.test(value);

async function providerJson(url: string | URL, init: RequestInit = {}): Promise<any> {
  let response: Response;
  try { response = await fetch(url, {...init,redirect:"error",signal:AbortSignal.timeout(12000)}); }
  catch { return fail(); }
  const reader = response.body?.getReader();
  if (!reader) return fail();
  let size = 0, content = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const {value,done} = await reader.read(); if (done) break;
      size += value.length; if (size > 1024 * 1024) { await reader.cancel(); return fail(); }
      content += decoder.decode(value,{stream:true});
    }
    content += decoder.decode();
    const body = JSON.parse(content);
    if (!response.ok || body?.error && body.error.code !== "ok") {
      if ([190,"access_token_invalid","invalid_grant"].includes(body?.error?.code) || response.status === 401) return fail("TOKEN_EXPIRED");
      if ([10,200,"scope_not_authorized"].includes(body?.error?.code) || response.status === 403) return fail("PERMISSION_REQUIRED");
      return fail();
    }
    return body;
  } catch (error) { if (error instanceof SocialProviderError) throw error; return fail(); }
}

function token(accessToken: unknown, scopes: string[], expires: unknown): ProviderToken {
  if (typeof accessToken !== "string" || accessToken.length < 8 || accessToken.length > 8192) return fail();
  const seconds = expires === undefined ? 3600 : Number(expires);
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 366 * 24 * 3600) return fail();
  return {accessToken,scopes,expiresAt:new Date(Date.now()+seconds*1000).toISOString()};
}
export function validProviderToken(value: unknown): value is ProviderToken {
  if (!value || typeof value !== "object") return false;
  const v=value as ProviderToken;
  return typeof v.accessToken === "string" && v.accessToken.length >= 8 && v.accessToken.length <= 8192 &&
    Array.isArray(v.scopes) && v.scopes.length <= 40 && v.scopes.every(s=>typeof s === "string" && s.length<=80) &&
    typeof v.expiresAt === "string" && Number.isFinite(Date.parse(v.expiresAt));
}
function account(id: string, name: unknown, profileUrl: string | null, fields: Record<string,unknown>): SocialAccount {
  const result: SocialAccount = {id,name:typeof name === "string" ? name.slice(0,120) : id,profileUrl,values:{},truncatedFields:[]};
  const limits: Record<ImportField,number> = {name:120,description:280,businessLocation:180,contactEmail:254};
  for (const [field,limit] of Object.entries(limits) as [ImportField,number][]) {
    const raw=fields[field]; if (typeof raw !== "string") continue;
    const clean=raw.trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"");
    if (!clean || field === "name" && clean.length < 2 || field === "contactEmail" && (clean.length>limit || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean))) continue;
    result.values[field]=clean.slice(0,limit);
    if (clean.length>limit) result.truncatedFields.push(field);
  }
  return result;
}
async function proof(accessToken: string, secret: string): Promise<string> {
  const encoder=new TextEncoder();
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(accessToken))),b=>b.toString(16).padStart(2,"0")).join("");
}

export const createSocialAdapter: SocialAdapterFactory = (provider,env) => {
  if (!validEncryptionKey(env.SOCIAL_TOKENS_KEY) || !env.SOCIAL_APPROVED_PROVIDERS?.split(",").map(v=>v.trim()).includes(provider)) return null;
  if (provider === "tiktok") {
    const clientKey=env.SOCIAL_TIKTOK_CLIENT_KEY?.trim(),clientSecret=env.SOCIAL_TIKTOK_CLIENT_SECRET;
    if (!clientKey || !clientSecret) return null;
    return {
      authorizationUrl(state,redirectUri) {
        const url=new URL("https://www.tiktok.com/v2/auth/authorize/");
        url.search=new URLSearchParams({client_key:clientKey,response_type:"code",scope:"user.info.basic,user.info.profile",redirect_uri:redirectUri,state,disable_auto_auth:"1"}).toString();
        return url.toString();
      },
      async exchange(code,redirectUri) {
        const result=await providerJson("https://open.tiktokapis.com/v2/oauth/token/",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
          body:new URLSearchParams({client_key:clientKey,client_secret:clientSecret,grant_type:"authorization_code",code,redirect_uri:redirectUri})});
        const scopes=typeof result.scope === "string" ? result.scope.split(",").map((s:string)=>s.trim()) : [];
        if (!scopes.includes("user.info.basic")) return fail("PERMISSION_REQUIRED");
        return token(result.access_token,scopes,result.expires_in);
      },
      async accounts(t,selectedId) {
        const fields=["open_id","display_name"];
        if (t.scopes.includes("user.info.profile")) fields.push("bio_description","profile_deep_link");
        const url=new URL("https://open.tiktokapis.com/v2/user/info/");url.searchParams.set("fields",fields.join(","));
        const result=await providerJson(url,{headers:{Authorization:"Bearer "+t.accessToken}}),u=result.data?.user;
        if (!u || typeof u.open_id !== "string" || u.open_id.length>255 || !u.open_id) return fail();
        if (selectedId && selectedId!==u.open_id) return [];
        let link: string | null=null;
        try { const parsed=new URL(u.profile_deep_link);if (t.scopes.includes("user.info.profile") && ["www.tiktok.com","tiktok.com"].includes(parsed.hostname) && parsed.protocol==="https:" && !parsed.username && !parsed.password && parsed.pathname.startsWith("/@")) link=parsed.origin+parsed.pathname; } catch { /* Profile link is optional. */ }
        return [account(u.open_id,u.display_name,link,{name:u.display_name,description:t.scopes.includes("user.info.profile") ? u.bio_description : undefined})];
      }
    };
  }
  const appId=env.SOCIAL_META_APP_ID?.trim(),appSecret=env.SOCIAL_META_APP_SECRET,version=env.SOCIAL_META_GRAPH_VERSION?.trim();
  const configId=provider === "facebook" ? env.SOCIAL_FACEBOOK_CONFIG_ID?.trim() : env.SOCIAL_INSTAGRAM_CONFIG_ID?.trim();
  if (!numericId(appId) || !appSecret || !version || !/^v\d{2}\.0$/.test(version) || !numericId(configId)) return null;
  const scopes=provider === "facebook" ? ["pages_show_list","pages_read_engagement"] : ["pages_show_list","pages_read_engagement","instagram_basic"];
  async function graph(path: string,accessToken: string,params: Record<string,string>={}) {
    const url=new URL("https://graph.facebook.com/"+version+"/"+path);
    url.search=new URLSearchParams({...params,appsecret_proof:await proof(accessToken,appSecret!)}).toString();
    return providerJson(url,{headers:{Authorization:"Bearer "+accessToken}});
  }
  return {
    authorizationUrl(state,redirectUri) {
      const url=new URL("https://www.facebook.com/"+version+"/dialog/oauth");
      url.search=new URLSearchParams({client_id:appId,config_id:configId,response_type:"code",override_default_response_type:"true",scope:scopes.join(","),redirect_uri:redirectUri,state}).toString();
      return url.toString();
    },
    async exchange(code,redirectUri) {
      const url=new URL("https://graph.facebook.com/"+version+"/oauth/access_token");
      url.search=new URLSearchParams({client_id:appId,client_secret:appSecret,code,redirect_uri:redirectUri}).toString();
      const result=await providerJson(url),t=token(result.access_token,[],result.expires_in);
      const permissions=await graph("me/permissions",t.accessToken);
      if (!Array.isArray(permissions.data)) return fail();
      const granted=permissions.data.filter((p:any)=>p.status==="granted").map((p:any)=>p.permission);
      if (scopes.some(scope=>!granted.includes(scope))) return fail("PERMISSION_REQUIRED");
      return {...t,scopes};
    },
    async accounts(t,selectedId) {
      if (scopes.some(scope=>!t.scopes.includes(scope))) return fail("PERMISSION_REQUIRED");
      const pages: any[]=[];let cursor: string | undefined;
      for (let batch=0;batch<5;batch++) {
        const result=await graph("me/accounts",t.accessToken,{fields:"id,name,access_token"+(provider === "instagram" ? ",instagram_business_account" : ""),limit:"100",...(cursor ? {after:cursor}:{})});
        if (!Array.isArray(result.data)) return fail();pages.push(...result.data);
        cursor=result.paging?.next && typeof result.paging?.cursors?.after === "string" ? result.paging.cursors.after : undefined;
        if (!cursor) break;
        if (cursor.length>2048 || batch===4) return fail();
      }
      const output: SocialAccount[]=[];
      for (const page of pages) {
        const id=provider === "instagram" ? page.instagram_business_account?.id : page.id;
        if (!numericId(id) || output.some(a=>a.id===id) || selectedId && selectedId!==id) continue;
        if (!selectedId) {output.push(account(id,page.name,provider === "facebook" ? "https://www.facebook.com/"+id : null,{}));continue;}
        if (typeof page.access_token !== "string" || page.access_token.length>8192) return fail("PERMISSION_REQUIRED");
        if (provider === "facebook") {
          const p=await graph(id,page.access_token,{fields:"id,name,about,description,location,emails,link"});
          const location=p.location && typeof p.location === "object" ? [p.location.street,p.location.city,p.location.country].filter(v=>typeof v==="string").join(", ") : "";
          output.push(account(id,p.name,"https://www.facebook.com/"+id,{name:p.name,description:p.description || p.about,businessLocation:location,contactEmail:Array.isArray(p.emails) ? p.emails[0] : undefined}));
        } else {
          const p=await graph(id,page.access_token,{fields:"id,name,username,biography"});
          const link=typeof p.username === "string" && /^[A-Za-z0-9_.]{1,30}$/.test(p.username) ? "https://www.instagram.com/"+p.username+"/" : null;
          output.push(account(id,p.name || p.username,link,{name:p.name || p.username,description:p.biography}));
        }
      }
      return output;
    }
  };
};
