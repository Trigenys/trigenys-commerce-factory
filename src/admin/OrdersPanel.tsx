import { useEffect, useState } from "react";
import { merchantRequest, type Store } from "./api";
import type { CommerceAuthClient } from "./auth";
import { canTransitionOrder, orderLabels, orderStatuses, type MerchantOrder, type OrderPatch } from "../../shared/commerce-journeys";

export default function OrdersPanel({client,store,language}: {client:CommerceAuthClient;store:Store;language:"fr"|"en"}) {
  const fr=language==="fr",labels=orderLabels[language],owner=store.role!=="staff";
  const[orders,setOrders]=useState<MerchantOrder[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState("");const[busy,setBusy]=useState("");const[filter,setFilter]=useState("all");const[message,setMessage]=useState("");
  const path="/v1/admin/stores/"+store.id+"/orders";
  async function load(){setLoading(true);setError("");try{setOrders((await merchantRequest<{orders:MerchantOrder[]}>(client,path)).orders);}catch{setError(fr ? "Les commandes n’ont pas pu être chargées. Réessayez." : "Orders could not be loaded. Try again.");}finally{setLoading(false);}}
  useEffect(()=>{void load();},[store.id]);
  async function update(order:MerchantOrder,patch:Omit<OrderPatch,"expectedVersion">){
    if(patch.paymentStatus && !window.confirm(fr ? "Confirmez seulement un paiement ou remboursement réellement effectué hors de l’outil. Continuer ?" : "Only confirm a payment or refund actually made outside the tool. Continue?"))return;
    setBusy(order.id);setError("");setMessage("");
    try{const result=await merchantRequest<{order:MerchantOrder}>(client,path+"/"+order.id,{method:"PATCH",body:JSON.stringify({...patch,expectedVersion:order.version})});setOrders(current=>current.map(o=>o.id===order.id ? result.order:o));setMessage(fr ? "Commande mise à jour." : "Order updated.");}
    catch{setError(fr ? "La mise à jour n’a pas abouti. Actualisez : la commande a peut-être changé dans un autre onglet." : "The update did not complete. Refresh: another tab may have changed the order.");}finally{setBusy("");}
  }
  return <section className="workspace-section"><div className="section-heading"><div><span className="admin-eyebrow">{store.name}</span><h1>{fr ? "Commandes" : "Orders"}</h1><p>{fr ? "Confirmez la disponibilité, suivez la préparation et indiquez les paiements reçus." : "Confirm availability, follow preparation and record received payments."}</p></div><button type="button" className="admin-secondary" onClick={load} disabled={loading}>{fr ? "Actualiser" : "Refresh"}</button></div>
    <p className="draft-note">{fr ? "Les paiements sont convenus avec le client sur WhatsApp. L’outil n’encaisse pas et ne rembourse pas automatiquement." : "Payment is agreed with the customer on WhatsApp. This tool does not automatically collect payments or issue refunds."}</p>
    <label className="workspace-filter">{fr ? "Afficher" : "Show"}<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">{fr ? "Toutes les commandes" : "All orders"}</option>{orderStatuses.map(status=><option key={status} value={status}>{labels[status]}</option>)}</select></label>
    {loading && <p role="status">{fr ? "Chargement des commandes…" : "Loading orders…"}</p>}{error && <p className="form-message error" role="alert">{error}</p>}{message && <p className="form-message success" role="status">{message}</p>}
    {!loading && !error && orders.length===0 && <div className="info-card"><h2>{fr ? "Votre première commande vous attend" : "Your first order is ahead"}</h2><p>{fr ? "Partagez le lien de votre boutique. Les demandes enregistrées depuis un panier apparaîtront ici." : "Share your store link. Requests saved from a cart will appear here."}</p><a href={"/store/"+store.slug}>{fr ? "Ouvrir ma boutique" : "Open my store"}</a></div>}
    <div className="orders-list">{orders.filter(o=>filter==="all"||o.status===filter).map(order=><details className="info-card order-card" key={order.id}><summary><strong>{order.reference}</strong><span>{labels[order.status]}</span><b>{Number(order.total).toLocaleString(fr ? "fr-FR" : "en-GB")} {order.currencyCode}</b></summary>
      <p>{new Date(order.createdAt).toLocaleString(fr ? "fr-FR" : "en-GB")} · {labels[order.paymentMethod]} · <strong>{labels[order.paymentStatus]}</strong></p>
      {order.customerName && <p>{fr ? "Client" : "Customer"} : {order.customerName}</p>}{order.customerPhone && <p>{fr ? "Téléphone" : "Phone"} : {order.customerPhone}</p>}{order.note && <p className="preserve-lines">{order.note}</p>}
      <ul>{order.lines.map((line,i)=><li key={i}>{line.quantity} × {line.name} {Object.entries(line.variants).map(([name,value])=>name+": "+value).join(", ")} — {line.amount} {order.currencyCode}</li>)}</ul>
      <div className="order-actions">{orderStatuses.filter(next=>next!==order.status&&canTransitionOrder(order.status,next)).map(next=><button key={next} type="button" className={next==="cancelled" ? "admin-secondary" : "admin-primary"} disabled={busy===order.id || (next==="completed" && order.paymentStatus!=="paid")} onClick={()=>{if(next!=="cancelled" || window.confirm(fr ? "Annuler cette demande ? Un paiement reçu reste à rembourser hors de l’outil." : "Cancel this request? Any received payment must be refunded outside the tool."))void update(order,{status:next});}}>{labels[next]}</button>)}
        {owner && order.paymentStatus==="pending" && order.status!=="cancelled" && <button type="button" className="admin-secondary" disabled={busy===order.id} onClick={()=>update(order,{paymentStatus:"paid"})}>{fr ? "Confirmer le paiement reçu" : "Confirm received payment"}</button>}
        {owner && order.status==="cancelled" && order.paymentStatus==="paid" && <button type="button" className="admin-secondary" disabled={busy===order.id} onClick={()=>update(order,{paymentStatus:"refunded"})}>{fr ? "Confirmer le remboursement effectué" : "Confirm completed refund"}</button>}
      </div>
      {order.status==="ready" && order.paymentStatus!=="paid" && <p>{fr ? "Le propriétaire doit confirmer le paiement avant la remise." : "The owner must confirm payment before handover."}</p>}
      <h3>{fr ? "Historique" : "History"}</h3><ol className="order-history">{order.history.map((entry,i)=><li key={i}><time dateTime={entry.at}>{new Date(entry.at).toLocaleString(fr ? "fr-FR" : "en-GB")}</time> · {labels[entry.status]} · {labels[entry.paymentStatus]}</li>)}</ol>
    </details>)}</div>
  </section>;
}
