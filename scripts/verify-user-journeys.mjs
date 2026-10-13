import { brandFixture, storeId, productId, orderId, token, store, product, now, order } from "./brand-fixture.mjs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const base="http://127.0.0.1:5175",output="artifacts/journeys";
const server=spawn(process.execPath,["node_modules/vite/bin/vite.js","--host","127.0.0.1","--port","5175","--strictPort"],{stdio:"pipe",env:{...process.env,VITE_API_BASE_URL:"http://127.0.0.1:8787"}});
let serverLog="",browser,currentPage,currentState;server.stdout.on("data",b=>serverLog+=b);server.stderr.on("data",b=>serverLog+=b);
const report={pages:[],layoutFailures:[],checks:[],unverified:["Real Neon signup, email delivery/reset, JWT and production persistence require the configured isolated staging provider.","Automated accessibility checks do not establish complete WCAG conformity or a usability study."]};
const axeSource=await readFile("node_modules/axe-core/axe.min.js","utf8");
async function fixture(options = {}) {
  const result = await brandFixture(browser, base, options);
  currentPage = result.page; currentState = result.state;
  return result;
}
async function check(page,label,{axe=true}={}){
  await page.locator("h1").first().waitFor();
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))report.layoutFailures.push({label,...await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,elements:[...document.querySelectorAll("main,section,aside,form,fieldset,ol")].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,class:e.className,width:Math.round(e.getBoundingClientRect().width)})).slice(0,12)}))});
  const bad=await page.locator("img").evaluateAll(images=>images.filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src));assert.deepEqual(bad,[],label+": images");
  if(axe){await page.evaluate(axeSource);const result=await page.evaluate(async()=>await axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]}}));
    const violations=result.violations.filter(v=>["critical","serious"].includes(v.impact));
    report.pages.push({label,violations:violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target),details:v.nodes.map(n=>n.failureSummary)}))});
    if(violations.length){await page.screenshot({path:output+"/failure.png",fullPage:true});await writeFile(output+"/report.json",JSON.stringify(report,null,2));}
  }
  await page.screenshot({path:output+"/"+label.replaceAll(/[^a-z0-9-]/gi,"-")+".png",fullPage:true});
}
async function checkPrivateFooter(page, apiPath) {
  const privateHash = new URL(page.url()).hash;
  const secret = new URLSearchParams(privateHash.slice(1)).get("token");
  await page.getByRole("button", { name: "Retour en haut", exact: true }).click();
  assert.equal(new URL(page.url()).hash, privateHash, "Back to top preserves the private tracking link");
  const pending = page.waitForResponse(r => new URL(r.url()).pathname === apiPath && r.request().method() === "GET");
  await page.getByRole("button", { name: "Actualiser le statut", exact: true }).click();
  const response = await pending;
  assert.equal(response.status(), 200, "Tracking remains refreshable after using the footer");
  const headers = response.request().headers();
  assert.equal(headers[apiPath.includes("/orders/") ? "x-order-token" : "x-support-token"], secret);
}
try{
  await mkdir(output,{recursive:true});let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await delay(100);}assert.ok(ready,serverLog);
  browser=await chromium.launch({headless:true});
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    const {context,page,state}=await fixture();await page.setViewportSize(viewport);
    for(const route of ["/help","/contact","/privacy","/terms","/missing-page","/app","/app/products","/app/orders","/app/appearance","/app/settings","/app/analytics","/app/team","/store/atelier","/store/atelier/p/sac-signature","/store/atelier/cart","/orders/"+orderId+"#token="+token,"/app/accept-invitation#token="+token]){
      await page.goto(base+route);
      const headings={"/app":"Tableau de bord","/app/products":"Vos produits","/app/orders":"Commandes","/app/appearance":"L’apparence de votre boutique","/app/settings":"Paramètres de la boutique","/app/analytics":"Statistiques de votre boutique","/app/team":"Votre équipe"};
      if(headings[route])await page.getByRole("heading",{name:headings[route],level:1,exact:true}).waitFor();else await page.locator("h1").first().waitFor();
      await page.getByRole("status").filter({hasText:/Chargement|Opération/}).first().waitFor({state:"hidden",timeout:5000}).catch(()=>{});
      if (route.startsWith("/orders/")) await checkPrivateFooter(page, "/v1/public/orders/" + orderId);
      await check(page,(route.split("#")[0]+"-"+viewport.width).replaceAll("/","-"));
    }
    await context.close();
  }
  // Buyer retains variants/cart across navigation, and retry uses exactly the same request.
  {
    const {context,page,state}=await fixture({authenticated:false});await page.goto(base+"/store/atelier/p/sac-signature");await page.getByRole("button",{name:"Noir",exact:true}).click();await page.getByLabel("Quantité",{exact:true}).fill("2");await page.getByRole("button",{name:"Ajouter au panier",exact:true}).click();await page.getByRole("link",{name:"Voir le panier",exact:true}).click();
    await page.reload();await page.getByRole("heading",{name:"Votre panier",exact:true}).waitFor();assert.equal(await page.getByLabel("Quantité de Sac Signature",{exact:true}).inputValue(),"2");assert.match(await page.locator(".cart-line").innerText(),/Noir/);
    await page.getByRole("checkbox").check();state.loseOrderResponse=true;await page.getByRole("button",{name:"Enregistrer ma demande",exact:true}).click();await page.getByRole("alert").waitFor();await page.getByRole("button",{name:"Réessayer la même demande",exact:true}).click();await page.getByRole("heading",{name:"Votre demande est enregistrée",exact:true}).waitFor();
    const posts=state.calls.filter(c=>c.path.endsWith("/orders")&&c.method==="POST");assert.equal(posts.length,2);assert.deepEqual(posts[0].body,posts[1].body);assert.equal(await page.getByRole("link",{name:/Panier \(0\)/}).count(),1);await check(page,"buyer-receipt-desktop");await page.reload();await page.getByRole("heading",{name:"Votre demande est enregistrée",exact:true}).waitFor();assert.equal(state.calls.filter(c=>c.path.endsWith("/orders")&&c.method==="POST").length,2);assert.match(await page.getByLabel("Lien privé de suivi",{exact:true}).inputValue(),/#token=/);await page.getByRole("button",{name:"Commencer une nouvelle commande",exact:true}).click();await page.getByRole("heading",{name:"Votre panier",exact:true}).waitFor();report.checks.push("Buyer cart and receipt persist; lost-response retry retains request identity");await context.close();
  }
  // Auth uses the installed SDK, including email OTP reset; endpoint requests are mocked only.
  {
    const {context,page,state}=await fixture({authenticated:false});await page.goto(base+"/contact");await page.getByLabel("Votre nom",{exact:true}).fill("Test support");await page.getByLabel("Email",{exact:true}).fill("test@example.com");await page.getByLabel("Votre demande",{exact:true}).fill("Je souhaite reprendre mon accès marchand.");await page.reload();assert.equal(await page.getByLabel("Votre nom",{exact:true}).inputValue(),"Test support");state.loseSupportResponse=true;await page.getByRole("button",{name:"Envoyer ma demande",exact:true}).click();await page.getByRole("alert").waitFor();await page.reload();assert.equal(await page.getByLabel("Votre demande",{exact:true}).getAttribute("readonly"),"");await page.getByRole("button",{name:"Réessayer la même demande",exact:true}).click();await page.getByRole("heading",{name:"Votre demande est enregistrée",exact:true}).waitFor();const posts=state.calls.filter(c=>c.path==="/v1/public/support"&&c.method==="POST");assert.equal(posts.length,2);assert.deepEqual(posts[0].body,posts[1].body);await page.getByRole("link",{name:"Suivre ma demande",exact:true}).click();await page.getByRole("heading",{name:"Suivi de votre demande",exact:true}).waitFor();await checkPrivateFooter(page, "/v1/public/support/" + new URL(page.url()).pathname.split("/").pop());await check(page,"support-private-tracking");report.checks.push("Support draft survives reload and lost-response retry keeps the same private request");await context.close();
  }
  {
    const {context,page,state}=await fixture({authenticated:false,hasStore:false});await page.goto(base+"/app/login");await page.getByRole("button",{name:"Mot de passe oublié ?",exact:true}).click();await page.getByLabel("Email",{exact:true}).fill("demo@example.com");await page.getByRole("button",{name:"Recevoir un code",exact:true}).click();await page.getByLabel("Code reçu par email",{exact:true}).fill("123456");await page.getByLabel("Mot de passe",{exact:true}).fill("test-only-password");await page.getByLabel("Confirmer le mot de passe",{exact:true}).fill("test-only-password");await check(page,"password-reset");await page.getByRole("button",{name:"Réinitialiser le mot de passe",exact:true}).click();await page.getByText("Mot de passe modifié. Connectez-vous pour reprendre.").waitFor();
    assert.ok(state.calls.some(c=>c.path.endsWith("/email-otp/reset-password")));await page.getByLabel("Mot de passe",{exact:true}).fill("test-only-password");await page.getByRole("button",{name:"Continuer",exact:true}).click();await page.getByRole("heading",{name:"Votre boutique, sans labyrinthe.",level:1,exact:true}).waitFor();await check(page,"onboarding-account");report.checks.push("Installed Auth SDK recovery/login requests and onboarding entry");await context.close();
  }
  // Full setup, product draft recovery and publication across real page navigation.
  for(const width of [1440,390]){
    const {context,page,state}=await fixture({authenticated:false,hasStore:false});state.products=[];await page.setViewportSize({width,height:900});await page.goto(base+"/app");
    await page.getByLabel("Votre nom",{exact:true}).fill("Commerce Test");await page.getByLabel("Email",{exact:true}).fill("setup@example.com");await page.getByLabel("Mot de passe",{exact:true}).fill("test-only-password");await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Continuer",exact:true}).click();
    await page.getByRole("heading",{name:"Votre boutique, sans labyrinthe.",level:1,exact:true}).waitFor();
    await page.getByLabel("Nom de la boutique",{exact:true}).fill("Atelier de Douala");await page.getByLabel("Adresse de la boutique",{exact:true}).fill("atelier");await page.getByLabel("Courte description",{exact:true}).fill("Les couleurs de notre club.");await page.reload();await page.getByRole("heading",{name:"Votre boutique, sans labyrinthe.",level:1,exact:true}).waitFor();assert.equal(await page.getByLabel("Nom de la boutique",{exact:true}).inputValue(),"Atelier de Douala");
    await page.keyboard.press("Tab");assert.equal(await page.evaluate(()=>document.activeElement?.textContent),"Aller au contenu");await page.keyboard.press("Enter");assert.equal(await page.evaluate(()=>document.activeElement?.id),"merchant-main");await check(page,"onboarding-business-"+width);
    await page.getByRole("button",{name:"Suivant →",exact:true}).click();await page.getByLabel("Numéro WhatsApp",{exact:true}).fill("+237670000001");await check(page,"onboarding-whatsapp-"+width);await page.getByRole("button",{name:"Suivant →",exact:true}).click();
    await page.getByLabel("Secteur d’activité",{exact:true}).selectOption("sport");await page.getByRole("button",{name:/^Stadium/}).click();await page.getByLabel("Typographie",{exact:true}).selectOption("display");await check(page,"onboarding-appearance-"+width);await page.getByRole("button",{name:"Suivant →",exact:true}).click();await check(page,"onboarding-review-"+width);await page.getByRole("button",{name:"Créer ma boutique",exact:true}).click();
    await page.getByRole("heading",{name:"Tableau de bord",level:1,exact:true}).waitFor();assert.equal(state.store.theme,"sport-stadium");assert.equal(state.store.status,"draft");assert.equal(await page.getByRole("button",{name:"Publier la boutique",exact:true}).isEnabled(),false);
    await page.getByRole("link",{name:"Gérer les produits",exact:true}).click();await page.getByRole("button",{name:"Ajouter un produit",exact:true}).click();await page.getByLabel("Nom du produit",{exact:true}).fill("Maillot du club");await page.getByLabel("Prix",{exact:true}).fill("17000");await page.getByLabel("Visibilité",{exact:true}).selectOption("active");await page.getByLabel("Variantes",{exact:true}).fill("Taille: M\nTaille: L");await page.reload();await page.getByLabel("Nom du produit",{exact:true}).waitFor();assert.equal(await page.getByLabel("Nom du produit",{exact:true}).inputValue(),"Maillot du club");await check(page,"product-draft-"+width);
    await page.getByRole("button",{name:"Créer le produit",exact:true}).click();await page.getByText("Produit créé. Vous pouvez maintenant ajouter ses images.",{exact:true}).waitFor();assert.equal(state.products.length,1);assert.equal(state.products[0].status,"active");await page.getByLabel("Description",{exact:true}).focus();await page.keyboard.press("Tab");assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute("type")),"file");await check(page,"product-created-"+width);await page.getByRole("button",{name:"Enregistrer",exact:true}).click();await page.getByText("Produit enregistré.",{exact:true}).waitFor();
    if(width<1024)await page.getByRole("button",{name:"Ouvrir la navigation",exact:true}).click();await page.getByRole("navigation",{name:"Espace marchand",exact:true}).getByRole("link",{name:"Tableau de bord",exact:true}).click();await page.getByRole("button",{name:"Publier la boutique",exact:true}).click();await page.getByText("Votre boutique est publiée.",{exact:true}).waitFor();assert.equal(state.store.status,"published");await check(page,"store-published-"+width);
    if(width<1024)await page.getByRole("button",{name:"Ouvrir la navigation",exact:true}).click();await page.getByRole("navigation",{name:"Espace marchand",exact:true}).getByRole("link",{name:"Apparence",exact:true}).click();await page.getByRole("heading",{name:"L’apparence de votre boutique",level:1,exact:true}).waitFor();await page.getByLabel("Typographie",{exact:true}).selectOption("serif");await page.getByRole("button",{name:"Enregistrer",exact:true}).click();await page.getByText("Modifications enregistrées.",{exact:true}).waitFor();await page.reload();await page.getByLabel("Typographie",{exact:true}).waitFor();assert.equal(await page.getByLabel("Typographie",{exact:true}).inputValue(),"serif");await check(page,"appearance-saved-"+width);
    assert.equal(state.calls.filter(c=>c.path==="/v1/admin/stores"&&c.method==="POST").length,1);assert.equal(state.calls.filter(c=>c.path.endsWith("/publish")&&c.method==="POST").length,1);report.checks.push("Signup → store draft → product draft/reload → keyboard upload access → theme save → publish at "+width+"px");await context.close();
  }
  {
    const {context,page,state}=await fixture({authenticated:false});state.failConfig=true;await page.goto(base+"/app");await page.getByRole("heading",{name:"Votre espace est temporairement indisponible",level:1,exact:true}).waitFor();await check(page,"configuration-recovery");state.failConfig=false;await page.getByRole("button",{name:"Réessayer",exact:true}).click();await page.getByRole("heading",{name:"Construisez votre boutique.",level:1,exact:true}).waitFor();report.checks.push("Merchant configuration outage resumes from the retry action");await context.close();
  }
  // Owner order transitions and payment confirmation; staff get fewer navigation/actions.
  for(const profile of ["owner","staff"]){const {context,page,state}=await fixture({profile});await page.goto(base+"/app/orders");await page.locator(".orders-list details>summary").click();await check(page,profile+"-order-detail");assert.equal(await page.getByRole("button",{name:"Confirmer le paiement reçu",exact:true}).count(),profile==="owner" ? 1:0);if(profile==="owner"){await page.getByRole("button",{name:"Confirmée",exact:true}).click();await page.getByText("Commande mise à jour.").waitFor();assert.equal(state.orders[0].status,"confirmed");await page.getByRole("button",{name:"Confirmer le paiement reçu",exact:true}).click();await page.getByText("Commande mise à jour.").waitFor();assert.equal(state.orders[0].paymentStatus,"paid");}else{assert.equal(await page.getByRole("link",{name:"Équipe",exact:true}).count(),0);await page.goto(base+"/app/team");await page.getByRole("heading",{name:"Accès réservé au propriétaire",exact:true}).waitFor();await check(page,"staff-restricted-page");}await context.close();}report.checks.push("Owner/staff navigation and order/payment controls");
  {
    const {context,page,state}=await fixture();await page.goto(base+"/app/team");await page.getByLabel("Email de la personne",{exact:true}).fill("staff@example.com");await page.getByRole("button",{name:"Créer l’invitation",exact:true}).click();await page.getByRole("heading",{name:"Lien privé à partager",exact:true}).waitFor();assert.equal(state.invitations.length,1);assert.match(await page.getByLabel("Invitation",{exact:true}).inputValue(),/#token=/);await check(page,"team-invitation");report.checks.push("Owner invitation creation and private copyable link");await context.close();
  }
  {
    const {context,page,state}=await fixture({profile:"support",hasStore:false});state.tickets=[{id:orderId,name:"Commerçant démo",email:"demo@example.com",message:"Besoin d’aide pour publier",status:"open",reply:null,storeSlug:"atelier",createdAt:now,updatedAt:now}];await page.goto(base+"/app/platform");await page.locator(".orders-list details>summary").click();await page.getByLabel("Réponse visible dans le suivi privé",{exact:true}).fill("Votre demande a été traitée.");await page.getByLabel("Statut",{exact:true}).selectOption("resolved");await page.getByRole("button",{name:"Enregistrer la réponse",exact:true}).click();await page.getByText("Réponse enregistrée et disponible dans le suivi privé.").waitFor();await check(page,"platform-support");assert.equal(state.tickets[0].status,"resolved");report.checks.push("Support console response flow");await context.close();
  }
  {
    const {context,page,state}=await fixture({authenticated:false});state.failStore=true;await page.goto(base+"/store/atelier");await page.getByRole("button",{name:"Réessayer",exact:true}).waitFor();assert.equal(await page.getByRole("heading",{name:"404",exact:true}).count(),0);state.failStore=false;await page.getByRole("button",{name:"Réessayer",exact:true}).click();await page.locator(".public-product-card").waitFor();report.checks.push("Network failure is recoverable and distinguished from missing store");await context.close();
  }
  {
    const {context,page}=await fixture({authenticated:false,language:"en"});await page.setViewportSize({width:390,height:844});await page.goto(base+"/app/login");await page.getByRole("button",{name:"Forgot password?",exact:true}).waitFor();await check(page,"login-en-mobile");await page.goto(base+"/help");await check(page,"help-en-mobile");await page.keyboard.press("Tab");assert.equal(await page.evaluate(()=>document.activeElement?.textContent),"Skip to content");await page.keyboard.press("Enter");assert.equal(await page.evaluate(()=>document.activeElement?.id),"page-main");report.checks.push("English/mobile and keyboard skip link");await context.close();
  }
  await writeFile(output+"/report.json",JSON.stringify(report,null,2));assert.deepEqual(report.layoutFailures,[],"Horizontal overflow in checked states");assert.deepEqual(report.pages.filter(p=>p.violations.length).map(p=>({label:p.label,rules:p.violations.map(v=>v.id)})),[],"Accessibility violations in checked states");console.log(JSON.stringify({pages:report.pages.length,checks:report.checks,accessibility:"No serious or critical WCAG rule violations in checked states",limitations:report.unverified}));
}catch(error){if(currentPage&&!currentPage.isClosed()){await currentPage.screenshot({path:output+"/failure.png",fullPage:true}).catch(()=>{});await writeFile(output+"/failure-dom.txt",await currentPage.locator("body").innerText().catch(()=>""));}await writeFile(output+"/failure-calls.json",JSON.stringify({calls:currentState?.calls,browserErrors:currentState?.browserErrors},null,2));await writeFile(output+"/report.json",JSON.stringify(report,null,2));throw error;}
finally{await browser?.close();server.kill("SIGTERM");}
