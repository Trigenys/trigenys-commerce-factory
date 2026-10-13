// Isolated browser fixtures, copied from the existing user-journey contract.
// No production credentials, real accounts or external writes are used.
export const storeId="11111111-1111-4111-8111-111111111111",productId="22222222-2222-4222-8222-222222222222",orderId="33333333-3333-4333-8333-333333333333",token="a".repeat(64);
export const store={id:storeId,role:"owner",name:"Atelier de Douala",slug:"atelier",status:"published",whatsappNumber:"+237670000001",countryCode:"CM",currencyCode:"XAF",description:"Des pièces choisies avec soin",businessLocation:"Douala",contactEmail:null,theme:"fashion-collection",themeSettings:{},logoUrl:null};
export const product={id:productId,storeId,name:"Sac Signature",slug:"sac-signature",description:"Une pièce pour tous les jours",price:"18500.00",currencyCode:"XAF",category:"Accessoires",stockLabel:"À confirmer",status:"active",sortOrder:0,imageUrls:["/landing/fashion-480.webp"],variants:[{name:"Couleur",value:"Camel"},{name:"Couleur",value:"Noir"}]};
export const now="2026-10-10T12:00:00.000Z";
export const order={id:orderId,storeSlug:store.slug,storeName:store.name,reference:"CF-33333333",status:"requested",paymentMethod:"momo",paymentStatus:"pending",currencyCode:"XAF",total:"37000.00",lines:[{productId,quantity:2,variants:{Couleur:"Noir"},name:product.name,slug:product.slug,unitPrice:"18500.00",amount:"37000.00"}],createdAt:now,updatedAt:now,version:0,history:[{at:now,status:"requested",paymentStatus:"pending"}],customerName:"Cliente de démonstration",customerPhone:null,note:"À retirer samedi"};
export async function brandFixture(browser,base,{profile="owner",authenticated=true,hasStore=true,language="fr",width}={}){
  const context=await browser.newContext({locale:language==="fr" ? "fr-FR" : "en-GB",reducedMotion:"reduce",...(width ? {viewport:{width,height:900}}:{})});
  await context.addInitScript(({language})=>localStorage.setItem("commerce-factory-language",language),{language});
  const page=await context.newPage();const state={authenticated,profile,hasStore,orders:[structuredClone(order)],products:[structuredClone(product)],store:structuredClone(store),calls:[],failConfig:false,failStore:false,loseOrderResponse:false,pendingOrder:null,invitations:[],tickets:[]};
  state.browserErrors=[];
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
    if(path.startsWith(`/v1/admin/stores/${storeId}/products/`)&&method==="PATCH"){const id=path.split("/").pop();const index=state.products.findIndex(p=>p.id===id);if(index<0)return send({error:"PRODUCT_NOT_FOUND"},404);state.products[index]={...state.products[index],...body};return send({product:state.products[index]});}
    if(path===`/v1/admin/stores/${storeId}/publish`){if(!state.products.some(p=>p.status==="active"))return send({error:"PUBLISH_NEEDS_PRODUCT"},409);state.store.status="published";return send({store:state.store});}
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
