import { useEffect, useState } from "react";
import { storeThemeIds } from "../shared/store-themes";
import CommerceHero from "./components/CommerceHero";
import CommerceJourney from "./components/CommerceJourney";
import LandingHeader from "./landing/LandingHeader";
import LandingFAQ from "./landing/LandingFAQ";
import { landingCopy, showcaseConcepts, type LandingLanguage } from "./landing/content";
import { merchantAppHref } from "./merchant-navigation";
import "./landing/landing.css";

export default function App() {
  const [language, setLanguage] = useState<LandingLanguage>(() => {
    try { return localStorage.getItem("commerce-factory-language") === "en" ? "en" : "fr"; }
    catch { return "fr"; }
  });
  const t = landingCopy[language];
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

  return <div className="site-shell landing-shell">
    <a className="skip-link" href="#top">{t.skip}</a>
    <LandingHeader language={language} onLanguageChange={setLanguage} />
    <main id="top" tabIndex={-1}>
      <CommerceHero language={language} />

      <section className="section landing-how" id="how" aria-labelledby="how-heading">
        <div className="landing-section-heading">
          <span className="overline">{t.howLabel}</span>
          <h2 id="how-heading">{t.howTitle}<em>{t.howAccent}</em></h2>
          <p>{t.howBody}</p>
        </div>
        <ol className="landing-steps">
          {t.steps.map(([number, title, body]) => <li key={number}>
            <span className="landing-step-number" aria-hidden="true">{number}</span>
            <h3>{title}</h3><p>{body}</p>
          </li>)}
        </ol>
      </section>

      <section className="section landing-showcase" id="showcase" aria-labelledby="showcase-heading">
        <div className="landing-section-heading">
          <span className="overline">{t.showcaseLabel}</span>
          <h2 id="showcase-heading">{t.showcaseTitle}<em>{t.showcaseAccent}</em></h2>
          <p>{t.showcaseBody}</p>
        </div>
        <div className="landing-concepts">
          {showcaseConcepts.map(item => <article className={"landing-concept landing-concept--" + item.id} key={item.id}>
            <div className="landing-concept-label"><span>{t.demo}</span><span aria-hidden="true">↗</span></div>
            <div className="landing-concept-preview">
              <div className="landing-concept-brand"><span aria-hidden="true">{item.initial}</span><strong>{item.brand}</strong><small>{t.preview}</small></div>
              <picture>
                <source type="image/avif" srcSet={"/landing/" + item.image + "-480.avif 480w, /landing/" + item.image + "-960.avif 512w"} sizes="(max-width: 700px) 90vw, 31vw" />
                <img src={"/landing/" + item.image + "-960.webp"} srcSet={"/landing/" + item.image + "-480.webp 480w, /landing/" + item.image + "-960.webp 512w"}
                  sizes="(max-width: 700px) 90vw, 31vw" alt="" width={item.width} height={item.height} loading="lazy" decoding="async" />
              </picture>
              <div className="landing-concept-product"><strong>{item.name[language]}</strong><span>{item.price[language]}</span></div>
            </div>
            <div className="landing-concept-copy"><span className="overline">{item.category[language]}</span><p>{item.body[language]}</p></div>
          </article>)}
        </div>
        <p className="landing-disclaimer">{t.disclaimer}</p>
        <div className="landing-theme-invitation">
          <div><span className="landing-theme-count">{storeThemeIds.length}<small>{t.themesLabel}</small></span></div>
          <div className="landing-theme-copy"><h3>{t.themesTitle}<em>{t.themesAccent}</em></h3><p>{t.themesBody}</p>
            <ul className="landing-sector-list">{t.themeSectors.map(sector => <li key={sector}>{sector}</li>)}</ul>
            <a href="/themes" className="landing-text-link">{t.themesCta}<span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </section>

      <CommerceJourney language={language} />

      <section className="section landing-management" id="dashboard" aria-labelledby="dashboard-heading">
        <div className="landing-section-heading">
          <span className="overline">{t.dashboardLabel}</span>
          <h2 id="dashboard-heading">{t.dashboardTitle}<em>{t.dashboardAccent}</em></h2>
          <p>{t.dashboardBody}</p>
        </div>
        <div className="landing-management-points">{t.management.map(([title, body], index) => <div key={title}><span aria-hidden="true">0{index + 1}</span><strong>{title}</strong><p>{body}</p></div>)}</div>
        <div className="landing-dashboard">
          <aside className="landing-dashboard-sidebar">
            <div className="landing-dashboard-brand"><span aria-hidden="true">M</span><strong>{t.demoShop}</strong></div>
            <span className="landing-demo-label">{t.dashboardDemo}</span>
            <ul>{t.dashboardNav.map((label, index) => <li key={label} className={index === 2 ? "is-active" : ""}><span aria-hidden="true">{["▦", "↗", "↗"][index]}</span>{label}</li>)}</ul>
            <small>{t.demoNote}</small>
          </aside>
          <div className="landing-dashboard-main">
            <div className="landing-dashboard-top"><strong>{t.dashboardNav[2]}</strong><span className="landing-demo-label">{t.dashboardDemo}</span></div>
            <dl className="landing-metrics">{t.metrics.map((label, index) => <div key={label}><dt>{label}</dt><dd>{["124", "48", "9", t.conversion][index]}</dd></div>)}</dl>
            <div className="landing-dashboard-table-head"><strong>{t.tableTitle}</strong><p>{t.tableBody}</p></div>
            <div className="landing-table-scroll" role="region" tabIndex={0} aria-label={t.tableTitle}>
              <table><caption className="landing-sr-only">{t.tableTitle}</caption>
                <thead><tr>{t.tableHead.map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
                <tbody>{t.tableProducts.map((name, index) => <tr key={name}><th scope="row"><span aria-hidden="true">0{index + 1}</span>{name}</th><td>{[18, 14, 16][index]}</td><td>{[4, 3, 2][index]}</td><td>{t.rates[index]}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </div>
        <a className="landing-text-link landing-management-link" href={merchantAppHref()}>{t.dashboardCta}<span aria-hidden="true">↗</span></a>
      </section>

      <section className="section landing-pricing" id="pricing" aria-labelledby="pricing-heading">
        <div className="landing-section-heading">
          <span className="overline">{t.pricingLabel}</span>
          <h2 id="pricing-heading">{t.pricingTitle}<em>{t.pricingAccent}</em></h2>
          <p>{t.pricingBody}</p>
        </div>
        <div className="landing-offers">
          {t.offers.map(offer => <article className={"landing-offer " + (offer.available ? "is-available" : "is-planned")} key={offer.name}>
            <span className="landing-offer-status"><i aria-hidden="true" />{offer.status}</span>
            <h3>{offer.name}</h3><strong className="landing-offer-price">{offer.price}</strong><p>{offer.body}</p>
            <ul>{offer.features.map(feature => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul>
            <a className={"button " + (offer.available ? "button-primary" : "button-soft")} href={offer.available ? merchantAppHref() : "/contact"}>{offer.cta}<span aria-hidden="true">↗</span></a>
            {!offer.available ? <small>{t.offerNote}</small> : null}
          </article>)}
        </div>
      </section>

      <LandingFAQ language={language} />

      <section className="section landing-launch" id="launch" aria-labelledby="launch-heading">
        <div className="landing-launch-copy"><span className="overline">{t.launchLabel}</span><h2 id="launch-heading">{t.launchTitle}<em>{t.launchAccent}</em></h2><p>{t.launchBody}</p></div>
        <div className="landing-launch-actions"><span className="landing-launch-symbol" aria-hidden="true">✳</span><a href={merchantAppHref()} className="button landing-launch-primary">{t.create}<span aria-hidden="true">↗</span></a><a href="/themes" className="landing-launch-secondary">{t.launchSecondary}<span aria-hidden="true">↗</span></a><small>{t.launchNote}</small></div>
      </section>
    </main>
    <footer className="site-footer landing-footer">
      <div><a className="brand footer-brand" href="#top" aria-label={language === "fr" ? "Accueil Commerce Factory" : "Commerce Factory home"}><img className="brand-logo" src="/commerce-factory-logo-v3.png?v=3" alt="Commerce Factory by Trigenys" width={500} height={159} /></a><p>{t.footerBody}</p></div>
      <nav className="footer-links" aria-label={language === "fr" ? "Liens utiles" : "Useful links"}>{["#how", "#showcase", "/themes", "#pricing", "/help", "/contact", "/privacy", "/terms"].map((href, index) => <a key={href} href={href}>{t.footerLinks[index]}</a>)}</nav>
      <div className="landing-footer-bottom"><span>{t.footerStatus}</span><small>© {new Date().getFullYear()} {t.copyright}</small><a href="#top">{language === "fr" ? "Retour en haut" : "Back to top"}<span aria-hidden="true">↑</span></a></div>
    </footer>
  </div>;
}
