import { useEffect, useRef, useState } from "react";
import { merchantAppHref } from "../merchant-navigation";
import type { LandingLanguage } from "./content";

const navigation = {
  fr: [["#how", "Comment ça marche"], ["#showcase", "Exemples"], ["/themes", "Thèmes"], ["#whatsapp", "WhatsApp"], ["#dashboard", "Gestion"], ["#pricing", "Offres"]],
  en: [["#how", "How it works"], ["#showcase", "Examples"], ["/themes", "Themes"], ["#whatsapp", "WhatsApp"], ["#dashboard", "Manage"], ["#pricing", "Offers"]]
} as const;

export default function LandingHeader({ language, onLanguageChange, home = true, support = false, className = "", ctaClassName = "" }: {
  language: LandingLanguage; onLanguageChange?: (language: LandingLanguage) => void;
  home?: boolean; support?: boolean; className?: string; ctaClassName?: string;
}) {
  const fr = language === "fr";
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const links: readonly (readonly [string, string])[] = support
    ? [["/", fr ? "Accueil" : "Home"], ["/themes", fr ? "Thèmes" : "Themes"], ["/help", fr ? "Aide" : "Help"], ["/contact", "Contact"]]
    : navigation[language].map(([href, label]) => [!home && href.startsWith("#") ? "/" + href : href, label] as const);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 16);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); menuButtonRef.current?.focus(); }
    };
    const desktop = window.matchMedia("(min-width: 1201px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, [open]);

  return <header ref={headerRef} className={"site-header landing-header " + className} data-scrolled={scrolled}
    onBlur={event => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
    }}>
    <a className="brand" href={home ? "#top" : "/"} aria-label={fr ? "Accueil Commerce Factory" : "Commerce Factory home"} onClick={() => setOpen(false)}>
      <img className="brand-logo" src="/commerce-factory-logo-v3.png?v=3" alt="Commerce Factory by Trigenys" width={500} height={159} />
    </a>
    <nav className="desktop-nav" aria-label={fr ? "Navigation principale" : "Primary navigation"}>
      {links.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
    </nav>
    <div className="header-actions">
      <a className="header-login" href={merchantAppHref()}>{fr ? "Connexion" : "Log in"}</a>
      {onLanguageChange && <div className="language-switch" role="group" aria-label={fr ? "Langue" : "Language"}>
        {(["fr", "en"] as const).map(value => <button type="button" key={value}
          className={value === language ? "active" : ""} aria-pressed={value === language}
          onClick={() => onLanguageChange(value)}>{value.toUpperCase()}</button>)}
      </div>}
      <a className={"button button-primary button-compact " + ctaClassName} href={merchantAppHref()}>{fr ? "Créer ma boutique" : "Create my store"}<span aria-hidden="true">↗</span></a>
      <button ref={menuButtonRef} className="landing-menu-toggle" type="button"
        aria-label={fr ? (open ? "Fermer le menu" : "Ouvrir le menu") : (open ? "Close menu" : "Open menu")}
        aria-expanded={open} aria-controls="landing-mobile-menu" onClick={() => setOpen(value => !value)}>
        <span aria-hidden="true" className={open ? "landing-menu-icon is-open" : "landing-menu-icon"}><i /><i /></span>
      </button>
    </div>
    <nav id="landing-mobile-menu" className="landing-mobile-menu" hidden={!open}
      aria-label={fr ? "Navigation mobile" : "Mobile navigation"}>
      {links.map(([href, label], index) => <a key={href} href={href} onClick={() => setOpen(false)}><span>{label}</span><span aria-hidden="true">{href.startsWith("/") ? "↗" : "0" + (index + 1)}</span></a>)}
      <div className="landing-mobile-menu-actions">
        <a href={merchantAppHref()} className="button button-primary" onClick={() => setOpen(false)}>{fr ? "Créer ma boutique" : "Create my store"}<span aria-hidden="true">↗</span></a>
        <a href={merchantAppHref()} className="landing-menu-login" onClick={() => setOpen(false)}>{fr ? "J’ai déjà un compte" : "I already have an account"}</a>
      </div>
    </nav>
  </header>;
}
