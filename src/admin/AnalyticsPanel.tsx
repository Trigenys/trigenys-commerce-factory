import { useEffect, useMemo, useState } from "react";
import type { CommerceAuthClient } from "./auth";
import {
  getStoreAnalytics,
  type Store,
  type StoreAnalytics
} from "./api";
import "./analytics.css";

type Language = "fr" | "en";
type WindowDays = 7 | 30 | 90;

const copy = {
  fr: {
    eyebrow: "Intentions clients",
    title: "Analytique de la boutique",
    body: "Mesurez ce que Commerce Factory peut réellement observer : vues et clics vers WhatsApp.",
    storeViews: "Vues boutique",
    productViews: "Vues produits",
    whatsappClicks: "Clics WhatsApp",
    ctr: "Vue → WhatsApp",
    topProducts: "Produits les plus engageants",
    product: "Produit",
    views: "Vues",
    clicks: "Clics WA",
    rate: "Taux",
    loading: "Chargement des statistiques…",
    error: "Impossible de charger les statistiques. La boutique reste disponible.",
    empty: "Pas encore assez d’activité sur cette période.",
    window: "Période",
    seven: "7 jours",
    thirty: "30 jours",
    ninety: "90 jours",
    intentNote: "Un clic WhatsApp indique une intention ou un lead. Ce n’est pas une vente confirmée.",
    noOrders: "Commerce Factory n’infère jamais un nombre de commandes ou du chiffre d’affaires à partir des clics."
  },
  en: {
    eyebrow: "Customer intent",
    title: "Store analytics",
    body: "Measure what Commerce Factory can actually observe: storefront views and WhatsApp intent.",
    storeViews: "Store views",
    productViews: "Product views",
    whatsappClicks: "WhatsApp clicks",
    ctr: "View → WhatsApp",
    topProducts: "Top product interest",
    product: "Product",
    views: "Views",
    clicks: "WA clicks",
    rate: "Rate",
    loading: "Loading analytics…",
    error: "Unable to load analytics. Your storefront remains available.",
    empty: "Not enough activity in this period yet.",
    window: "Period",
    seven: "7 days",
    thirty: "30 days",
    ninety: "90 days",
    intentNote: "A WhatsApp click is customer intent or a lead. It is not a confirmed sale.",
    noOrders: "Commerce Factory never infers orders or revenue from WhatsApp clicks."
  }
} as const;

function formatInteger(value: number, language: Language): string {
  return new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US", {
    maximumFractionDigits: 0
  }).format(value);
}

function formatRate(value: number, language: Language): string {
  return new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value);
}

export default function AnalyticsPanel({
  client,
  store,
  language
}: {
  client: CommerceAuthClient;
  store: Store;
  language: Language;
}) {
  const t = copy[language];
  const [days, setDays] = useState<WindowDays>(30);
  const [analytics, setAnalytics] = useState<StoreAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void getStoreAnalytics(client, store.id, days)
      .then((result) => {
        if (!cancelled) setAnalytics(result);
      })
      .catch(() => {
        if (!cancelled) setError(t.error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, store.id, days, t.error]);

  const hasActivity = useMemo(() => {
    if (!analytics) return false;
    return (
      analytics.storeViews > 0 ||
      analytics.productViews > 0 ||
      analytics.whatsappClicks > 0
    );
  }, [analytics]);

  return (
    <section className="analytics-panel" aria-labelledby="analytics-title">
      <div className="analytics-heading">
        <div>
          <span className="admin-eyebrow">{t.eyebrow}</span>
          <h2 id="analytics-title">{t.title}</h2>
          <p>{t.body}</p>
        </div>

        <label className="analytics-window">
          <span>{t.window}</span>
          <select
            value={days}
            onChange={(event) =>
              setDays(Number(event.target.value) as WindowDays)
            }
          >
            <option value={7}>{t.seven}</option>
            <option value={30}>{t.thirty}</option>
            <option value={90}>{t.ninety}</option>
          </select>
        </label>
      </div>

      <div className="analytics-intent-note">
        <strong>{t.intentNote}</strong>
        <span>{t.noOrders}</span>
      </div>

      {loading ? (
        <div className="analytics-state">
          <span className="admin-loader" />
          <p>{t.loading}</p>
        </div>
      ) : error ? (
        <div className="analytics-state analytics-error" role="status">
          <p>{error}</p>
        </div>
      ) : analytics ? (
        <>
          <div className="analytics-kpis">
            <article>
              <span>{t.storeViews}</span>
              <strong>{formatInteger(analytics.storeViews, language)}</strong>
            </article>
            <article>
              <span>{t.productViews}</span>
              <strong>{formatInteger(analytics.productViews, language)}</strong>
            </article>
            <article>
              <span>{t.whatsappClicks}</span>
              <strong>{formatInteger(analytics.whatsappClicks, language)}</strong>
            </article>
            <article>
              <span>{t.ctr}</span>
              <strong>{formatRate(analytics.clickThroughRate, language)}</strong>
            </article>
          </div>

          <div className="analytics-products">
            <div className="analytics-products-head">
              <h3>{t.topProducts}</h3>
            </div>

            {!hasActivity || analytics.topProducts.length === 0 ? (
              <div className="analytics-empty">{t.empty}</div>
            ) : (
              <div className="analytics-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t.product}</th>
                      <th>{t.views}</th>
                      <th>{t.clicks}</th>
                      <th>{t.rate}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topProducts.map((product) => (
                      <tr key={product.productId}>
                        <td>{product.name}</td>
                        <td>{formatInteger(product.views, language)}</td>
                        <td>{formatInteger(product.whatsappClicks, language)}</td>
                        <td>{formatRate(product.clickThroughRate, language)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
