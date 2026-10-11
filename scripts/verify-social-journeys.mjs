import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';

const base='http://127.0.0.1:5177',api='https://api.example.test',auth='https://auth.example.test/neondb/auth',output='artifacts/social';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5177','--strictPort'],{stdio:'pipe',env:{...process.env,VITE_API_BASE_URL:api}});
let serverLog='',browser,currentPage;
server.stdout.on('data',d=>serverLog+=d);server.stderr.on('data',d=>serverLog+=d);
const storeId='11111111-1111-4111-8111-111111111111',previewId='55555555-5555-4555-8555-555555555555',attemptId='66666666-6666-4666-8666-666666666666',ticket='a'.repeat(64),invitation='b'.repeat(64),now=new Date().toISOString();
const originalStore={id:storeId,role:'owner',name:'Atelier de Douala',slug:'atelier',status:'draft',whatsappNumber:'+237670000001',countryCode:'CM',currencyCode:'XAF',description:'Notre description actuelle',businessLocation:'Douala',contactEmail:'atelier@example.com',theme:'fashion-collection',themeSettings:{},logoUrl:null};
const proposed={id:previewId,provider:'facebook',accountName:'Atelier Facebook',profileUrl:'https://www.facebook.com/123',values:{name:'Atelier social',description:'Créations de notre atelier',businessLocation:'Akwa, Douala',contactEmail:'boutique@example.com'},currentValues:{name:originalStore.name,description:originalStore.description,businessLocation:originalStore.businessLocation,contactEmail:originalStore.contactEmail},truncatedFields:[],expiresAt:new Date(Date.now()+600000).toISOString(),appliedFields:null};
const report={screens:[],checks:[],unverified:['Provider responses are fixtures; these checks use the installed Neon SDK but do not verify a real Google account or external business consent.','Real provider data and permissions require owned, approved OAuth apps before production activation.']};
const axe=await readFile('node_modules/axe-core/axe.min.js','utf8');
async function fixture({authenticated=true,hasStore=true,staff=false,language='fr',available=true}={}){
  const context=await browser.newContext({locale:language==='fr' ? 'fr-FR':'en-GB',reducedMotion:'reduce'});
  await context.addInitScript(language=>localStorage.setItem('commerce-factory-language',language),language);
  const page=await context.newPage();currentPage=page;
  const state={authenticated,hasStore,staff,google:true,googleError:false,googleMissingSession:false,available,store:structuredClone(originalStore),preview:null,requests:[],loseApply:false,applyError:null,connected:true,failAccounts:false,failComplete:false,badRedirect:false,errors:[]};
  page.on('dialog',d=>d.accept());page.on('pageerror',e=>state.errors.push(e.message));
  await page.route('**/neondb/auth/**',async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname,body=request.postData() ? request.postDataJSON():undefined;
    state.requests.push({path,method:request.method(),body});
    const headers={'Access-Control-Allow-Origin':base,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':request.headers()['access-control-request-headers'] || '*','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
    const user={id:'owner',name:'Merchant',email:'owner@example.com',emailVerified:true,createdAt:now,updatedAt:now};
    if(path.endsWith('/get-session'))return route.fulfill({headers,json:state.authenticated ? {session:{id:'session',userId:'owner',token:'fixture-session',expiresAt:'2027-01-01T00:00:00Z',createdAt:now,updatedAt:now},user}:null});
    if(path.endsWith('/token')){const token=[{alg:'EdDSA',typ:'JWT'},{sub:'owner',email:user.email,emailVerified:true,exp:Math.floor(Date.now()/1000)+3600}].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.')+'.signature';return route.fulfill({headers,json:{token}});}
    if(path.endsWith('/sign-in/social')){
      if(state.googleError)return route.fulfill({status:503,headers,json:{code:'PROVIDER_UNAVAILABLE',message:'Provider unavailable'}});
      state.authenticated=!state.googleMissingSession;return route.fulfill({headers,json:{url:body.callbackURL,redirect:true}});
    }
    if(path.endsWith('/sign-in/email')){state.authenticated=true;return route.fulfill({headers,json:{token:'fixture-session',user}});}
    if(path.endsWith('/sign-out')){state.authenticated=false;return route.fulfill({headers,json:{success:true}});}
    return route.fulfill({status:404,headers,json:{error:'UNMOCKED_AUTH'}});
  });
  await page.route('**/v1/**',async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method(),body=request.postData() ? request.postDataJSON():undefined;
    state.requests.push({path,method,body});
    const send=(json,status=200)=>route.fulfill({status,json,headers:{'Access-Control-Allow-Origin':'*'}});
    if(method==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'}});
    if(path==='/v1/config')return send({authBaseUrl:auth,googleSignInEnabled:state.google});
    if(path==='/v1/admin/me/stores')return send({stores:state.hasStore ? [{...state.store,role:state.staff ? 'staff':'owner'}]:[]});
    if(path==='/v1/admin/me/access')return send({platform:false,email:'owner@example.com',emailVerified:true});
    if(path.endsWith('/products'))return send({products:[]});
    if(path.endsWith('/orders'))return send({orders:[]});
    const root='/v1/admin/stores/'+storeId+'/connections';
    if(path===root)return send({connections:['facebook','instagram','tiktok'].map(provider=>({provider,available:state.available,status:provider==='facebook'&&state.connected ? 'connected':'disconnected',accountName:null,connectedAt:now,expiresAt:null,importedAt:null,lastError:null}))});
    if(path===root+'/complete')return state.failComplete ? send({error:'SERVICE_UNAVAILABLE'},503):send({connected:true});
    if(path===root+'/facebook/accounts')return state.failAccounts ? send({error:'PROVIDER_UNAVAILABLE'},502):send({accounts:[{id:'page-1',name:'Atelier Facebook',profileUrl:'https://www.facebook.com/123'}]});
    if(path===root+'/facebook/previews'){state.preview=structuredClone(proposed);return send({preview:state.preview},201);}
    if(path===root+'/previews/'+previewId)return state.preview ? send({preview:state.preview}):send({error:'PREVIEW_NOT_FOUND'},404);
    if(path===root+'/previews/'+previewId+'/apply'){
      if(state.applyError)return send({error:state.applyError},409);
      if(!state.preview.appliedFields){for(const field of body.fields)state.store[field]=state.preview.values[field];state.preview.appliedFields=body.fields;}
      if(state.loseApply){state.loseApply=false;return route.abort('failed');}
      return send({store:state.store,result:'already_applied'});
    }
    if(path===root+'/facebook' && method==='DELETE'){state.connected=false;state.preview=null;return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*'}});}
    if(path.endsWith('/facebook/start'))return send({href:state.badRedirect ? 'https://attacker.example/':api+'/v1/social/start/facebook?ticket='+ticket},201);
    return send({error:'UNMOCKED_API'},404);
  });
  return {context,page,state};
}
async function check(page,label){
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+': overflow');
  await page.evaluate(axe);const result=await page.evaluate(async()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));
  const violations=result.violations.filter(v=>['critical','serious'].includes(v.impact));report.screens.push({label,violations:violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))});
  await page.screenshot({path:output+'/'+label+'.png',fullPage:true});assert.deepEqual(violations.map(v=>v.id),[],label+': accessibility');
}
async function openConnections(page){await page.goto(base+'/app/connections?store='+storeId);await page.getByRole('heading',{name:'Connecter ma boutique',level:1,exact:true}).waitFor();await page.getByRole('button',{name:'Choisir les informations',exact:true}).waitFor();}
async function prepare(page){await page.getByRole('button',{name:'Choisir les informations',exact:true}).click();await page.getByRole('button',{name:'Prévisualiser l’import',exact:true}).click();await page.getByRole('heading',{name:'Vérifier avant d’importer',exact:true}).waitFor();}
try{
  await mkdir(output,{recursive:true});let ready=false;for(let i=0;i<60;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await delay(100);}assert.ok(ready,serverLog);browser=await chromium.launch({headless:true});
  for(const width of [1440,390]){
    const {context,page,state}=await fixture({authenticated:false});await page.setViewportSize({width,height:900});await page.goto(base+'/app/orders?store='+storeId);
    await page.getByRole('button',{name:'Continuer avec Google',exact:true}).waitFor();await check(page,'google-signup-'+width);
    await page.getByRole('button',{name:'Continuer avec Google',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(state.requests.filter(r=>r.path.endsWith('/sign-in/social')).length,0);assert.equal(await page.getByRole('checkbox').evaluate(e=>e===document.activeElement),true);
    await page.getByRole('checkbox').check();await page.evaluate(()=>sessionStorage.setItem('commerce-settings:draft-fixture',JSON.stringify({name:'Saved draft'})));
    await page.getByRole('button',{name:'Continuer avec Google',exact:true}).click();await page.getByRole('heading',{name:'Commandes',level:1,exact:true}).waitFor();assert.equal(new URL(page.url()).pathname,'/app/orders');assert.equal(new URL(page.url()).searchParams.get('store'),storeId);
    const social=state.requests.find(r=>r.path.endsWith('/sign-in/social'));assert.equal(social.body.provider,'google');assert.equal(social.body.newUserCallbackURL,social.body.callbackURL);assert.ok(social.body.errorCallbackURL.includes('oauth_error=1'));
    assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('commerce-settings:draft-fixture')).name),'Saved draft');assert.equal(await page.evaluate(()=>sessionStorage.getItem('commerce-google-return')),null);
    await page.reload();await page.getByRole('heading',{name:'Commandes',level:1,exact:true}).waitFor();await check(page,'google-session-restored-'+width);assert.deepEqual(state.errors,[]);report.checks.push('Google consent, installed SDK, destination, draft and session restore at '+width+'px');await context.close();
  }
  {
    const {context,page,state}=await fixture({authenticated:false});await page.goto(base+'/app/accept-invitation#token='+invitation);await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Continuer avec Google',exact:true}).click();await page.getByRole('heading',{name:'Rejoindre une boutique',exact:true}).waitFor();assert.equal(new URL(page.url()).hash,'#token='+invitation);
    const social=state.requests.find(r=>r.path.endsWith('/sign-in/social'));assert.ok(!JSON.stringify(social.body).includes(invitation));await check(page,'google-invitation-preserved');report.checks.push('Invitation secret stays in tab storage and resumes after Google callback');await context.close();
  }
  {
    const {context,page}=await fixture({authenticated:false,hasStore:false});await page.goto(base+'/app');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Continuer avec Google',exact:true}).click();await page.getByRole('heading',{name:'Votre boutique, sans labyrinthe.',exact:true}).waitFor();await check(page,'google-new-merchant-onboarding');await context.close();
  }
  for(const language of ['fr','en']){
    const {context,page,state}=await fixture({authenticated:false,language});state.googleError=true;await page.goto(base+'/app/login');await page.getByRole('button',{name:language==='fr' ? 'Continuer avec Google':'Continue with Google',exact:true}).click();await page.getByRole('alert').waitFor();await check(page,'google-error-'+language);assert.equal(state.authenticated,false);await context.close();
  }
  {
    const {context,page,state}=await fixture({authenticated:false});state.googleMissingSession=true;await page.goto(base+'/app/login');await page.getByRole('button',{name:'Continuer avec Google',exact:true}).click();await page.getByRole('alert').filter({hasText:'La connexion Google n’a pas abouti'}).waitFor();await check(page,'google-return-without-session');await context.close();
  }
  {
    const {context,page,state}=await fixture({authenticated:false});state.google=false;await page.goto(base+'/app');await page.getByRole('heading',{name:'Construisez votre boutique.',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Continuer avec Google',exact:true}).count(),0);await check(page,'email-only-unconfigured-google');await context.close();
  }
  for(const width of [1440,390]){
    const {context,page,state}=await fixture();await page.setViewportSize({width,height:900});await openConnections(page);await check(page,'social-connected-'+width);await prepare(page);await check(page,'social-preview-'+width);assert.equal(state.store.name,originalStore.name);assert.equal(await page.getByRole('button',{name:'Confirmer l’import des champs cochés',exact:true}).isEnabled(),false);
    await page.getByRole('checkbox',{name:/^Nom de la boutique/}).check();await page.getByRole('button',{name:'Confirmer l’import des champs cochés',exact:true}).click();await page.getByRole('status').filter({hasText:'Informations importées.'}).waitFor();assert.equal(state.store.name,'Atelier social');assert.equal(state.store.description,originalStore.description);assert.equal(state.store.status,'draft');assert.equal(state.store.theme,originalStore.theme);await check(page,'social-import-confirmed-'+width);
    await page.reload();await page.getByRole('status').filter({hasText:'Cet import a déjà été enregistré.'}).waitFor();assert.equal(state.requests.filter(r=>r.path.endsWith('/apply')).length,1);assert.deepEqual(state.errors,[]);report.checks.push('Owner preview, explicit selected-field import and reload recovery at '+width+'px');await context.close();
  }
  {
    const {context,page,state}=await fixture();await openConnections(page);await prepare(page);await page.getByRole('checkbox',{name:/^Description/}).check();state.loseApply=true;await page.getByRole('button',{name:'Confirmer l’import des champs cochés',exact:true}).click();await page.getByRole('button',{name:'Vérifier cet import',exact:true}).waitFor();assert.equal(await page.getByRole('checkbox',{name:/^Nom de la boutique/}).isEnabled(),false);await check(page,'social-lost-response');await page.getByRole('button',{name:'Vérifier cet import',exact:true}).click();await page.getByRole('status').filter({hasText:'Informations importées.'}).waitFor();const posts=state.requests.filter(r=>r.path.endsWith('/apply'));assert.equal(posts.length,2);assert.deepEqual(posts[0].body,posts[1].body);report.checks.push('Lost-response retry keeps field selection and import identity');await context.close();
  }
  for(const kind of ['PREVIEW_CHANGED','PREVIEW_EXPIRED']){
    const {context,page,state}=await fixture();await openConnections(page);await prepare(page);await page.getByRole('checkbox',{name:/^Nom de la boutique/}).check();state.applyError=kind;await page.getByRole('button',{name:'Confirmer l’import des champs cochés',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(state.store.name,originalStore.name);await check(page,'social-'+kind.toLowerCase());await context.close();
  }
  {
    const {context,page,state}=await fixture();await openConnections(page);state.failAccounts=true;await page.getByRole('button',{name:'Choisir les informations',exact:true}).click();await page.getByRole('alert').waitFor();await check(page,'social-provider-outage');await page.getByRole('link',{name:'Produits',exact:true}).click();await page.getByRole('heading',{name:'Vos produits',exact:true}).waitFor();report.checks.push('Provider outage leaves the merchant catalog accessible');await context.close();
  }
  {
    const {context,page,state}=await fixture();await openConnections(page);await page.getByRole('button',{name:'Retirer la connexion',exact:true}).click();await page.getByRole('status').filter({hasText:'Connexion retirée de Commerce Factory.'}).waitFor();assert.equal(state.connected,false);await check(page,'social-disconnected');await context.close();
  }
  {
    const {context,page,state}=await fixture({available:false});state.connected=false;await page.goto(base+'/app/connections');await page.getByText('Connexion bientôt disponible').first().waitFor();assert.equal(await page.getByRole('button',{name:/^Connecter (Facebook|Instagram|TikTok)$/}).count(),0);await check(page,'social-unconfigured');await context.close();
  }
  {
    const {context,page}=await fixture({staff:true});await page.goto(base+'/app/connections?store='+storeId);await page.getByRole('heading',{name:'Accès réservé au propriétaire',exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'Comptes connectés',exact:true}).count(),0);await check(page,'social-staff-access');await context.close();
  }
  {
    const {context,page,state}=await fixture();state.failComplete=true;await page.goto(base+'/app/connections?store='+storeId+'#social_result=ready&provider=facebook&attempt='+attemptId+'&ticket='+ticket);await page.getByRole('button',{name:'Réessayer',exact:true}).waitFor();assert.ok(!page.url().includes(ticket));state.failComplete=false;await page.getByRole('button',{name:'Réessayer',exact:true}).click();await page.getByRole('status').filter({hasText:'Compte connecté.'}).waitFor();assert.equal(await page.evaluate(()=>sessionStorage.getItem('commerce-social-return')),null);await check(page,'social-completion-recovery');report.checks.push('Connection completion survives a lost response and removes the browser ticket');await context.close();
  }
  for(const result of ['cancelled','expired']){
    const {context,page}=await fixture();await page.goto(base+'/app/connections?store='+storeId+'#social_result='+result+'&provider=facebook');await page.getByRole('status').filter({hasText:result==='cancelled' ? 'Connexion annulée.':'La connexion n’a pas abouti.'}).waitFor();assert.equal(new URL(page.url()).hash,'');await check(page,'social-return-'+result);await context.close();
  }
  {
    const {context,page,state}=await fixture();state.badRedirect=true;await openConnections(page);await page.getByRole('button',{name:'Reconnecter Facebook',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(new URL(page.url()).origin,base);report.checks.push('Unexpected provider start destinations are rejected');await context.close();
  }
  await writeFile(output+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({screens:report.screens.length,checks:report.checks,unverified:report.unverified},null,2));
}catch(error){report.error=error.stack;await mkdir(output,{recursive:true});await currentPage?.screenshot({path:output+'/failure.png',fullPage:true}).catch(()=>{});await writeFile(output+'/report.json',JSON.stringify(report,null,2));throw error;
}finally{await browser?.close();server.kill('SIGTERM');}
