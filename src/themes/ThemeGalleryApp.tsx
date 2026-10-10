import { useEffect, useState } from "react";
import { isStoreTheme, resolveStoreTheme, storeThemeIds, type StoreTheme, type ThemeSettings } from "../../shared/store-themes";
import { StorefrontView } from "../storefront/StorefrontApp";
import type { PublicStorefront } from "../storefront/types";
import ThemePicker from "./ThemePicker";
import "./theme-gallery.css";

const sampleProducts: PublicStorefront["products"] = [
  { id: "sample-bag", name: "Sac Signature", slug: "sac-signature", description: "Une silhouette simple pour accompagner vos journées.", price: "18500", currencyCode: "XAF", category: "Mode", stockLabel: "Disponible", imageUrls: ["/landing/fashion-960.webp"], variants: [{ name: "Couleur", value: "Camel" }, { name: "Couleur", value: "Noir" }] },
  { id: "sample-beauty", name: "Collection de soins", slug: "collection-soins", description: "Une sélection pour votre rituel quotidien.", price: "12500", currencyCode: "XAF", category: "Beauté", stockLabel: "Disponible", imageUrls: ["/landing/beauty-960.webp"], variants: [] },
  { id: "sample-headphones", name: "Casque Studio", slug: "casque-studio", description: "Un design enveloppant pour vos moments de musique.", price: "35000", currencyCode: "XAF", category: "Électronique", stockLabel: "Disponible", imageUrls: ["/landing/headphones-960.webp"], variants: [{ name: "Couleur", value: "Noir" }, { name: "Couleur", value: "Blanc" }] },
  { id: "sample-watch", name: "Montre Atelier", slug: "montre-atelier", description: "Un accessoire élégant pour chaque occasion.", price: "28000", currencyCode: "XAF", category: "Accessoires", stockLabel: "Disponible", imageUrls: ["/landing/watch-960.webp"], variants: [] },
  { id: "sample-earbuds", name: "Écouteurs Pocket", slug: "ecouteurs-pocket", description: "Le son vous accompagne partout.", price: "18000", currencyCode: "XAF", category: "Électronique", stockLabel: "Disponible", imageUrls: ["/landing/earbuds-960.webp"], variants: [] },
  { id: "sample-tech", name: "Sélection connectée", slug: "selection-connectee", description: "Les essentiels d’un quotidien connecté.", price: "45000", currencyCode: "XAF", category: "Électronique", stockLabel: "Disponible", imageUrls: ["/landing/electronics-960.webp"], variants: [] }
];

export default function ThemeGalleryApp() {
  const params = new URLSearchParams(window.location.search);
  const path = window.location.pathname.split("/").filter(Boolean);
  const initial = path[1] || params.get("theme");
  const [theme, setTheme] = useState<StoreTheme>(isStoreTheme(initial) ? initial : "beauty-ecrin");
  const [settings, setSettings] = useState<ThemeSettings>({});
  const [productSlug, setProductSlug] = useState<string | null>(path[2] === "p" ? path[3] || null : params.get("product"));
  useEffect(() => {
    document.title = "Bibliothèque de thèmes — Commerce Factory";
    let robots = document.head.querySelector('meta[name="robots"]');
    if (!robots) { robots = document.createElement("meta"); robots.setAttribute("name", "robots"); document.head.appendChild(robots); }
    robots.setAttribute("content", "noindex,follow");
  }, []);
  const storefront: PublicStorefront = {
    store: { name: "Atelier Commerce", slug: "atelier-commerce", description: "Des essentiels bien choisis. Des détails qui font la différence.", whatsappNumber: "", countryCode: "CM", currencyCode: "XAF", businessLocation: "Douala, Cameroun", theme, themeSettings: settings, logoUrl: null },
    products: sampleProducts
  };
  function changeTheme(value: StoreTheme, nextSettings: ThemeSettings) {
    setTheme(value); setSettings(nextSettings); setProductSlug(null);
    const url = new URL(window.location.href); url.pathname = "/themes/" + value; url.search = ""; url.hash = ""; window.history.replaceState(null, "", url);
  }
  return <div className="theme-gallery-app">
    <header className="theme-gallery-header"><a href="/">Commerce Factory <span>Thèmes</span></a><a className="theme-gallery-create" href="/app">Créer ma boutique ↗</a></header>
    <section className="theme-gallery-intro"><span>LA BIBLIOTHÈQUE COMMERCE FACTORY</span><h1>{storeThemeIds.length - 1} styles.<br />Une boutique à votre image.</h1><p>Mode, sport, beauté, maison, alimentation… Explorez les univers, personnalisez leur style et ouvrez les fiches produits dans l’aperçu.</p></section>
    <div className="theme-gallery-workspace">
      <aside className="theme-gallery-controls"><ThemePicker value={theme} settings={settings} language="fr" onChange={changeTheme} /><a className="theme-gallery-cta" href="/app">Créer ma boutique avec Commerce Factory ↗</a></aside>
      <section className="theme-gallery-preview" aria-label="Aperçu du thème">
        <div className="theme-gallery-preview-label"><div><strong>{resolveStoreTheme(theme, settings).name}</strong><span>Catalogue fictif pour comparer les présentations</span></div><a href={"/themes/" + theme}>Lien vers ce thème ↗</a></div>
        <div onClickCapture={(event) => {
          const link = (event.target as Element).closest("a"); if (!link) return;
          if (link.getAttribute("href") === "#catalog") return;
          const url = new URL(link.href);
          if (url.pathname !== "/themes" && !url.pathname.startsWith("/themes/")) return;
          const parts = url.pathname.split("/").filter(Boolean);
          event.preventDefault(); setProductSlug(parts[2] === "p" ? parts[3] || null : url.searchParams.get("product")); window.history.replaceState(null, "", url);
        }}>
          <StorefrontView storefront={storefront} language="fr" productSlug={productSlug} homeHref={"/themes/" + theme} productHref={(product) => "/themes/" + theme + "/p/" + product.slug} preview />
        </div>
      </section>
    </div>
  </div>;
}
