export type WorkspacePage = "overview" | "products" | "orders" | "analytics" | "appearance" | "connections" | "team" | "settings" | "platform";
export const workspacePage = () => window.location.pathname.split("/")[2] || "overview";
export const workspaceRoute = (storeId: string, page: string) => "/app" + (page === "overview" ? "" : "/" + page) + "?store=" + encodeURIComponent(storeId);
export function workspaceTitle(page: string, language: "fr" | "en") {
  const labels: Record<WorkspacePage, [string, string]> = {
    overview: ["Tableau de bord", "Dashboard"], products: ["Produits", "Products"], orders: ["Commandes", "Orders"], analytics: ["Statistiques", "Analytics"],
    appearance: ["Apparence", "Appearance"], connections: ["Comptes connectés", "Connected accounts"], team: ["Équipe", "Team"], settings: ["Réglages", "Settings"], platform: ["Support Trigenys", "Trigenys support"],
  };
  return labels[page as WorkspacePage]?.[language === "fr" ? 0 : 1] || (language === "fr" ? "Mon espace" : "Workspace");
}
