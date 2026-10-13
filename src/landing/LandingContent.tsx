import { useLayoutEffect, type RefObject } from "react";
import { storeThemeIds } from "../../shared/store-themes";
import CommerceJourney from "../components/CommerceJourney";
import LandingFAQ from "./LandingFAQ";
import { landingCopy, type LandingLanguage } from "./content";
import ShowcaseCarousel from "./ShowcaseCarousel";
import { useLandingMotion } from "./useLandingMotion";
import { merchantAppHref } from "../merchant-navigation";
import "./landing.css";
import "./motion.css";

export default function LandingContent({ language, shellRef }: {
  language: LandingLanguage; shellRef: RefObject<HTMLDivElement | null>;
}) {
  useLandingMotion(shellRef);
  const t = landingCopy[language];
  useLayoutEffect(() => {
    // A direct anchor waits for the deferred sections and their final scroll geometry.
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: "instant" });
  }, []);
  return <>
      <section className="section landing-how" id="how" aria-labelledby="how-heading">
        <div className="landing-section-heading" data-reveal>
          <span className="overline">{t.howLabel}</span>
          <h2 id="how-heading">{t.howTitle}<em>{t.howAccent}</em></h2>
          <p>{t.howBody}</p>
        </div>
        <ol className="landing-steps">
          {t.steps.map(([number, title, body], index) => <li key={number} data-reveal style={{ transitionDelay: index * 60 + "ms" }}>
            <span className="landing-step-number" aria-hidden="true">{number}</span>
            <h3>{title}</h3><p>{body}</p>
          </li>)}
        </ol>
      </section>

      <section className="section landing-showcase" id="showcase" aria-labelledby="showcase-heading">
        <div className="landing-section-heading" data-reveal>
          <span className="overline">{t.showcaseLabel}</span>
          <h2 id="showcase-heading">{t.showcaseTitle}<em>{t.showcaseAccent}</em></h2>
          <p>{t.showcaseBody}</p>
        </div>
        <ShowcaseCarousel language={language} />
        <p className="landing-disclaimer">{t.disclaimer}</p>
        <div className="landing-theme-invitation" data-reveal>
          <div><span className="landing-theme-count">{storeThemeIds.length}<small>{t.themesLabel}</small></span></div>
          <div className="landing-theme-copy"><h3>{t.themesTitle}<em>{t.themesAccent}</em></h3><p>{t.themesBody}</p>
            <ul className="landing-sector-list">{t.themeSectors.map(sector => <li key={sector}>{sector}</li>)}</ul>
            <a href="/themes" className="landing-text-link">{t.themesCta}<span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </section>

      <CommerceJourney language={language} />

      <section className="section landing-management" id="dashboard" aria-labelledby="dashboard-heading">
        <div className="landing-section-heading" data-reveal>
          <span className="overline">{t.dashboardLabel}</span>
          <h2 id="dashboard-heading">{t.dashboardTitle}<em>{t.dashboardAccent}</em></h2>
          <p>{t.dashboardBody}</p>
        </div>
        <div className="landing-management-points">{t.management.map(([title, body], index) => <div key={title}><span aria-hidden="true">0{index + 1}</span><strong>{title}</strong><p>{body}</p></div>)}</div>
        <div className="landing-dashboard" data-reveal>
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
        <div className="landing-section-heading" data-reveal>
          <span className="overline">{t.pricingLabel}</span>
          <h2 id="pricing-heading">{t.pricingTitle}<em>{t.pricingAccent}</em></h2>
          <p>{t.pricingBody}</p>
        </div>
        <div className="landing-offers">
          {t.offers.map(offer => <article className={"landing-offer " + (offer.available ? "is-available" : "is-planned")} key={offer.name} data-reveal>
            <span className="landing-offer-status"><i aria-hidden="true" />{offer.status}</span>
            <h3>{offer.name}</h3><strong className="landing-offer-price">{offer.price}</strong><p>{offer.body}</p>
            <ul>{offer.features.map(feature => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul>
            <a className={"button " + (offer.available ? "button-primary" : "button-soft")} href={offer.available ? merchantAppHref() : "/contact"}>{offer.cta}<span aria-hidden="true">↗</span></a>
            {!offer.available ? <small>{t.offerNote}</small> : null}
          </article>)}
        </div>
        <div className="landing-pricing-clarity" data-reveal>{t.billingFacts.map(([title, body]) => <div key={title}><strong>{title}</strong><p>{body}</p></div>)}</div>
      </section>

      <LandingFAQ language={language} />

      <section className="section landing-launch" id="launch" aria-labelledby="launch-heading" data-parallax-anchor>
        <div className="landing-launch-copy"><span className="overline">{t.launchLabel}</span><h2 id="launch-heading">{t.launchTitle}<em>{t.launchAccent}</em></h2><p>{t.launchBody}</p></div>
        <div className="landing-launch-actions"><span className="landing-launch-symbol" aria-hidden="true" data-parallax="28">✳</span><a href={merchantAppHref()} className="button landing-launch-primary">{t.create}<span aria-hidden="true">↗</span></a><a href="/themes" className="landing-launch-secondary">{t.launchSecondary}<span aria-hidden="true">↗</span></a><small>{t.launchNote}</small></div>
      </section>
  </>;
}
