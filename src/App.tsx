import { useEffect, useRef, useState, lazy, Suspense } from "react";
import CommerceHero from "./components/CommerceHero";
import LandingHeader from "./landing/LandingHeader";
import type { LandingLanguage } from "./landing/content";
import BrandFooter from "./brand/BrandFooter";
import "./landing/landing-shell.css";
import "./landing/carousel.css";

const LandingContent = lazy(() => import("./landing/LandingContent"));
const metadata = {
  fr: {
    metaTitle: "Commerce Factory par Trigenys",
    metaDescription: "Créez une boutique à votre image, présentez vos produits et recevez des demandes précises sur WhatsApp. Thèmes, catalogue et gestion, pensés pour le mobile.",
    skip: "Aller au contenu"
  },
  en: {
    metaTitle: "Commerce Factory by Trigenys",
    metaDescription: "Build a store with your own identity, showcase your products and receive useful WhatsApp inquiries. Themes, catalog and management, designed for mobile.",
    skip: "Skip to content"
  }
};

export default function App() {
  const shellRef = useRef<HTMLDivElement>(null);
  const [contentReady, setContentReady] = useState(() => Boolean(window.location.hash && window.location.hash !== "#top"));
  useEffect(() => {
    if (contentReady) return;
    // Give the hero a painted frame before loading the longer illustrated sections.
    // Direct links and immediate navigation still load their destination at once.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setContentReady(true));
    });
    const navigate = () => setContentReady(true);
    window.addEventListener("hashchange", navigate);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("hashchange", navigate); };
  }, [contentReady]);
  const [language, setLanguage] = useState<LandingLanguage>(() => {
    try { return localStorage.getItem("commerce-factory-language") === "en" ? "en" : "fr"; }
    catch { return "fr"; }
  });
  const t = metadata[language];
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t.metaTitle;
    try { localStorage.setItem("commerce-factory-language", language); } catch { /* Optional preference. */ }
    for (const [selector, value] of [
      ['meta[name="description"]', t.metaDescription],
      ['meta[property="og:title"]', t.metaTitle],
      ['meta[property="og:description"]', t.metaDescription]
    ]) document.querySelector(selector)?.setAttribute("content", value);
  }, [language, t.metaTitle, t.metaDescription]);

  return <div ref={shellRef} className="site-shell landing-shell brand-page">
    <a className="skip-link" href="#top">{t.skip}</a>
    <LandingHeader language={language} onLanguageChange={setLanguage} />
    <main id="top" tabIndex={-1}>
      <CommerceHero language={language} />

      {contentReady ? <Suspense fallback={<div role="status" style={{ minHeight: "100vh", padding: "2rem" }}>{language === "fr" ? "Chargement…" : "Loading…"}</div>}>
        <LandingContent language={language} shellRef={shellRef} />
      </Suspense> : <div role="status" style={{ minHeight: "100vh", padding: "2rem" }}>{language === "fr" ? "Chargement…" : "Loading…"}</div>}
    </main>
    <BrandFooter language={language} home />
  </div>;
}
