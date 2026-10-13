import { lazy, Suspense, useEffect, useState } from "react";
import LandingHeader from "../landing/LandingHeader";
import BrandFooter from "../brand/BrandFooter";
import { preferredLanguage, rememberLanguage } from "../lib/language";
import { merchantAppHref } from "../merchant-navigation";
import { storeThemeIds } from "../../shared/store-themes";
import "./theme-gallery-shell.css";

// Show the introduction and functional CTA immediately. The interactive
// workspace loads only on showroom routes, outside the first text paint.
const ThemeGalleryWorkspace = lazy(() => import("./ThemeGalleryWorkspace"));

export default function ThemeGalleryApp() {
  const [language, setLanguage] = useState(preferredLanguage);
  const fr = language === "fr";
  useEffect(() => {
    document.title = (fr ? "Bibliothèque de thèmes" : "Theme library") + " — Commerce Factory";
    document.documentElement.lang = language;
    rememberLanguage(language);
    const robots = document.head.querySelector('meta[name="robots"]');
    robots?.setAttribute("content", "noindex,follow");
  }, [fr, language]);
  return <div className="theme-gallery-app brand-page">
    <a className="skip-link" href="#page-main">{fr ? "Aller au contenu" : "Skip to content"}</a>
    <LandingHeader language={language} onLanguageChange={setLanguage} home={false} className="theme-gallery-header" />
    <main id="page-main" tabIndex={-1}>
    <section className="theme-gallery-intro"><span>{fr ? "LA BIBLIOTHÈQUE COMMERCE FACTORY" : "THE COMMERCE FACTORY LIBRARY"}</span><h1>{storeThemeIds.length} {fr ? "thèmes." : "themes."}<em>{fr ? "Une boutique à votre image." : "A store with your identity."}</em></h1><p>{fr ? "Mode, sport, beauté, maison, alimentation… Explorez les univers, personnalisez leur style et ouvrez les fiches produits dans l’aperçu." : "Fashion, sports, beauty, interiors, food… Explore the styles, customize them and open product details in the preview."}</p><a className="theme-gallery-create button button-primary" href={merchantAppHref()}>{fr ? "Créer ma boutique" : "Create my store"}<span aria-hidden="true">↗</span></a></section>
    <Suspense fallback={<div className="theme-gallery-loading" role="status">Chargement des aperçus…</div>}>
      <ThemeGalleryWorkspace language={language} />
    </Suspense>
    </main>
    <BrandFooter language={language} />
  </div>;
}
