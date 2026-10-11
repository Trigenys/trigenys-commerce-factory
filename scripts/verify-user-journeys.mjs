import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const base="http://127.0.0.1:5175",output="artifacts/journeys";
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","5175","--strictPort"],{stdio:"pipe",env:{...process.env,VITE_API_BASE_URL:"http://127.0.0.1:8787"}});
let serverLog="",browser,currentPage,currentState;server.stdout.on("data",b=>serverLog+=b);server.stderr.on("data",b=>serverLog+=b);
const storeId="11111111-1111-4111-8111-111111111111",productId="22222222-2222-4222-8222-222222222222",orderId="33333333-3333-4333-8333-333333333333",token="a".repeat(64);
const store={id:storeId,role:"owner",name:"Atelier de Douala",slug:"atelier",status:"published",whatsappNumber:"+237670000001",countryCode:"CM",currencyCode:"XAF",description:"Des pièces choisies avec soin",businessLocation:"Douala",contactEmail:null,theme:"fashion-collection",themeSettings:{},logoUrl:null};
const product={id:productId,storeId,name:"Sac Signature",slug:"sac-signature",description:"Une pièce pour tous les jours",price:"18500.00",currencyCode:"XAF",category:"Accessoires",stockLabel:"À confirmer",status:"active",sortOrder:0,imageUrls:["/landing/fashion-480.webp"],variants:[{name:"Couleur",value:"Camel"},{name:"Couleur",value:"Noir"}]};
const now="2026-10-10T12:00:00.000Z";
const order={id:orderId,storeSlug:store.slug,storeName:store.name,reference:"CF-33333333",status:"requested",paymentMethod:"momo",paymentStatus:"pending",currencyCode:"XAF",total:"37000.00",lines:[{productId,quantity:2,variants:{Couleur:"Noir"},name:product.name,slug:product.slug,unitPrice:"18500.00",amount:"37000.00"}],createdAt:now,updatedAt:now,version:0,history:[{at:now,status:"requested",paymentStatus:"pending"}],customerName:"Cliente de démonstration",customerPhone:null,note:"À retirer samedi"};
const report={pages:[],checks:[],unverified:["Real Neon signup, email delivery/reset, JWT and production persistence require the configured isolated staging provider.","Automated accessibility checks do not establish complete WCAG conformity or a usability study."]};
const axeSource=await readFile("node_modules/axe-core/axe.min.js","utf8");
async function fixture({profile="owner",authenticated=true,hasStore=true,language="fr"}={}){
  const context=await browser.newContext({locale:language==="fr" ? "fr-FR" : "en-GB",reducedMotion:"reduce"});
  await context.addInitScript(({language})=>localStorage.setItem("commerce-factory-language",language),{language});
  const page=await context.newPage();currentPage=page;const state={authenticated,profile,hasStore,orders:[structuredClone(order)],products:[structuredClone(product)],store:structuredClone(store),calls:[],failConfig:false,failStore:false,loseOrderResponse:false,pendingOrder:null,invitations:[],tickets:[]};
  currentState=state;state.browserErrors=[];
  page.on("dialog",dialog=>dialog.accept());
  page.on("pageerror",error=>state.browserErrors.push(error.message));
  page.on("console",message=>{if(message.type()==="error")state.browserErrors.push(message.text());});
  page.on("requestfailed",request=>state.browserErrors.push(request.url()+": "+request.failure()?.errorText));
  await page.route("**/neondb/auth/**",async route=>{
    const path=new URL(route.request().url()).pathname;state.calls.push({path,method:route.request().method()});
    if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers:{"Access-Control-Allow-Origin":base,"Access-Control-Allow-Credentials":"true","Access-Control-Allow-Headers":route.request().headers()["access-control-request-headers"] || "Content-Type,x-neon-client-info","Access-Control-Allow-Methods":"GET,POST,OPTIONS"}});
    const headers={"Access-Control-Allow-Origin":base,"Access-Control-Allow-Credentials":"true"};
    const user={id:profile,email:profile+"@example.com",name:"Commerce Demo",emailVerified:true,createdAt:now,updatedAt:now};
    if(path.endsWith("/get-session"))return route.fulfill({headers,json:state.authenticated ? {session:{id:"session",userId:profile,token:"test-session",expiresAt:"2027-01-01T00:00:00Z",createdAt:now,updatedAt:now},user} : null});
    if(path.endsWith("/token")){const jwt=[{alg:"EdDSA",typ:"JWT"},{sub:profile,email:user.email,emailVerified:true,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)}].map(v=>Buffer.from(JSON.stringify(v)).toString("base64url")).join(".")+".signature";return route.fulfill({headers,json:{token:jwt}});}
    if(path.endsWith("/sign-out")){state.authenticated=false;return route.fulfill({headers,json:{success:true}});}
    if(path.endsWith("/sign-in/email")||path.endsWith("/sign-up/email")){state.authenticated=true;return route.fulfill({headers,json:{token:"test-session",user}});}
    if(path.includes("/email-otp/"))return route.fulfill({headers,json:{success:true}});
    return route.fulfill({status:404,headers,json:{error:"UNMOCKED_AUTH"}});
  });
  await page.route("**/v1/**",async route=>{
    const url=new URL(route.request().url()),path=url.pathname,method=route.request().method();const body=route.request().postData() ? route.request().postDataJSON():undefined;state.calls.push({path,method,body});
    const send=(json,status=200)=>route.fulfill({status,json,headers:{"Access-Control-Allow-Origin":"*"}});
    if(method==="OPTIONS")return route.fulfill({status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"*","Access-Control-Allow-Methods":"*"}});
    if(path==="/v1/config")return state.failConfig ? send({error:"UNAVAILABLE"},503):send({authBaseUrl:"https://auth.example.test/neondb/auth"});
    if(path==="/v1/admin/me/stores")return send({stores:state.hasStore ? [{...state.store,role:profile==="staff" ? "staff":"owner"}]:[]});
    if(path==="/v1/admin/me/access")return send({platform:profile==="support",email:profile+"@example.com",emailVerified:true});
    if(path==="/v1/admin/stores"&&method==="POST"){state.store={...state.store,...body,status:"draft"};state.hasStore=true;return send({store:state.store},201);}
    if(path===`/v1/admin/stores/${storeId}`&&method==="PATCH"){state.store={...state.store,...body};return send({store:state.store});}
    if(path===`/v1/admin/stores/${storeId}/products`){if(method==="POST"){const saved={...body,id:crypto.randomUUID(),storeId};state.products.push(saved);return send({product:saved},201);}return send({products:state.products});}
    if(path===`/v1/admin/stores/${storeId}/publish`){state.store.status="published";return send({store:state.store});}
    if(path===`/v1/admin/stores/${storeId}/orders`)return send({orders:state.orders});
    if(path===`/v1/admin/stores/${storeId}/orders/${orderId}`){state.orders[0]={...state.orders[0],...body,version:state.orders[0].version+1};state.orders[0].history.push({at:now,status:state.orders[0].status,paymentStatus:state.orders[0].paymentStatus});return send({order:state.orders[0]});}
    if(path===`/v1/admin/stores/${storeId}/team`)return send({members:[{id:storeId,subject:"owner",role:"owner",createdAt:now}],invitations:state.invitations});
    if(path===`/v1/admin/stores/${storeId}/team/invitations`){const invitation={id:crypto.randomUUID(),email:body.email,expiresAt:"2027-01-01T00:00:00.000Z",revokedAt:null,acceptedAt:null};state.invitations.push(invitation);return send({invitation,href:base+"/app/accept-invitation#token="+token},201);}
    if(path===`/v1/admin/stores/${storeId}/analytics`)return send({analytics:{windowDays:30,storeViews:12,productViews:8,whatsappClicks:3,clickThroughRate:.375,topProducts:[]}});
    if(path==="/v1/admin/invitations/accept"){state.hasStore=true;return send({storeId});}
    if(path==="/v1/admin/platform/stores")return profile==="support" ? send({stores:[{...state.store,createdAt:now,productCount:1}]}):send({error:"PLATFORM_ACCESS_REQUIRED"},403);
    if(path==="/v1/admin/platform/support")return profile==="support" ? send({tickets:state.tickets}):send({error:"PLATFORM_ACCESS_REQUIRED"},403);
    if(path.startsWith("/v1/admin/platform/support/")){state.tickets[0]={...state.tickets[0],...body};return send({ticket:state.tickets[0]});}
    if(path==="/v1/public/stores/atelier")return state.failStore ? send({error:"UNAVAILABLE"},503):send({store:state.store,products:state.products});
    if(path==="/v1/public/stores/atelier/orders"){
      if(!state.pendingOrder)state.pendingOrder={...order,lines:body.lines.map(line=>({...line,name:product.name,slug:product.slug,unitPrice:product.price,amount:(18500*line.quantity).toFixed(2)})),total:body.lines.reduce((n,l)=>n+l.quantity*18500,0).toFixed(2)};
      if(state.loseOrderResponse){state.loseOrderResponse=false;return route.abort("failed");}
      return send({order:state.pendingOrder,href:"https://wa.me/237670000001?text=order-request"},201);
    }
    if(path===`/v1/public/orders/${orderId}`)return route.request().headers()["x-order-token"]===token ? send({order:state.orders[0]}):send({error:"ORDER_NOT_FOUND"},404);
    if(path==="/v1/public/support"){const ticket={...body,status:"open",reply:null,storeSlug:null,createdAt:now,updatedAt:now};state.tickets=[ticket];if(state.loseSupportResponse){state.loseSupportResponse=false;return route.abort("failed");}return send({ticket},201);}
    if(path.startsWith("/v1/public/support/"))return send({ticket:state.tickets[0]||{id:orderId,status:"resolved",reply:"Votre réponse est disponible",createdAt:now,updatedAt:now}});
    if(path==="/v1/public/events")return send({},202);
    return send({error:"UNMOCKED_API"},404);
  });
  return {context,page,state};
}
async function check(page,label,{axe=true}={}){
  await page.locator("h1").first().waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,label+": horizontal overflow");
  const bad=await page.locator("img").evaluateAll(images=>images.filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src));assert.deepEqual(bad,[],label+": images");
  if(axe){await page.evaluate(axeSource);const result=await page.evaluate(async()=>await axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]}}));
    const violations=result.violations.filter(v=>["critical","serious"].includes(v.impact));
    report.pages.push({label,violations:violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)}))});
    if(violations.length){await page.screenshot({path:output+"/failure.png",fullPage:true});await writeFile(output+"/report.json",JSON.stringify(report,null,2));}
    assert.deepEqual(violations.map(v=>v.id),[],label+": accessibility");
  }
  await page.screenshot({path:output+"/"+label.replaceAll(/[^a-z0-9-]/gi,"-")+".png",fullPage:true});
}
try{
  await mkdir(output,{recursive:true});let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await delay(100);}assert.ok(ready,serverLog);
  browser=await chromium.launch({headless:true});
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    const {context,page,state}=await fixture();await page.setViewportSize(viewport);
    for(const route of ["/help","/contact","/privacy","/terms","/missing-page","/app","/app/products","/app/orders","/app/appearance","/app/settings","/app/analytics","/app/team","/store/atelier","/store/atelier/p/sac-signature","/store/atelier/cart","/orders/"+orderId+"#token="+token,"/app/accept-invitation#token="+token]){
      await page.goto(base+route);
      const headings={"/app":"Votre boutique, étape par étape","/app/products":"Vos produits","/app/orders":"Commandes","/app/appearance":"L’apparence de votre boutique","/app/settings":"Paramètres de la boutique","/app/analytics":"Statistiques de votre boutique","/app/team":"Votre équipe"};
      if(headings[route])await page.getByRole("heading",{name:headings[route],exact:true}).waitFor();else await page.locator("h1").first().waitFor();
      await page.getByRole("status").filter({hasText:/Chargement|Opération/}).first().waitFor({state:"hidden",timeout:5000}).catch(()=>{});
      await check(page,(route.split("#")[0]+"-"+viewport.width).replaceAll("/","-"));
    }
    await context.close();
  }
  // Buyer retains variants/cart across navigation, and retry uses exactly the same request.
  {
    const {context,page,state}=await fixture({authenticated:false});await page.goto(base+"/store/atelier/p/sac-signature");await page.getByRole("button",{name:"Noir",exact:true}).click();await page.getByLabel("Quantité",{exact:true}).fill("2");await page.getByRole("button",{name:"Ajouter au panier",exact:true}).click();await page.getByRole("link",{name:"Voir le panier",exact:true}).click();
    await page.reload();await page.getByRole("heading",{name:"Votre panier",exact:true}).waitFor();assert.equal(await page.getByLabel("Quantité de Sac Signature",{exact:true}).inputValue(),"2");assert.match(await page.locator(".cart-line").innerText(),/Noir/);
    await page.getByRole("checkbox").check();state.loseOrderResponse=true;await page.getByRole("button",{name:"Enregistrer ma demande",exact:true}).click();await page.getByRole("alert").waitFor();await page.getByRole("button",{name:"Réessayer la même demande",exact:true}).click();await page.getByRole("heading",{name:"Votre demande est enregistrée",exact:true}).waitFor();
    const posts=state.calls.filter(c=>c.path.endsWith("/orders")&&c.method==="POST");assert.equal(posts.length,2);assert.deepEqual(posts[0].body,posts[1].body);assert.equal(await page.getByRole("link",{name:/Panier \(0\)/}).count(),1);await check(page,"buyer-receipt-desktop");report.checks.push("Buyer cart persists and lost-response retry retains request identity");await context.close();
  }
  // Auth uses the installed SDK, including email OTP reset; endpoint requests are mocked only.
  {
    const {context,page,state}=await fixture({authenticated:false});await page.goto(base+"/contact");await page.getByLabel("Votre nom",{exact:true}).fill("Test support");await page.getByLabel("Email",{exact:true}).fill("test@example.com");await page.getByLabel("Votre demande",{exact:true}).fill("Je souhaite reprendre mon accès marchand.");await page.reload();assert.equal(await page.getByLabel("Votre nom",{exact:true}).inputValue(),"Test support");state.loseSupportResponse=true;await page.getByRole("button",{name:"Envoyer ma demande",exact:true}).click();await page.getByRole("alert").waitFor();await page.reload();assert.equal(await page.getByLabel("Votre demande",{exact:true}).getAttribute("readonly"),"");await page.getByRole("button",{name:"Réessayer la même demande",exact:true}).click();await page.getByRole("heading",{name:"Votre demande est enregistrée",exact:true}).waitFor();const posts=state.calls.filter(c=>c.path==="/v1/public/support"&&c.method==="POST");assert.equal(posts.length,2);assert.deepEqual(posts[0].body,posts[1].body);await page.getByRole("link",{name:"Suivre ma demande",exact:true}).click();await page.getByRole("heading",{name:"Suivi de votre demande",exact:true}).waitFor();await check(page,"support-private-tracking");report.checks.push("Support draft survives reload and lost-response retry keeps the same private request");await context.close();
  }
  {
    const {context,page,state}=await fixture({authenticated:false,hasStore:false});await page.goto(base+"/app/login");await page.getByRole("button",{name:"Mot de passe oublié ?",exact:true}).click();await page.getByLabel("Email",{exact:true}).fill("demo@example.com");await page.getByRole("button",{name:"Recevoir un code",exact:true}).click();await page.getByLabel("Code reçu par email",{exact:true}).fill("123456");await page.getByLabel("Mot de passe",{exact:true}).fill("test-only-password");await page.getByLabel("Confirmer le mot de passe",{exact:true}).fill("test-only-password");await check(page,"password-reset");await page.getByRole("button",{name:"Réinitialiser le mot de passe",exact:true}).click();await page.getByText("Mot de passe modifié. Connectez-vous pour reprendre.").waitFor();
    assert.ok(state.calls.some(c=>c.path.endsWith("/email-otp/reset-password")));await page.getByLabel("Mot de passe",{exact:true}).fill("test-only-password");await page.getByRole("button",{name:"Continuer",exact:true}).click();await page.getByRole("heading",{name:/boutique/}).first().waitFor();await check(page,"onboarding-account");report.checks.push("Installed Auth SDK recovery/login requests and onboarding entry");await context.close();
  }
  // Owner order transitions and payment confirmation; staff get fewer navigation/actions.
  for(const profile of ["owner","staff"]){const {context,page,state}=await fixture({profile});await page.goto(base+"/app/orders");await page.locator("summary").click();await check(page,profile+"-order-detail");assert.equal(await page.getByRole("button",{name:"Confirmer le paiement reçu",exact:true}).count(),profile==="owner" ? 1:0);if(profile==="owner"){await page.getByRole("button",{name:"Confirmée",exact:true}).click();await page.getByText("Commande mise à jour.").waitFor();assert.equal(state.orders[0].status,"confirmed");await page.getByRole("button",{name:"Confirmer le paiement reçu",exact:true}).click();await page.getByText("Commande mise à jour.").waitFor();assert.equal(state.orders[0].paymentStatus,"paid");}else{assert.equal(await page.getByRole("link",{name:"Équipe",exact:true}).count(),0);await page.goto(base+"/app/team");await page.getByRole("heading",{name:"Accès réservé au propriétaire",exact:true}).waitFor();await check(page,"staff-restricted-page");}await context.close();}report.checks.push("Owner/staff navigation and order/payment controls");
  {
    const {context,page,state}=await fixture();await page.goto(base+"/app/team");await page.getByLabel("Email de la personne",{exact:true}).fill("staff@example.com");await page.getByRole("button",{name:"Créer l’invitation",exact:true}).click();await page.getByRole("heading",{name:"Lien privé à partager",exact:true}).waitFor();assert.equal(state.invitations.length,1);assert.match(await page.getByLabel("Invitation",{exact:true}).inputValue(),/#token=/);await check(page,"team-invitation");report.checks.push("Owner invitation creation and private copyable link");await context.close();
  }
  {
    const {context,page,state}=await fixture({profile:"support",hasStore:false});state.tickets=[{id:orderId,name:"Commerçant démo",email:"demo@example.com",message:"Besoin d’aide pour publier",status:"open",reply:null,storeSlug:"atelier",createdAt:now,updatedAt:now}];await page.goto(base+"/app/platform");await page.locator("summary").click();await page.getByLabel("Réponse visible dans le suivi privé",{exact:true}).fill("Votre demande a été traitée.");await page.getByLabel("Statut",{exact:true}).selectOption("resolved");await page.getByRole("button",{name:"Enregistrer la réponse",exact:true}).click();await page.getByText("Réponse enregistrée et disponible dans le suivi privé.").waitFor();await check(page,"platform-support");assert.equal(state.tickets[0].status,"resolved");report.checks.push("Support console response flow");await context.close();
  }
  {
    const {context,page,state}=await fixture({authenticated:false});state.failStore=true;await page.goto(base+"/store/atelier");await page.getByRole("button",{name:"Réessayer",exact:true}).waitFor();assert.equal(await page.getByRole("heading",{name:"404",exact:true}).count(),0);state.failStore=false;await page.getByRole("button",{name:"Réessayer",exact:true}).click();await page.locator(".public-product-card").waitFor();report.checks.push("Network failure is recoverable and distinguished from missing store");await context.close();
  }
  {
    const {context,page}=await fixture({authenticated:false,language:"en"});await page.setViewportSize({width:390,height:844});await page.goto(base+"/app/login");await page.getByRole("button",{name:"Forgot password?",exact:true}).waitFor();await check(page,"login-en-mobile");await page.goto(base+"/help");await check(page,"help-en-mobile");await page.keyboard.press("Tab");assert.equal(await page.evaluate(()=>document.activeElement?.textContent),"Skip to content");await page.keyboard.press("Enter");assert.equal(await page.evaluate(()=>document.activeElement?.id),"page-main");report.checks.push("English/mobile and keyboard skip link");await context.close();
  }
  await writeFile(output+"/report.json",JSON.stringify(report,null,2));console.log(JSON.stringify({pages:report.pages.length,checks:report.checks,accessibility:"No serious or critical WCAG rule violations in checked states",limitations:report.unverified}));
}catch(error){if(currentPage&&!currentPage.isClosed()){await currentPage.screenshot({path:output+"/failure.png",fullPage:true}).catch(()=>{});await writeFile(output+"/failure-dom.txt",await currentPage.locator("body").innerText().catch(()=>""));}await writeFile(output+"/failure-calls.json",JSON.stringify({calls:currentState?.calls,browserErrors:currentState?.browserErrors},null,2));await writeFile(output+"/report.json",JSON.stringify(report,null,2));throw error;}
finally{await browser?.close();server.kill("SIGTERM");}
