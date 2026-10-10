import { useEffect, useState } from "react";
import { PublicLayout } from "../pages/PublicPages";
import { preferredLanguage, rememberLanguage } from "../lib/language";
import { timedFetch } from "../lib/requests";
import { apiBaseUrl } from "../admin/runtime";
import { orderLabels, type PublicOrder } from "../../shared/commerce-journeys";
import "./cart.css";

export default function OrderTrackingPage() {
  const [language,setLanguage]=useState(preferredLanguage);
  const [order,setOrder]=useState<PublicOrder|null>(null);
  const [busy,setBusy]=useState(true);
  const [error,setError]=useState("");
  const fr=language==="fr",labels=orderLabels[language];
  async function load() {
    setBusy(true);setError("");
    const token=new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    try {
      const id=window.location.pathname.split("/").pop();
      const response=await timedFetch(apiBaseUrl+"/v1/public/orders/"+encodeURIComponent(id||""),{headers:{"X-Order-Token":token}});
      if(!response.ok)throw new Error(response.status===404 ? "MISSING" : "CONNECTION");
      setOrder((await response.json()).order);
    } catch(e) {setError(e instanceof Error&&e.message==="MISSING" ? (fr ? "Le lien privé est incomplet ou cette commande est inaccessible. Utilisez le lien remis après votre demande." : "The private link is incomplete or this order is unavailable. Use the link shown after your request.") : (fr ? "La connexion est interrompue. Réessayez pour retrouver le statut." : "Connection was interrupted. Retry to see the status."));}
    finally{setBusy(false);}
  }
  useEffect(()=>{void load();},[]);
  useEffect(()=>{
    rememberLanguage(language);document.documentElement.lang=language;
    document.title=(fr ? "Suivi de commande" : "Order tracking")+" — Commerce Factory";
    const tags=["robots","referrer"].map(name=>{const el=document.createElement("meta");el.name=name;el.content=name==="robots" ? "noindex,nofollow" : "no-referrer";document.head.appendChild(el);return el;});
    return()=>tags.forEach(el=>el.remove());
  },[language]);
  return <PublicLayout language={language} onLanguage={setLanguage}><span className="admin-eyebrow">{order?.storeName||"Commerce Factory"}</span><h1>{fr ? "Votre commande, étape par étape" : "Your order, step by step"}</h1>
    {busy&&<p role="status">{fr ? "Chargement du statut…" : "Loading status…"}</p>}{error&&<p role="alert" className="form-message error">{error}</p>}
    {order&&<><div className="info-card order-tracking-card"><strong>{order.reference}</strong><p>{fr ? "Commande" : "Order"} : <b>{labels[order.status]}</b></p><p>{fr ? "Paiement" : "Payment"} : <b>{labels[order.paymentStatus]}</b> · {labels[order.paymentMethod]}</p><p className="cart-total">{Number(order.total).toLocaleString(fr ? "fr-FR" : "en-GB")} {order.currencyCode}</p><ul>{order.lines.map((line,i)=><li key={i}>{line.quantity} × {line.name} {Object.entries(line.variants).map(([k,v])=>k+": "+v).join(" · ")} — {line.amount} {order.currencyCode}</li>)}</ul><p>{fr ? "Le vendeur confirme la disponibilité, le paiement reçu et la remise. Conservez ce lien privé pour revenir." : "The seller confirms availability, received payment and handover. Keep this private link to return."}</p><a href={"/store/"+order.storeSlug}>{fr ? "Retour à la boutique" : "Back to store"}</a></div><section className="info-card"><h2>{fr ? "Historique" : "History"}</h2><ol className="order-history">{order.history.map((event,i)=><li key={i}><time dateTime={event.at}>{new Date(event.at).toLocaleString(fr ? "fr-FR" : "en-GB")}</time><strong>{labels[event.status]} · {labels[event.paymentStatus]}</strong></li>)}</ol></section></>}
    <button type="button" className="admin-secondary" onClick={load} disabled={busy}>{fr ? "Actualiser le statut" : "Refresh status"}</button>
  </PublicLayout>;
}
