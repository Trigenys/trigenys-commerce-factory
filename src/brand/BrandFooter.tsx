import { landingCopy, type LandingLanguage } from "../landing/content";

export default function BrandFooter({ language, home = false, className = "" }: {
  language: LandingLanguage; home?: boolean; className?: string;
}) {
  const t = landingCopy[language];
  const destination = (href: string) => href.startsWith("#") && !home ? "/" + href : href;
  return <footer className={"site-footer landing-footer " + className}>
    <div><a className="brand footer-brand" href={home ? "#top" : "/"} aria-label={language === "fr" ? "Accueil Commerce Factory" : "Commerce Factory home"}><img className="brand-logo" src="/commerce-factory-logo-v3.png?v=3" alt="Commerce Factory by Trigenys" width={500} height={159} /></a><p>{t.footerBody}</p></div>
    <nav className="footer-links" aria-label={language === "fr" ? "Liens utiles" : "Useful links"}>{["#how", "#showcase", "/themes", "#pricing", "/help", "/contact", "/privacy", "/terms"].map((href, index) => <a key={href} href={destination(href)}>{t.footerLinks[index]}</a>)}</nav>
    <div className="landing-footer-bottom"><span>{t.footerStatus}</span><small>© {new Date().getFullYear()} {t.copyright}</small><a href={home ? "#top" : "#page-main"}>{language === "fr" ? "Retour en haut" : "Back to top"}<span aria-hidden="true">↑</span></a></div>
  </footer>;
}
