import { useEffect, useState } from "react";
import { listProducts, merchantRequest, publishStore, type Product, type Store } from "./api";
import type { CommerceAuthClient } from "./auth";
import { orderLabels, type MerchantOrder } from "../../shared/commerce-journeys";
import AppIcon from "./AppIcon";
import MerchantNotice, { useMerchantNotice } from "./MerchantNotice";
import { workspaceRoute } from "./workspace-pages";

export default function MerchantOverview({ client, store, language, onUpdated }: { client: CommerceAuthClient; store: Store; language: "fr" | "en"; onUpdated: (value: Store) => void }) {
  const fr = language === "fr", owner = store.role !== "staff", live = store.status === "published";
  const [products, setProducts] = useState<Product[]>([]), [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0);
  const [errors, setErrors] = useState<{ products?: string; orders?: string }>({});
  const { notice, notify, dismiss } = useMerchantNotice();
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErrors({});
    void Promise.allSettled([listProducts(client, store.id), merchantRequest<{ orders: MerchantOrder[] }>(client, "/v1/admin/stores/" + store.id + "/orders")]).then(([catalog, requests]) => {
      if (cancelled) return;
      if (catalog.status === "fulfilled") setProducts(catalog.value);
      if (requests.status === "fulfilled") setOrders(requests.value.orders);
      setErrors({ ...(catalog.status === "rejected" ? { products: fr ? "Catalogue temporairement inaccessible." : "Catalog temporarily unavailable." } : {}), ...(requests.status === "rejected" ? { orders: fr ? "Commandes temporairement inaccessibles." : "Orders temporarily unavailable." } : {}) });
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [client, store.id, fr, attempt]);
  const active = products.filter(product => product.status === "active").length;
  const draft = products.filter(product => product.status === "draft").length;
  const requested = orders.filter(order => order.status === "requested").length;
  const processing = orders.filter(order => ["confirmed", "preparing", "ready"].includes(order.status)).length;
  const recent = [...orders].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5);
  const route = (name: string) => workspaceRoute(store.id, name);
  async function publish() {
    setBusy(true); dismiss();
    try { onUpdated(await publishStore(client, store.id)); notify("success", fr ? "Votre boutique est publiée." : "Your store is published."); }
    catch { notify("error", fr ? "La publication n’a pas abouti. Vérifiez qu’un produit est actif et réessayez." : "Publication did not complete. Make sure a product is active and try again."); }
    finally { setBusy(false); }
  }
  const stats = [
    { label: fr ? "Commandes à traiter" : "Orders to review", count: requested, error: errors.orders, page: "orders", detail: fr ? "Demandes reçues" : "Received requests", icon: "orders" },
    { label: fr ? "En préparation" : "In progress", count: processing, error: errors.orders, page: "orders", detail: fr ? "Confirmées, préparées ou prêtes" : "Confirmed, preparing or ready", icon: "refresh" },
    { label: fr ? "Produits actifs" : "Active products", count: active, error: errors.products, page: "products", detail: fr ? "Visibles après publication" : "Visible once published", icon: "products" },
    { label: fr ? "Produits en brouillon" : "Draft products", count: draft, error: errors.products, page: "products", detail: fr ? "À compléter avant activation" : "To complete before activation", icon: "appearance" },
  ];
  return <section className="workspace-section workspace-overview">
    <header className="workspace-page-heading"><div><h1>{fr ? "Tableau de bord" : "Dashboard"}</h1><p>{fr ? "Le point sur votre boutique et les prochaines actions." : "Your store at a glance and what to do next."}</p></div><div className="workspace-page-actions">
      {owner && !live && <button type="button" className="admin-secondary" onClick={publish} disabled={busy || loading || Boolean(errors.products) || active === 0}>{busy ? (fr ? "Publication…" : "Publishing…") : (fr ? "Publier la boutique" : "Publish store")}</button>}
      <a className="admin-primary" href={route("products") + "&new=1"}><AppIcon name="plus" />{fr ? "Ajouter un produit" : "Add a product"}</a>
    </div></header>
    <MerchantNotice notice={notice} language={language} onDismiss={dismiss} />
    {loading && <p className="workspace-loading" role="status">{fr ? "Chargement de votre activité…" : "Loading your activity…"}</p>}
    {(errors.products || errors.orders) && <div className="workspace-inline-alert" role="alert"><span>{[errors.products, errors.orders].filter(Boolean).join(" ")}</span><button className="admin-secondary" type="button" onClick={() => setAttempt(value => value + 1)}>{fr ? "Réessayer" : "Try again"}</button></div>}
    <div className="dashboard-cards">{stats.map(item => <article className="dashboard-stat" key={item.label}><div><span>{item.label}</span><AppIcon name={item.icon} /></div><strong>{loading ? "…" : item.error ? "—" : item.count}</strong><a href={route(item.page)}>{item.detail}<AppIcon name="arrow" /></a></article>)}</div>
    <div className="dashboard-working-grid">
      <section className="workspace-panel dashboard-orders"><div className="workspace-panel-heading"><h2>{fr ? "Dernières commandes" : "Recent orders"}</h2><a href={route("orders")}>{fr ? "Tout voir" : "View all"}<AppIcon name="arrow" /></a></div>
        {!loading && !errors.orders && recent.length > 0 ? <div className="workspace-table-wrap"><table className="workspace-table"><caption className="visually-hidden">{fr ? "Les cinq dernières commandes" : "Five most recent orders"}</caption><thead><tr><th scope="col">{fr ? "Commande" : "Order"}</th><th scope="col">{fr ? "Statut" : "Status"}</th><th scope="col">Total</th></tr></thead><tbody>{recent.map(order => <tr key={order.id}><td><a href={route("orders")}>{order.reference}</a><small>{new Date(order.createdAt).toLocaleDateString(fr ? "fr-FR" : "en-GB")}</small></td><td><span className={"workspace-badge order-" + order.status}>{orderLabels[language][order.status]}</span></td><td>{Number(order.total).toLocaleString(fr ? "fr-FR" : "en-GB")} {order.currencyCode}</td></tr>)}</tbody></table></div> : <div className="workspace-empty"><AppIcon name="orders" /><strong>{loading ? (fr ? "Chargement…" : "Loading…") : errors.orders ? (fr ? "Données indisponibles" : "Data unavailable") : (fr ? "Aucune commande pour le moment" : "No orders yet")}</strong><p>{errors.orders ? (fr ? "Réessayez pour retrouver vos demandes." : "Try again to retrieve your requests.") : live ? (fr ? "Partagez le lien de votre boutique pour recevoir vos premières demandes." : "Share your store link to receive your first requests.") : (fr ? "Publiez votre boutique pour commencer à recevoir des demandes." : "Publish your store to start receiving requests.")}</p></div>}
      </section>
      <section className="workspace-panel dashboard-store"><div className="workspace-panel-heading"><h2>{fr ? "Votre boutique" : "Your store"}</h2><span className={"workspace-badge " + (live ? "published" : "draft")}>{live ? (fr ? "En ligne" : "Live") : (fr ? "Brouillon" : "Draft")}</span></div><strong>{store.name}</strong><p className="workspace-store-url">/store/{store.slug}</p>
        {live ? <a className="admin-secondary" href={"/store/" + encodeURIComponent(store.slug)} target="_blank" rel="noreferrer">{fr ? "Ouvrir la boutique" : "Open store"}<AppIcon name="external" /></a> : <p className="workspace-store-hint">{active === 0 ? (fr ? "Activez au moins un produit pour pouvoir publier." : "Activate at least one product to publish.") : (fr ? "Le catalogue est prêt. Le propriétaire peut publier la boutique." : "The catalog is ready. The owner can publish the store.")}</p>}
        {owner && <div className="dashboard-shortcuts"><a href={route("appearance")}><AppIcon name="appearance" /><span>{fr ? "Personnaliser l’apparence" : "Customize appearance"}</span><AppIcon name="arrow" /></a><a href={route("settings")}><AppIcon name="settings" /><span>{fr ? "Modifier les réglages" : "Update settings"}</span><AppIcon name="arrow" /></a></div>}
      </section>
    </div>
    {owner && <details className="workspace-panel launch-guide" open={!live}><summary><div><h2>{fr ? "Préparer la mise en ligne" : "Prepare to go live"}</h2><span>{1 + Number(active > 0) + Number(live)}/3 {fr ? "étapes terminées" : "steps complete"}</span></div><AppIcon name="chevron" /></summary><ol className="launch-checklist">{[
      { done: true, title: fr ? "Identité créée" : "Identity created", body: fr ? "Nom et numéro WhatsApp enregistrés." : "Name and WhatsApp number saved.", href: route("settings"), action: fr ? "Modifier" : "Edit" },
      { done: active > 0, title: fr ? "Activer un produit" : "Activate a product", body: fr ? "Au moins un produit actif dans votre catalogue." : "At least one active product in your catalog.", href: route("products"), action: fr ? "Gérer les produits" : "Manage products" },
      { done: live, title: fr ? "Publier la boutique" : "Publish the store", body: live ? (fr ? "Votre lien public est prêt à partager." : "Your public link is ready to share.") : (fr ? "Utilisez le bouton de publication en haut de cette page." : "Use the publish button at the top of this page."), href: live ? "/store/" + encodeURIComponent(store.slug) : route("appearance"), action: live ? (fr ? "Voir la boutique" : "View store") : (fr ? "Vérifier l’apparence" : "Review appearance") },
    ].map((step, index) => <li key={step.title}><span className={"launch-step-indicator " + (step.done ? "done" : "")}>{step.done ? <AppIcon name="check" /> : index + 1}<span className="visually-hidden">{step.done ? (fr ? "Terminé" : "Complete") : (fr ? "À faire" : "To do")}</span></span><div><strong>{step.title}</strong><p>{step.body}</p></div><a href={step.href}>{step.action}<AppIcon name="arrow" /></a></li>)}</ol></details>}
  </section>;
}
