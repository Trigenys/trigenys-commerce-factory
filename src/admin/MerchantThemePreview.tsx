import { useId, useState } from "react";
import type { CommerceAuthClient } from "./auth";
import type { Product } from "./api";
import { resolveStoreTheme } from "../../shared/store-themes";
import type { PublicStorefront, Language } from "../storefront/types";
import LiveThemePreview from "../themes/LiveThemePreview";
import { useMerchantMedia } from "./use-merchant-media";

export default function MerchantThemePreview({ client, storeId, store, products, language, published, dirty, catalogState, onRetryProducts }: {
  client: CommerceAuthClient;
  storeId: string;
  store: PublicStorefront["store"];
  products: Product[];
  language: Language;
  published: boolean;
  dirty: boolean;
  catalogState: "loading" | "ready" | "error";
  onRetryProducts: () => void;
}) {
  const [includeDrafts, setIncludeDrafts] = useState(true);
  const hintId = useId();
  const active = products.filter(product => product.status === "active");
  const drafts = products.filter(product => product.status === "draft");
  const shown = [...active, ...(includeDrafts ? drafts : [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const theme = resolveStoreTheme(store.theme, store.themeSettings);
  const urls = [store.logoUrl || "", ...shown.flatMap(product => product.imageUrls)];
  const { sources, failed, retry } = useMerchantMedia(client, storeId, urls);
  const preview = {
    store: { ...store, logoUrl: store.logoUrl ? sources[store.logoUrl] || null : null },
    products: shown.map(product => ({ ...product, imageUrls: product.imageUrls.flatMap(url => sources[url] ? [sources[url]] : []) }))
  };
  const fr = language === "fr";
  return <div className="merchant-theme-preview">
    <div className="theme-preview-context" role="status">
      <strong>{theme.name} · {dirty ? (fr ? "Modifications non enregistrées" : "Unsaved changes") : (fr ? "Thème enregistré" : "Saved theme")}</strong>
      <p>{published
        ? (fr ? "Les clients voient la dernière version enregistrée, avec les produits actifs uniquement." : "Customers see the last saved version, with active products only.")
        : (fr ? "Votre boutique n’est pas publiée. Cet aperçu reste privé, même avec des produits actifs." : "Your store is not published. This preview stays private, including active products.")}</p>
    </div>
    {catalogState === "loading" ? <p role="status">{fr ? "Chargement des produits de l’aperçu…" : "Loading preview products…"}</p>
      : catalogState === "error" ? <div className="theme-preview-context" role="alert"><p>{fr ? "Impossible de charger les produits de l’aperçu." : "Unable to load preview products."}</p><button type="button" className="admin-secondary" onClick={onRetryProducts}>{fr ? "Réessayer" : "Retry"}</button></div>
      : <>
    <div className="theme-preview-products">
      <label><input type="checkbox" checked={includeDrafts} onChange={event => setIncludeDrafts(event.target.checked)} aria-describedby={hintId} />{fr ? "Inclure les brouillons dans l’aperçu privé" : "Include drafts in the private preview"}</label>
      <p id={hintId}>{fr ? `${active.length} actif(s) · ${drafts.length} brouillon(s). Les brouillons restent masqués sur la boutique publique.` : `${active.length} active · ${drafts.length} draft(s). Drafts remain hidden from the public store.`}{" "}<a href={"/app/products?store=" + encodeURIComponent(storeId)}>{fr ? "Gérer la visibilité des produits" : "Manage product visibility"}</a></p>
      {shown.length === 0 && <p role="status">{fr ? "Aucun produit dans cet aperçu. Ajoutez un produit ou incluez vos brouillons pour voir le thème avec votre catalogue." : "No products in this preview. Add a product or include your drafts to see the theme with your catalog."}</p>}
    </div>
    {failed.length > 0 && <p className="merchant-media-warning" role="status">
      {language === "fr" ? "Certaines images n’ont pas pu être chargées." : "Some images could not be loaded."}{" "}
      <button type="button" className="admin-secondary" onClick={retry}>{language === "fr" ? "Réessayer" : "Retry"}</button>
    </p>}
    <LiveThemePreview storefront={preview} language={language} />
    </>}
  </div>;
}
