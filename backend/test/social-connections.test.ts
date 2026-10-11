import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.ts";
import { createSocialAdapter, SocialProviderError } from "../src/social-providers.ts";
import { decryptToken, encryptToken, validEncryptionKey } from "../src/social-secrets.ts";
import { parseImportFields } from "../../shared/social-connections.ts";

const encryptionKey=Buffer.from(new Uint8Array(32).fill(41)).toString("base64");
const configured={SOCIAL_TOKENS_KEY:encryptionKey,SOCIAL_APPROVED_PROVIDERS:"facebook,instagram,tiktok",SOCIAL_META_APP_ID:"12345",SOCIAL_META_APP_SECRET:"test-app-secret",SOCIAL_META_GRAPH_VERSION:"v24.0",SOCIAL_FACEBOOK_CONFIG_ID:"23456",SOCIAL_INSTAGRAM_CONFIG_ID:"34567",SOCIAL_TIKTOK_CLIENT_KEY:"test-client-key",SOCIAL_TIKTOK_CLIENT_SECRET:"test-client-secret"};
const t={accessToken:"test-access-token",scopes:["user.info.basic"],expiresAt:new Date(Date.now()+3600000).toISOString()};

test("encrypted provider credentials are bound to their store, provider and revision",async()=>{
  assert.equal(validEncryptionKey(encryptionKey),true);assert.equal(validEncryptionKey("weak-key"),false);
  const encrypted=await encryptToken(t,encryptionKey,"store-a:tiktok:revision-a");
  assert.ok(!encrypted.includes(t.accessToken));assert.deepEqual(await decryptToken(encrypted,encryptionKey,"store-a:tiktok:revision-a"),t);
  await assert.rejects(()=>decryptToken(encrypted,encryptionKey,"store-b:tiktok:revision-a"));
  await assert.rejects(()=>decryptToken(encrypted,encryptionKey,"store-a:facebook:revision-a"));
  const parts=encrypted.split(".");const cipher=Buffer.from(parts[2],"base64");cipher[0]^=1;parts[2]=cipher.toString("base64");
  await assert.rejects(()=>decryptToken(parts.join("."),encryptionKey,"store-a:tiktok:revision-a"));
});
test("no social provider is active without complete reviewed application configuration",()=>{
  for(const p of ["facebook","instagram","tiktok"] as const){assert.equal(createSocialAdapter(p,{}),null);assert.equal(createSocialAdapter(p,{...configured,SOCIAL_APPROVED_PROVIDERS:""}),null);assert.equal(createSocialAdapter(p,{...configured,SOCIAL_TOKENS_KEY:"weak"}),null);assert.ok(createSocialAdapter(p,configured));}
  assert.equal(createSocialAdapter("facebook",{...configured,SOCIAL_FACEBOOK_CONFIG_ID:undefined}),null);
  assert.equal(createSocialAdapter("instagram",{...configured,SOCIAL_META_GRAPH_VERSION:undefined}),null);
});
test("Google capability is explicit and disabled by default",async()=>{
  const app=createApp();
  assert.equal((await (await app.request("/v1/config",{},{})).json() as any).googleSignInEnabled,false);
  assert.equal((await (await app.request("/v1/config",{},{TRIGENYS_COMMERCE_FACTORY_GOOGLE_SIGN_IN:"enabled"})).json() as any).googleSignInEnabled,true);
});
test("imports accept only a non-empty, unique field selection",()=>{
  for(const fields of [[],["price"],["name","name"],"name",null])assert.equal(parseImportFields(fields),null);
  assert.deepEqual(parseImportFields(["name","description"]),["description","name"]);
});
test("TikTok partial consent imports the name without requesting an ungranted biography scope",async()=>{
  const original=globalThis.fetch;const seen:string[]=[];
  globalThis.fetch=async input=>{const url=new URL(String(input));seen.push(url.searchParams.get("fields") || "");return Response.json({data:{user:{open_id:"account-1",display_name:"Atelier Dakar",bio_description:"Must not be requested"}},error:{code:"ok"}});};
  try{const a=createSocialAdapter("tiktok",configured)!;const accounts=await a.accounts(t);assert.equal(seen[0],"open_id,display_name");assert.equal(accounts[0].values.name,"Atelier Dakar");
    assert.equal(accounts[0].values.description,undefined);assert.deepEqual(await a.accounts(t,"another-account"),[]);
  }finally{globalThis.fetch=original;}
});
test("TikTok rejects denied basic scope and unsafe profile links; previews flag shortened text",async()=>{
  const original=globalThis.fetch;
  try{
    globalThis.fetch=async()=>Response.json({access_token:"test-access-token",scope:"user.info.profile",expires_in:3600});
    await assert.rejects(()=>createSocialAdapter("tiktok",configured)!.exchange("code","https://api.example/callback"),(e:unknown)=>e instanceof SocialProviderError && e.code==="PERMISSION_REQUIRED");
    globalThis.fetch=async()=>Response.json({data:{user:{open_id:"account-1",display_name:"Atelier Dakar",bio_description:"a".repeat(300),profile_deep_link:"https://attacker.example/"}},error:{code:"ok"}});
    const [a]=await createSocialAdapter("tiktok",configured)!.accounts({...t,scopes:["user.info.basic","user.info.profile"]});
    assert.equal(a.profileUrl,null);assert.equal(a.values.description?.length,280);assert.deepEqual(a.truncatedFields,["description"]);
  }finally{globalThis.fetch=original;}
});
test("Facebook never follows provider pagination URLs or imports a Page outside authorized assets",async()=>{
  const original=globalThis.fetch;const urls:string[]=[];
  globalThis.fetch=async input=>{const u=new URL(String(input));urls.push(u.toString());
    if(u.pathname.endsWith("me/accounts") && !u.searchParams.has("after"))return Response.json({data:[{id:"123",name:"Page A",access_token:"page-token-a"}],paging:{next:"https://attacker.example/token-leak",cursors:{after:"next-page"}}});
    return Response.json({data:[{id:"124",name:"Page B",access_token:"page-token-b"}]});
  };
  try{const a=createSocialAdapter("facebook",configured)!;const authorized={...t,scopes:["pages_show_list","pages_read_engagement"]};
    assert.equal((await a.accounts(authorized)).length,2);assert.ok(urls.every(url=>new URL(url).hostname==="graph.facebook.com"));
    assert.deepEqual(await a.accounts(authorized,"999"),[]);
  }finally{globalThis.fetch=original;}
});
test("Instagram only selects professional accounts linked to authorized Pages",async()=>{
  const original=globalThis.fetch;let detailCalls=0;
  globalThis.fetch=async input=>{
    const u=new URL(String(input));
    if(u.pathname.endsWith("me/accounts"))return Response.json({data:[{id:"123",name:"Page A",access_token:"page-token-a",instagram_business_account:{id:"777"}},{id:"124",name:"Personal Page",access_token:"page-token-b"}]});
    detailCalls++;assert.ok(u.pathname.endsWith("/777"));return Response.json({id:"777",name:"Atelier Dakar",username:"atelier_dakar",biography:"Créations locales"});
  };
  try{const a=createSocialAdapter("instagram",configured)!;const authorized={...t,scopes:["pages_show_list","pages_read_engagement","instagram_basic"]};
    assert.deepEqual((await a.accounts(authorized)).map(a=>a.id),["777"]);
    assert.deepEqual(await a.accounts(authorized,"888"),[]);assert.equal(detailCalls,0);
    const [profile]=await a.accounts(authorized,"777");assert.equal(profile.values.description,"Créations locales");assert.equal(profile.profileUrl,"https://www.instagram.com/atelier_dakar/");
  }finally{globalThis.fetch=original;}
});
