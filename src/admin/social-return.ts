import { isSocialProvider, type SocialProvider } from "../../shared/social-connections";

const key="commerce-social-return";
const uuid=(v:unknown):v is string=>typeof v==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
type SocialReturn={provider:SocialProvider;storeId:string|null;createdAt:number;result:"ready"|"cancelled"|"expired"|"failed";attempt?:string;ticket?:string};
let memory: SocialReturn|null=null;
function valid(v:unknown):v is SocialReturn {
  if(!v || typeof v!=="object")return false;
  const p=v as SocialReturn;
  return isSocialProvider(p.provider) && (p.storeId===null || uuid(p.storeId)) && Number.isFinite(p.createdAt) && p.createdAt<=Date.now() && Date.now()-p.createdAt<600000 &&
    (["cancelled","expired","failed"].includes(p.result) || p.result==="ready" && uuid(p.attempt) && typeof p.ticket==="string" && /^[a-f0-9]{64}$/.test(p.ticket));
}
export function captureSocialReturn(): void {
  if(window.location.pathname!=="/app/connections")return;
  const p=new URLSearchParams(window.location.hash.slice(1)),provider=p.get("provider"),result=p.get("social_result");
  if(!isSocialProvider(provider) || !["ready","cancelled","expired","failed"].includes(result || ""))return;
  const storeId=new URLSearchParams(window.location.search).get("store");
  const candidate={provider,result,storeId:uuid(storeId) ? storeId:null,attempt:p.get("attempt") || undefined,ticket:p.get("ticket") || undefined,createdAt:Date.now()};
  if(valid(candidate)){memory=candidate;try{sessionStorage.setItem(key,JSON.stringify(candidate));}catch{/* Memory still permits immediate completion. */}}
  window.history.replaceState(null,"",window.location.pathname+window.location.search);
}
export function pendingSocialReturn(): SocialReturn|null {
  try{const p=JSON.parse(sessionStorage.getItem(key)||"null");if(valid(p))return p;}catch{/* Storage is optional. */}
  return valid(memory) ? memory:null;
}
export function clearSocialReturn(): void {memory=null;try{sessionStorage.removeItem(key);}catch{/* Storage is optional. */}}
