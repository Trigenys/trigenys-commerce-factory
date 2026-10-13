import { useEffect, useRef, useState } from "react";
import { importFields, isSocialProvider, type ImportField, type SocialAccount, type SocialConnection, type SocialPreview, type SocialProvider } from "../../shared/social-connections";
import { useUnsavedChanges } from "../lib/drafts";
import { ApiError, merchantRequest, type Store } from "./api";
import type { CommerceAuthClient } from "./auth";
import { apiBaseUrl } from "./runtime";
import { clearSocialReturn, pendingSocialReturn } from "./social-return";
import "./social-connections.css";

const names={facebook:"Facebook",instagram:"Instagram",tiktok:"TikTok"};
const labels={fr:{name:"Nom de la boutique",description:"Description",businessLocation:"Localisation",contactEmail:"Email de contact"},en:{name:"Store name",description:"Description",businessLocation:"Location",contactEmail:"Contact email"}};
const previewKey=(storeId:string)=>"commerce-social-preview:"+storeId;
function safeProfileHref(value:string|null):string|undefined {
  try{const u=new URL(value || "");return u.protocol==="https:" && !u.username && !u.password && ["www.facebook.com","www.instagram.com","www.tiktok.com","tiktok.com"].includes(u.hostname) ? u.origin+u.pathname:undefined;}catch{return undefined;}
}

export default function SocialConnections({client,store,language,onUpdated}:{client:CommerceAuthClient;store:Store;language:"fr"|"en";onUpdated:(store:Store)=>void}) {
  const fr=language==="fr",path="/v1/admin/stores/"+store.id+"/connections";
  const[connections,setConnections]=useState<SocialConnection[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const[error,setError]=useState(""),[message,setMessage]=useState(""),[provider,setProvider]=useState<SocialProvider|null>(null);
  const[accounts,setAccounts]=useState<Pick<SocialAccount,"id"|"name"|"profileUrl">[]>([]),[accountId,setAccountId]=useState("");
  const[preview,setPreview]=useState<SocialPreview|null>(null),[selected,setSelected]=useState<ImportField[]>([]),[expired,setExpired]=useState(false);
  const[uncertain,setUncertain]=useState(false);
  const applyFields=useRef<ImportField[]|null>(null), heading=useRef<HTMLHeadingElement>(null);
  useUnsavedChanges(Boolean(preview && !preview.appliedFields && selected.length && !uncertain));
  useEffect(()=>{const tick=()=>setExpired(Boolean(preview && Date.parse(preview.expiresAt)<=Date.now()));tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);},[preview]);

  function failure(e:unknown) {
    const code=e instanceof ApiError ? e.code:"";
    const copy:Record<string,[string,string]>={
      CONNECTION_UNAVAILABLE:["Cette connexion est temporairement indisponible. Votre boutique reste accessible.","This connection is temporarily unavailable. Your store is still accessible."],
      CONNECTION_EXPIRED_OR_WRONG_ACCOUNT:["La connexion a expiré ou vous utilisez un autre compte Commerce Factory. Reprenez avec le compte utilisé au départ.","The connection expired or you are using another Commerce Factory account. Resume with the original account."],
      PERMISSION_REQUIRED:["Certaines autorisations ont été refusées ou retirées. Reconnectez le compte pour les choisir.","Some permissions were denied or removed. Reconnect the account to choose them."],
      TOKEN_EXPIRED:["L’autorisation a expiré. Reconnectez ce compte.","Authorization expired. Reconnect this account."],
      CONNECTION_REQUIRED:["Reconnectez ce compte pour récupérer ses informations.","Reconnect this account to retrieve its information."],
      PREVIEW_EXPIRED:["Cet aperçu a expiré. Préparez-en un nouveau avant d’importer.","This preview expired. Prepare a new one before importing."],
      PREVIEW_CHANGED:["La boutique ou la connexion a changé. Préparez un nouvel aperçu pour protéger vos dernières modifications.","The store or connection changed. Prepare a new preview to protect your latest changes."],
      PREVIEW_USED:["Cet aperçu a déjà été confirmé avec une autre sélection. Préparez un nouvel aperçu.","This preview was already confirmed with another selection. Prepare a new preview."],
      PREVIEW_NOT_FOUND:["Cet aperçu n’est plus disponible. Préparez-en un nouveau.","This preview is no longer available. Prepare a new one."],
      ACCOUNT_NOT_AUTHORIZED:["Ce profil n’est plus autorisé. Choisissez un compte accessible ou reconnectez-vous.","This profile is no longer authorized. Choose an accessible account or reconnect."],
      OWNER_REQUIRED:["Seul le propriétaire de la boutique peut gérer ces connexions.","Only the store owner can manage these connections."],
      RATE_LIMITED:["Trop de tentatives. Patientez une minute avant de reprendre cette connexion.","Too many attempts. Wait a minute before resuming this connection."]
    };
    setError(copy[code]?.[fr ? 0:1] || (fr ? "Impossible de récupérer les informations pour le moment. Réessayez ; votre boutique continue de fonctionner." : "Information is temporarily unavailable. Try again; your store continues to work."));
  }
  async function refresh(){const v=await merchantRequest<{connections:SocialConnection[]}>(client,path);setConnections(v.connections);}
  async function load() {
    setLoading(true);setError("");
    try {
      const pending=pendingSocialReturn();
      if(pending?.result==="ready") {
        if(pending.storeId!==store.id) throw new ApiError(409,"CONNECTION_EXPIRED_OR_WRONG_ACCOUNT");
        await merchantRequest(client,path+"/complete",{method:"POST",body:JSON.stringify({attempt:pending.attempt,ticket:pending.ticket})});
        clearSocialReturn();setMessage(fr ? "Compte connecté. Vous pouvez maintenant choisir les informations à importer." : "Account connected. You can now choose information to import.");
      } else if(pending){
        setMessage(pending.result==="limited" ? (fr ? "Trop de tentatives. Patientez une minute avant de reprendre cette connexion." : "Too many attempts. Wait a minute before resuming this connection.") : pending.result==="cancelled" ? (fr ? "Connexion annulée. Vous pourrez la reprendre quand vous le souhaitez." : "Connection cancelled. You can resume whenever you like.") : (fr ? "La connexion n’a pas abouti. Vous pouvez réessayer." : "Connection did not complete. You can try again."));clearSocialReturn();
      }
      await refresh();
      let savedId:string|null=null;try{savedId=sessionStorage.getItem(previewKey(store.id));}catch{/* Optional storage. */}
      if(savedId && /^[a-f0-9-]{36}$/.test(savedId)) {
        try {const v=await merchantRequest<{preview:SocialPreview}>(client,path+"/previews/"+savedId);setPreview(v.preview);setProvider(v.preview.provider);setSelected(v.preview.appliedFields || []);
          if(v.preview.appliedFields)setMessage(fr ? "Cet import a déjà été enregistré." : "This import was already saved.");
        } catch{try{sessionStorage.removeItem(previewKey(store.id));}catch{/* Optional storage. */}}
      }
    } catch(e){failure(e);}finally{setLoading(false);}
  }
  useEffect(()=>{void load();},[store.id]);
  async function connect(p:SocialProvider){setBusy(true);setError("");try{
    const v=await merchantRequest<{href:string}>(client,path+"/"+p+"/start",{method:"POST"});
    const href=new URL(v.href),api=new URL(apiBaseUrl,window.location.origin);
    if(href.origin!==api.origin || href.pathname!=="/v1/social/start/"+p || href.protocol!=="https:")throw new Error("INVALID_PROVIDER_REDIRECT");
    window.location.assign(href.toString());
  }catch(e){failure(e);}finally{setBusy(false);}}
  async function choose(p:SocialProvider){setBusy(true);setError("");setMessage("");setProvider(p);setPreview(null);setSelected([]);setAccounts([]);setAccountId("");setUncertain(false);applyFields.current=null;
    try{sessionStorage.removeItem(previewKey(store.id));}catch{/* Optional storage. */}
    try {const v=await merchantRequest<{accounts:Pick<SocialAccount,"id"|"name"|"profileUrl">[]}>(client,path+"/"+p+"/accounts");setAccounts(v.accounts);setAccountId(v.accounts[0]?.id || "");
      if(!v.accounts.length)setMessage(fr ? "Aucun profil accessible. Vérifiez les Pages sélectionnées et, pour Instagram, le lien avec un compte professionnel." : "No accessible profile. Check selected Pages and, for Instagram, the linked professional account.");
    }catch(e){failure(e);await refresh().catch(()=>{});}finally{setBusy(false);}}
  async function prepare(){if(!provider || !accountId)return;setBusy(true);setError("");setMessage("");try{
    const v=await merchantRequest<{preview:SocialPreview}>(client,path+"/"+provider+"/previews",{method:"POST",body:JSON.stringify({accountId})});
    setPreview(v.preview);setSelected([]);setUncertain(false);applyFields.current=null;
    try{sessionStorage.setItem(previewKey(store.id),v.preview.id);}catch{/* Optional storage. */}
    setTimeout(()=>heading.current?.focus(),0);
  }catch(e){failure(e);}finally{setBusy(false);}}
  async function apply(){if(!preview || busy)return;const fields=applyFields.current || [...selected];if(!fields.length)return;
    applyFields.current=fields;setBusy(true);setError("");
    try{
      const v=await merchantRequest<{store:Store;result:string}>(client,path+"/previews/"+preview.id+"/apply",{method:"POST",body:JSON.stringify({fields})});
      setPreview({...preview,appliedFields:fields});setSelected(fields);setUncertain(false);onUpdated(v.store);await refresh().catch(()=>{});
      setMessage(fr ? "Informations importées. Vos produits, votre thème et votre numéro WhatsApp sont conservés." : "Information imported. Your products, theme and WhatsApp number are preserved.");
    }catch(e){
      if(e instanceof ApiError && e.status<500){setUncertain(false);applyFields.current=null;failure(e);}
      else{setUncertain(true);setError(fr ? "La réponse n’est pas arrivée. Vérifiez cet import avec le même bouton ; les champs ne seront pas importés deux fois." : "The response did not arrive. Check this import using the same button; fields will not be imported twice.");}
    }finally{setBusy(false);}
  }
  async function disconnect(p:SocialProvider){
    if(!window.confirm(fr ? "Retirer cette connexion ? Les informations déjà importées restent dans votre boutique." : "Remove this connection? Previously imported information stays in your store."))return;
    setBusy(true);setError("");try{await merchantRequest(client,path+"/"+p,{method:"DELETE"});
      if(provider===p){setPreview(null);setAccounts([]);setSelected([]);setProvider(null);setUncertain(false);applyFields.current=null;try{sessionStorage.removeItem(previewKey(store.id));}catch{/* Optional storage. */}}
      clearSocialReturn();await refresh();setMessage(fr ? "Connexion retirée de Commerce Factory. Vous pouvez aussi retirer l’autorisation depuis ce réseau social." : "Connection removed from Commerce Factory. You can also remove the authorization on that social network.");
    }catch(e){failure(e);}finally{setBusy(false);}
  }
  const descriptions=fr ? {facebook:"Choisissez une Page que vous gérez : nom, description, localisation et email disponibles.",instagram:"Compte professionnel lié à une Page Facebook : nom et biographie disponibles.",tiktok:"Profil autorisé : nom et biographie selon les permissions accordées. Le catalogue TikTok Shop demande un accès distinct."} : {facebook:"Choose a Page you manage: available name, description, location and email.",instagram:"Professional account linked to a Facebook Page: available name and biography.",tiktok:"Authorized profile: name and biography according to granted permissions. TikTok Shop catalogs need separate access."};
  const statuses={connected:fr ? "Connecté":"Connected",disconnected:fr ? "Non connecté":"Not connected",expired:fr ? "À reconnecter":"Reconnect",degraded:fr ? "À vérifier":"Needs attention"};
  return <section className="workspace-section social-workspace" aria-busy={loading || busy}>
    <header className="workspace-page-heading"><div>
    <h1>{fr ? "Connecter ma boutique":"Connect my store"}</h1>
    <p>{fr ? "Récupérez les informations disponibles sur vos comptes, choisissez les champs utiles, puis confirmez leur import." : "Retrieve available account information, choose useful fields, then confirm their import."}</p></div></header>
    <p className="social-boundary">{fr ? "Chaque connexion demande votre autorisation. Les photos de publications, produits et commandes ne sont pas importés avec une simple connexion au profil." : "Each connection requires your authorization. Post photos, products and orders are not imported through profile access alone."}</p>
    {loading && <p role="status">{fr ? "Chargement des connexions…":"Loading connections…"}</p>}
    {error && <p role="alert" className="form-message error">{error}</p>}{message && <p role="status" className="form-message success">{message}</p>}
    {!loading && !connections.length && <button className="admin-secondary" onClick={load} type="button">{fr ? "Réessayer":"Try again"}</button>}
    <div className="social-provider-grid">{connections.map(c=><article key={c.provider} className="social-provider-card">
      <div className="social-provider-heading"><span className={"social-brand social-brand-"+c.provider} aria-hidden="true">{c.provider==="facebook" ? "f":c.provider==="instagram" ? "◎":"♪"}</span><h2>{names[c.provider]}</h2></div>
      <span className={"social-status social-status-"+c.status}>{c.available || c.status!=="disconnected" ? statuses[c.status] : (fr ? "Connexion bientôt disponible":"Connection coming soon")}</span>
      <p>{descriptions[c.provider]}</p>{c.accountName && <p><strong>{c.accountName}</strong></p>}
      {c.lastError && <p>{c.lastError==="PROVIDER_UNAVAILABLE" ? (fr ? "Le service est temporairement inaccessible. Réessayez plus tard." : "The service is temporarily unavailable. Try again later.") : (fr ? "L’autorisation est expirée ou a été retirée. Reconnectez ce compte." : "Authorization expired or was removed. Reconnect this account.")}</p>}
      {c.expiresAt && <small>{fr ? "Autorisation jusqu’au ":"Authorization until "}{new Date(c.expiresAt).toLocaleString(fr ? "fr-FR":"en-GB")}</small>}
      {c.importedAt && <small>{fr ? "Dernier import : ":"Last import: "}{new Date(c.importedAt).toLocaleString(fr ? "fr-FR":"en-GB")}</small>}
      <div className="social-card-actions">{c.available && <button type="button" className="admin-secondary" disabled={busy || loading} onClick={()=>connect(c.provider)}>{c.status==="disconnected" ? (fr ? "Connecter":"Connect") : (fr ? "Reconnecter":"Reconnect")} {names[c.provider]}</button>}
        {c.available && ["connected","degraded"].includes(c.status) && <button type="button" className="admin-primary" disabled={busy || loading} onClick={()=>choose(c.provider)}>{fr ? "Choisir les informations":"Choose information"}</button>}
        {c.status!=="disconnected" && <button type="button" className="auth-switch" disabled={busy} onClick={()=>disconnect(c.provider)}>{fr ? "Retirer la connexion":"Remove connection"}</button>}</div>
    </article>)}</div>
    {provider && accounts.length>0 && !preview && <section className="social-account-choice"><h2>{fr ? "Quel compte représente votre boutique ?":"Which account represents your store?"}</h2>
      <label>{fr ? "Compte à utiliser":"Account to use"}<select value={accountId} onChange={e=>setAccountId(e.target.value)} disabled={busy}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <button type="button" className="admin-primary" onClick={prepare} disabled={busy || !accountId}>{busy ? (fr ? "Préparation…":"Preparing…") : (fr ? "Prévisualiser l’import":"Preview import")}</button>
    </section>}
    {preview && isSocialProvider(preview.provider) && <section className="social-import-preview" aria-labelledby="social-preview-title">
      <h2 id="social-preview-title" tabIndex={-1} ref={heading}>{fr ? "Vérifier avant d’importer":"Review before importing"}</h2>
      <p>{names[preview.provider]} · <strong>{preview.accountName}</strong>{safeProfileHref(preview.profileUrl) && <> · <a href={safeProfileHref(preview.profileUrl)} target="_blank" rel="noreferrer">{fr ? "Voir le profil":"View profile"} ↗</a></>}</p>
      <p>{store.status==="published" ? (fr ? "Votre boutique est en ligne. Les champs que vous confirmez seront visibles par vos clients." : "Your store is live. Confirmed fields will be visible to customers.") : (fr ? "Ces changements restent dans votre boutique en brouillon jusqu’à sa publication." : "These changes remain in your draft store until publication.")}</p>
      {!Object.keys(preview.values).length && <p>{fr ? "Ce compte n’a aucun champ compatible à importer. Vous pouvez renseigner votre boutique depuis les réglages." : "This account has no compatible fields to import. You can enter store information in settings."}</p>}
      <div className="social-preview-fields">{importFields.filter(f=>typeof preview.values[f]==="string").map(field=><label className="social-preview-field" key={field}>
        <input type="checkbox" checked={selected.includes(field)} disabled={busy || uncertain || expired || Boolean(preview.appliedFields)} onChange={e=>setSelected(v=>e.target.checked ? [...v,field] : v.filter(f=>f!==field))}/>
        <span><strong>{labels[language][field]}</strong><span className="social-field-current"><small>{fr ? "Actuellement":"Current"}</small>{preview.currentValues[field] || "—"}</span><span className="social-field-proposed"><small>{fr ? "À importer":"To import"}</small>{preview.values[field]}</span>
          {preview.truncatedFields.includes(field) && <small>{fr ? "Texte raccourci à la longueur acceptée par la boutique. Vous pouvez le modifier ensuite dans les réglages." : "Text shortened to the store’s accepted length. You can edit it afterwards in settings."}</small>}</span>
      </label>)}</div>
      {!preview.appliedFields && <p>{expired ? (fr ? "Cet aperçu a expiré. Préparez-en un nouveau." : "This preview expired. Prepare a new one.") : (fr ? "L’aperçu expire dans quelques minutes. Rien ne change avant votre confirmation." : "This preview expires in a few minutes. Nothing changes until you confirm.")}</p>}
      <div className="social-preview-actions">{!preview.appliedFields && <button className="admin-primary" type="button" disabled={busy || !selected.length || expired && !uncertain} onClick={apply}>{busy ? (fr ? "Vérification…":"Checking…") : uncertain ? (fr ? "Vérifier cet import":"Check this import") : (fr ? "Confirmer l’import des champs cochés":"Confirm selected fields")}</button>}
        {provider && <button className="admin-secondary" type="button" disabled={busy || uncertain} onClick={()=>choose(provider)}>{fr ? "Préparer un nouvel aperçu":"Prepare a new preview"}</button>}
        <a href={"/app/settings?store="+store.id}>{fr ? "Ouvrir les réglages":"Open settings"}</a></div>
    </section>}
  </section>;
}
