import { useEffect, useRef } from "react";
import type { Store } from "./api";
import AppIcon from "./AppIcon";
import { workspaceRoute, workspaceTitle, type WorkspacePage } from "./workspace-pages";

export default function WorkspaceNavigation({ store, stores, language, page, platform, open, onClose }: {
  store: Store; stores: Store[]; language: "fr" | "en"; page: string; platform: boolean; open: boolean; onClose: () => void;
}) {
  const fr = language === "fr", owner = store.role !== "staff";
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const media = window.matchMedia("(max-width: 1023px)");
    const closeOnDesktop = () => { if (!media.matches) onClose(); };
    if (open && media.matches) element.showModal();
    else if (element.open) element.close();
    const overflow = document.body.style.overflow;
    if (open && media.matches) document.body.style.overflow = "hidden";
    media.addEventListener("change", closeOnDesktop);
    return () => { document.body.style.overflow = overflow; media.removeEventListener("change", closeOnDesktop); if (element.open) element.close(); };
  }, [open, onClose]);
  const groups: { label: string; pages: WorkspacePage[] }[] = [
    { label: "Commerce", pages: ["overview", "orders", "products", ...(owner ? ["analytics" as const] : [])] },
    ...(owner ? [{ label: fr ? "Boutique" : "Store", pages: ["appearance", "connections", "team", "settings"] as WorkspacePage[] }] : []),
    ...(platform ? [{ label: "Trigenys", pages: ["platform"] as WorkspacePage[] }] : []),
  ];
  function content() {
    return <>
      <div className="workspace-store"><span className="workspace-store-avatar" aria-hidden="true">{store.logoUrl ? <img src={store.logoUrl} alt="" /> : store.name.trim().slice(0, 1).toUpperCase()}</span><div className="workspace-store-copy"><strong title={store.name}>{store.name}</strong><span>{owner ? (fr ? "Propriétaire" : "Owner") : (fr ? "Collaborateur" : "Staff")}</span></div>
        {stores.length > 1 && <label className="workspace-store-switch"><span>{fr ? "Boutique active" : "Active store"}</span><select aria-label={fr ? "Boutique active" : "Active store"} value={store.id} onChange={event => window.location.assign(workspaceRoute(event.target.value, "overview"))}>{stores.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
      </div>
      <nav aria-label={fr ? "Espace marchand" : "Merchant workspace"}>{groups.map(group => <div className="workspace-nav-group" key={group.label}><span className="workspace-nav-label">{group.label}</span>{group.pages.map(id => <a key={id} href={workspaceRoute(store.id, id)} aria-current={page === id ? "page" : undefined}><AppIcon name={id} /><span>{workspaceTitle(id, language)}</span></a>)}</div>)}</nav>
      <div className="workspace-sidebar-bottom"><div className="workspace-store-state"><span className={"workspace-status-dot " + store.status} /><span>{store.status === "published" ? (fr ? "Boutique en ligne" : "Store is live") : (fr ? "Brouillon privé" : "Private draft")}</span></div>
        {store.status === "published" && <a className="workspace-view-store" href={"/store/" + encodeURIComponent(store.slug)} target="_blank" rel="noreferrer"><AppIcon name="external" />{fr ? "Voir la boutique" : "View store"}</a>}
        <a className="workspace-help" href="/help"><AppIcon name="help" />{fr ? "Aide et support" : "Help and support"}</a>
      </div>
    </>;
  }
  return <><aside className="merchant-sidebar">{content()}</aside><dialog ref={dialog} className="merchant-drawer" id="merchant-navigation" aria-labelledby="merchant-navigation-title" onClose={onClose} onClick={event => { if (event.target === event.currentTarget && event.clientX > event.currentTarget.getBoundingClientRect().right) onClose(); }}><div className="merchant-drawer-heading"><h2 id="merchant-navigation-title">Navigation</h2><button type="button" className="workspace-icon-button" onClick={onClose} aria-label={fr ? "Fermer la navigation" : "Close navigation"}><AppIcon name="close" /></button></div>{content()}</dialog></>;
}
