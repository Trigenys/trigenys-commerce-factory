import { useEffect, useState, type ReactNode } from "react";
import { merchantRequest, type Store } from "./api";
import type { CommerceAuthClient } from "./auth";
import ProductCatalog from "./ProductCatalog";
import AnalyticsPanel from "./AnalyticsPanel";
import OrdersPanel from "./OrdersPanel";
import TeamPanel from "./TeamPanel";
import PlatformPanel from "./PlatformPanel";
import SocialConnections from "./SocialConnections";
import MerchantOverview from "./MerchantOverview";
import WorkspaceNavigation from "./WorkspaceNavigation";
import { workspacePage, workspaceRoute } from "./workspace-pages";
import "./workspace.css";

export default function MerchantWorkspace({ client, store, stores, language, onUpdated, renderSettings, navigationOpen, onCloseNavigation }: {
  client: CommerceAuthClient; store: Store; stores: Store[]; language: "fr" | "en"; onUpdated: (value: Store) => void;
  renderSettings: (section: "appearance" | "settings") => ReactNode; navigationOpen: boolean; onCloseNavigation: () => void;
}) {
  const fr = language === "fr", owner = store.role !== "staff", page = workspacePage();
  const [platform, setPlatform] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void merchantRequest<{ platform: boolean }>(client, "/v1/admin/me/access").then(value => { if (!cancelled) setPlatform(value.platform); }).catch(() => { if (!cancelled) setPlatform(false); });
    return () => { cancelled = true; };
  }, [client]);
  const restricted = !owner && ["appearance", "settings", "analytics", "team", "connections"].includes(page);
  return <div className="merchant-workspace-shell">
    <WorkspaceNavigation store={store} stores={stores} language={language} page={page} platform={platform} open={navigationOpen} onClose={onCloseNavigation} />
    <main className="workspace-main" id="merchant-main" tabIndex={-1}>
      {restricted ? <section className="workspace-section"><header className="workspace-page-heading"><div><h1>{fr ? "Accès réservé au propriétaire" : "Owner access required"}</h1><p>{fr ? "Votre rôle permet de gérer les produits et les commandes." : "Your role allows product and order management."}</p></div></header><a className="admin-primary" href={workspaceRoute(store.id, "products")}>{fr ? "Gérer les produits" : "Manage products"}</a></section>
        : page === "overview" ? <MerchantOverview client={client} store={store} language={language} onUpdated={onUpdated} />
          : page === "products" ? <section className="workspace-section"><ProductCatalog client={client} store={store} language={language} /></section>
            : page === "orders" ? <OrdersPanel client={client} store={store} language={language} />
              : page === "appearance" || page === "settings" ? renderSettings(page)
                : page === "analytics" ? <section className="workspace-section"><AnalyticsPanel client={client} store={store} language={language} /></section>
                  : page === "connections" ? <SocialConnections client={client} store={store} language={language} onUpdated={onUpdated} />
                    : page === "team" ? <TeamPanel client={client} store={store} language={language} />
                      : page === "platform" ? <PlatformPanel client={client} language={language} />
                        : <section className="workspace-section"><h1>{fr ? "Cette page n’existe pas" : "This page does not exist"}</h1><a href={workspaceRoute(store.id, "overview")}>{fr ? "Retour au tableau de bord" : "Back to dashboard"}</a></section>}
    </main>
  </div>;
}
