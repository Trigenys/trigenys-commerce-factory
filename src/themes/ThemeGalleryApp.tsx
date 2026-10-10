import { lazy, Suspense, useEffect } from "react";
import { storeThemeIds } from "../../shared/store-themes";
import "./theme-gallery-shell.css";

// Show the introduction and functional CTA immediately. The interactive
// workspace loads only on showroom routes, outside the first text paint.
const ThemeGalleryWorkspace = lazy(() => import("./ThemeGalleryWorkspace"));

export default function ThemeGalleryApp() {
  useEffect(() => {
    document.title = "Bibliothèque de thèmes — Commerce Factory";
    const robots = document.head.querySelector('meta[name="robots"]');
    robots?.setAttribute("content", "noindex,follow");
  }, []);
  return <div className="theme-gallery-app">
    <header className="theme-gallery-header"><a href="/">Commerce Factory <span>Thèmes</span></a><a className="theme-gallery-create" href="/app">Créer ma boutique ↗</a></header>
    <section className="theme-gallery-intro"><span>LA BIBLIOTHÈQUE COMMERCE FACTORY</span><h1>{storeThemeIds.length - 1} styles.<br />Une boutique à votre image.</h1><p>Mode, sport, beauté, maison, alimentation… Explorez les univers, personnalisez leur style et ouvrez les fiches produits dans l’aperçu.</p></section>
    <Suspense fallback={<div className="theme-gallery-loading" role="status">Chargement des aperçus…</div>}>
      <ThemeGalleryWorkspace />
    </Suspense>
  </div>;
}
