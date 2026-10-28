// Browser interactions use the installed Neon SDK with isolated provider/API fixtures.
// This does not send email or verify live token redemption or production persistence.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { brandFixture, storeId, token } from "./brand-fixture.mjs";

const base="http://127.0.0.1:5178", output="artifacts/magic-link";
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","5178","--strictPort"],{stdio:"pipe",env:{...process.env,VITE_API_BASE_URL:"http://127.0.0.1:8787",VITE_MAGIC_LINK_ENABLED:"true"}});
let log="",browser,currentPage;
server.stdout.on("data",b=>log+=b);server.stderr.on("data",b=>log+=b);
const report={checks:[],screens:[],unverified:["Provider/API responses are fixtures. Real email delivery, single-use expiration, cross-browser session establishment and database persistence need the enabled Neon branch and an owned mailbox."]};
const axe=await readFile("node_modules/axe-core/axe.min.js","utf8");

async function fixture(options={}) {
  const f=await brandFixture(browser,base,{authenticated:false,...options});currentPage=f.page;
  f.links=[];f.failLink=false;f.holdLink=null;
  await f.page.route("**/neondb/auth/sign-in/magic-link",async route=>{
    const request=route.request(),headers={"Access-Control-Allow-Origin":base,"Access-Control-Allow-Credentials":"true","Access-Control-Allow-Headers":request.headers()["access-control-request-headers"] || "*","Access-Control-Allow-Methods":"POST,OPTIONS"};
    if(request.method()==="OPTIONS")return route.fulfill({status:204,headers});
    f.links.push(request.postDataJSON());
    if(f.holdLink)await f.holdLink;
    return route.fulfill({status:f.failLink ? 503:200,headers,json:f.failLink ? {code:"UNAVAILABLE",message:"Provider unavailable"}:{status:true}});
  });
  return f;
}
async function check(page,label) {
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,label+": overflow");
  await page.evaluate(axe);
  const violations=await page.evaluate(async()=>{
    const r=await window.axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]}});
    return r.violations.filter(v=>["serious","critical"].includes(v.impact)).map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}));
  });
  assert.deepEqual(violations,[],label+": accessibility");
  await page.screenshot({path:output+"/"+label+".png",fullPage:true});report.screens.push(label);
}
try {
  await mkdir(output,{recursive:true});let ready=false;
  for(let i=0;i<60;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await delay(100);}assert.ok(ready,log);
  browser=await chromium.launch({headless:true});
  for(const [language,width] of [["fr",1440],["fr",390],["en",390]]){
    const f=await fixture({language,width}),{page,state,context}=f;
    await page.clock.install();await page.goto(base+"/app/orders?store="+storeId);
    await page.getByRole("button",{name:language==="fr" ? "Connexion":"Log in",exact:true}).click();
    await page.getByRole("button",{name:language==="fr" ? "Lien par email":"Email link",exact:true}).click();
    assert.equal(await page.locator('input[type="password"]').count(),0);
    await page.getByLabel("Email",{exact:true}).fill("owner@example.com");
    let release;f.holdLink=new Promise(resolve=>{release=resolve;});
    const requestArrived=page.waitForRequest(r=>r.url().endsWith("/sign-in/magic-link")&&r.method()==="POST");
    await page.getByRole("button",{name:language==="fr" ? "Recevoir mon lien de connexion":"Send my sign-in link",exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#commerce-account-form')?.getAttribute('aria-busy')==='true');
    assert.equal(await page.getByRole("button",{name:language==="fr" ? "Veuillez patienter…":"Please wait…",exact:true}).isDisabled(),true);
    await requestArrived;
    release();
    await page.getByRole("status").filter({hasText:language==="fr" ? "Si cette adresse":"If this address"}).waitFor();
    assert.equal(f.links.length,1);assert.equal(f.links[0].email,"owner@example.com");assert.equal(f.links[0].password,undefined);
    assert.equal(f.links[0].callbackURL,f.links[0].newUserCallbackURL);assert.ok(f.links[0].errorCallbackURL.endsWith("&link_error=1"));
    assert.equal(new URL(f.links[0].callbackURL).origin,base);assert.equal(new URL(f.links[0].callbackURL).pathname,"/app/email-link");
    assert.equal(new URL(f.links[0].callbackURL).searchParams.get("lang"),language);
    assert.equal(await page.getByRole("status").filter({hasText:language==="fr" ? "Si cette adresse":"If this address"}).evaluate(e=>e===document.activeElement),true);
    await check(page,"link-sent-"+language+"-"+width);
    await page.clock.fastForward(31000);
    await page.getByRole("button",{name:language==="fr" ? "Renvoyer le lien":"Resend link",exact:true}).click();
    await page.getByRole("button",{name:/^(Nouveau lien dans|New link in)/}).waitFor();assert.equal(f.links.length,2);
    const callback=f.links.at(-1).callbackURL;
    state.authenticated=true;await page.goto(callback);
    await page.getByRole("heading",{name:language==="fr" ? "Commandes":"Orders",level:1,exact:true}).waitFor();
    assert.equal(new URL(page.url()).pathname,"/app/orders");assert.equal(new URL(page.url()).searchParams.get("store"),storeId);
    assert.equal(await page.evaluate(()=>sessionStorage.getItem("commerce-email-link-return")),null);
    await page.reload();await page.getByRole("heading",{name:language==="fr" ? "Commandes":"Orders",level:1,exact:true}).waitFor();
    report.checks.push(language+"/"+width+": passwordless send, pending lock, neutral confirmation, resend cooldown, internal destination and restored session");
    await context.close();
  }
  {
    const f=await fixture({hasStore:false}),{page,state,context}=f;
    await page.goto(base+"/app");await page.getByRole("button",{name:"Lien par email",exact:true}).click();
    await page.getByLabel("Votre nom",{exact:true}).fill("Commerce Test");await page.getByLabel("Email",{exact:true}).fill("setup@example.com");
    await page.getByRole("button",{name:"Recevoir mon lien de connexion",exact:true}).click();
    assert.equal(f.links.length,0);assert.equal(await page.getByRole("checkbox").evaluate(e=>e.validity.valid),false);
    await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Recevoir mon lien de connexion",exact:true}).click();
    await page.getByRole("status").filter({hasText:"Si cette adresse"}).waitFor();assert.equal(f.links[0].name,"Commerce Test");
    await check(page,"signup-link-sent");state.authenticated=true;await page.goto(f.links[0].callbackURL);
    await page.getByRole("heading",{name:"Votre boutique, sans labyrinthe.",exact:true}).waitFor();
    report.checks.push("Signup requires explicit terms acceptance and reaches onboarding after the provider callback");await context.close();
  }
  {
    const f=await fixture(),{page,state,context}=f;
    await page.goto(base+"/app/accept-invitation#token="+token);
    await page.getByRole("button",{name:"Lien par email",exact:true}).click();await page.getByLabel("Votre nom",{exact:true}).fill("Staff Test");await page.getByLabel("Email",{exact:true}).fill("staff@example.com");await page.getByRole("checkbox").check();
    await page.getByRole("button",{name:"Recevoir mon lien de connexion",exact:true}).click();await page.getByRole("status").filter({hasText:"Si cette adresse"}).waitFor();
    assert.equal(JSON.stringify(f.links).includes(token),false);
    state.authenticated=true;await page.goto(f.links[0].callbackURL);await page.getByRole("heading",{name:"Rejoindre une boutique",exact:true}).waitFor();
    assert.equal(new URL(page.url()).hash,"#token="+token);report.checks.push("Invitation secret is retained in the original tab and excluded from provider requests");await context.close();
  }
  for(const kind of ["expired","missing-session","new-tab","unsafe-return"]){
    const f=await fixture(),{page,state,context}=f;
    await page.goto(base+"/app/login");await page.getByRole("button",{name:"Lien par email",exact:true}).click();await page.getByLabel("Email",{exact:true}).fill("owner@example.com");
    await page.getByRole("button",{name:"Recevoir mon lien de connexion",exact:true}).click();await page.getByRole("status").filter({hasText:"Si cette adresse"}).waitFor();
    if(kind==="new-tab")await page.evaluate(()=>sessionStorage.removeItem("commerce-email-link-return"));
    if(kind==="unsafe-return")await page.evaluate(()=>{const k="commerce-email-link-return",p=JSON.parse(sessionStorage.getItem(k));p.path="https://evil.example";sessionStorage.setItem(k,JSON.stringify(p));});
    state.authenticated=kind==="new-tab" || kind==="unsafe-return";
    await page.goto(kind==="expired" ? f.links[0].errorCallbackURL+"&error=INVALID_TOKEN":f.links[0].callbackURL);
    if(state.authenticated){await page.getByRole("heading",{name:"Tableau de bord",level:1,exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,"/app");}
    else {await page.getByRole("alert").filter({hasText:"Ce lien a expiré"}).waitFor();assert.equal(new URL(page.url()).pathname,"/app/login");await check(page,"link-"+kind);}
    assert.equal(new URL(page.url()).origin,base);assert.equal(new URL(page.url()).searchParams.has("flow"),false);
    report.checks.push(kind+": safe callback destination and recoverable state");await context.close();
  }
  {
    const f=await fixture(),{page,context}=f;f.failLink=true;
    await page.goto(base+"/app/login");await page.getByRole("button",{name:"Lien par email",exact:true}).click();await page.getByLabel("Email",{exact:true}).fill("owner@example.com");await page.getByRole("button",{name:"Recevoir mon lien de connexion",exact:true}).click();
    await page.getByRole("alert").filter({hasText:"Impossible d’envoyer"}).waitFor();assert.equal(await page.getByRole("status").filter({hasText:"Si cette adresse"}).count(),0);assert.equal(await page.getByLabel("Email",{exact:true}).inputValue(),"owner@example.com");
    await check(page,"link-send-failed");f.failLink=false;await page.getByRole("button",{name:"Recevoir mon lien de connexion",exact:true}).click();await page.getByRole("status").filter({hasText:"Si cette adresse"}).waitFor();
    await page.getByRole("button",{name:"Mot de passe",exact:true}).click();await page.getByLabel("Mot de passe",{exact:true}).waitFor();
    report.checks.push("Provider failure retains the email, never claims delivery, permits retry and password fallback");await context.close();
  }
  await writeFile(output+"/report.json",JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} catch(error) {
  report.error=error.stack;await mkdir(output,{recursive:true});await currentPage?.screenshot({path:output+"/failure.png",fullPage:true}).catch(()=>{});await writeFile(output+"/report.json",JSON.stringify(report,null,2));throw error;
} finally {await browser?.close();server.kill("SIGTERM");}
