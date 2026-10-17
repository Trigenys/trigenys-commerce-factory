import { merchantAppHref } from "../merchant-navigation";
import { useState } from "react";
import { isStoreTheme, resolveStoreTheme, type StoreTheme, type ThemeSettings } from "../../shared/store-themes";
import { StorefrontView } from "../storefront/StorefrontApp";
import { themeSampleStorefront } from "./sample-catalog";
import ThemePicker from "./ThemePicker";
import "./theme-gallery.css";

export default function ThemeGalleryWorkspace({ language = "fr" }: { language?: "fr" | "en" }) {
  const fr = language === "fr";
  const params = new URLSearchParams(window.location.search);
  const path = window.location.pathname.split("/").filter(Boolean);
  const initial = path[1] || params.get("theme");
  const [theme, setTheme] = useState<StoreTheme>(isStoreTheme(initial) ? initial : "beauty-ecrin");
  const [settings, setSettings] = useState<ThemeSettings>({});
  const [productSlug, setProductSlug] = useState<string | null>(path[2] === "p" ? path[3] || null : params.get("product"));
  const storefront = themeSampleStorefront(theme, settings, productSlug);
  function changeTheme(value: StoreTheme, nextSettings: ThemeSettings) {
    setTheme(value); setSettings(nextSettings); setProductSlug(null);
    const url = new URL(window.location.href); url.pathname = "/themes/" + value; url.search = ""; url.hash = ""; window.history.replaceState(null, "", url);
  }
  return <div className="theme-gallery-workspace">
      <aside className="theme-gallery-controls"><ThemePicker value={theme} settings={settings} language={language} onChange={changeTheme} /><a className="theme-gallery-cta" href={merchantAppHref()}>{fr ? "Créer ma boutique avec Commerce Factory" : "Create my store with Commerce Factory"} ↗</a>{merchantAppHref() !== "/app" ? <p className="theme-gallery-merchant-note">{fr ? "Création et connexion sur le site principal. Ces nouveaux styles sont encore en aperçu." : "Create an account and log in on the main site. These new styles are still previews."}</p> : null}</aside>
      <section className="theme-gallery-preview" aria-label={fr ? "Aperçu du thème" : "Theme preview"}>
        <div className="theme-gallery-preview-label"><div><strong>{resolveStoreTheme(theme, settings).name}</strong><span>{fr ? "Boutique fictive · images de démonstration" : "Fictional store · demonstration imagery"}</span></div><a href={"/themes/" + theme}>{fr ? "Lien vers ce thème" : "Link to this theme"} ↗</a></div>
        <div onClickCapture={(event) => {
          const link = (event.target as Element).closest("a"); if (!link) return;
          if (link.getAttribute("href") === "#catalog") return;
          const url = new URL(link.href);
          if (url.pathname !== "/themes" && !url.pathname.startsWith("/themes/")) return;
          const parts = url.pathname.split("/").filter(Boolean);
          event.preventDefault(); setProductSlug(parts[2] === "p" ? parts[3] || null : url.searchParams.get("product")); window.history.replaceState(null, "", url);
        }}>
          <StorefrontView key={theme} storefront={storefront} language={language} productSlug={productSlug} homeHref={"/themes/" + theme} productHref={(product) => "/themes/" + theme + "/p/" + product.slug} preview />
        </div>
      </section>
  </div>;
}
