import { useEffect, useState } from "react";
import { ApiError, merchantRequest } from "./api";
import type { CommerceAuthClient } from "./auth";
import AccountAccess from "./AccountAccess";

export default function InvitationAccept({client,language}: {client:CommerceAuthClient;language:"fr"|"en"}) {
  const fr=language==="fr";const[access,setAccess]=useState<{email:string;emailVerified:boolean}|null>(null);const[error,setError]=useState("");const[busy,setBusy]=useState(false);const[verify,setVerify]=useState(false);
  async function load(){try{setAccess(await merchantRequest(client,"/v1/admin/me/access"));setVerify(false);}catch{setError(fr ? "Votre compte est temporairement inaccessible. Réessayez." : "Your account is temporarily unavailable. Try again.");}}
  useEffect(()=>{void load();},[]);
  async function accept(){setBusy(true);setError("");try{const token=new URLSearchParams(window.location.hash.slice(1)).get("token");const result=await merchantRequest<{storeId:string}>(client,"/v1/admin/invitations/accept",{method:"POST",body:JSON.stringify({token})});window.location.replace("/app?store="+result.storeId);}catch(e){if(e instanceof ApiError && e.code==="EMAIL_VERIFICATION_REQUIRED")setVerify(true);else setError(fr ? "Cette invitation est expirée, déjà utilisée ou liée à un autre email. Demandez un nouveau lien au propriétaire." : "This invitation has expired, was used or belongs to a different email. Ask the owner for a new link.");}finally{setBusy(false);}}
  if(verify&&access?.email)return <AccountAccess client={client} language={language} verificationEmail={access.email} onAuthenticated={load} onVerified={load} />;
  return <main className="workspace-section invitation-page" id="merchant-main"><span className="admin-eyebrow">Commerce Factory</span><h1>{fr ? "Rejoindre une boutique" : "Join a store"}</h1><p>{fr ? "Vous rejoindrez l’équipe comme collaborateur : catalogue et commandes, sans accès aux paiements ni aux réglages du propriétaire." : "You will join as staff: catalog and orders, without access to payments or owner settings."}</p>{access && <p>{fr ? "Compte utilisé" : "Account"} : <strong>{access.email}</strong></p>}{error && <p role="alert" className="form-message error">{error}</p>}
    {access ? <button type="button" className="admin-primary" disabled={busy} onClick={access.emailVerified ? accept : ()=>setVerify(true)}>{busy ? (fr ? "Vérification…" : "Checking…") : access.emailVerified ? (fr ? "Accepter l’invitation" : "Accept invitation") : (fr ? "Vérifier mon email" : "Verify my email")}</button> : <button type="button" className="admin-secondary" onClick={load}>{fr ? "Réessayer" : "Try again"}</button>}
    <a className="admin-secondary" href="/app">{fr ? "Retour à mon espace" : "Back to my workspace"}</a><a href="/help">{fr ? "Aide" : "Help"}</a>
  </main>;
}
