import { useEffect, useMemo, useState } from "react";
import { apiBaseUrl } from "../admin/runtime";
import "./storefront.css";

import { formatMoney, type Language, type PublicProduct, type PublicStorefront } from "./types";
import { themeShellProps } from "./theme-style";
import ThemeHero from "./ThemeHero";

const copy = {
  fr: {
    back: "Retour à la boutique",
    products: "Produits",
    all: "Tout",
    buy: "Acheter sur WhatsApp",
    noProducts: "Aucun produit disponible pour le moment.",
    notFound: "Cette boutique n’est pas disponible.",
    productNotFound: "Ce produit n’est pas disponible.",
    loading: "Chargement de la boutique…",
    variants: "Variantes",
    stock: "Disponibilité",
    share: "Partager",
    powered: "Propulsé par Commerce Factory",
    browse: "Découvrir les produits",
    handoffError: "Impossible d’ouvrir WhatsApp pour le moment. Réessayez.",
    openingWhatsApp: "Ouverture de WhatsApp…"
  },
  en: {
    back: "Back to store",
    products: "Products",
    all: "All",
    buy: "Buy on WhatsApp",
    noProducts: "No products are available right now.",
    notFound: "This store is not available.",
    productNotFound: "This product is not available.",
    loading: "Loading store…",
    variants: "Variants",
    stock: "Availability",
    share: "Share",
    powered: "Powered by Commerce Factory",
    browse: "Browse products",
    handoffError: "Unable to open WhatsApp right now. Try again.",
    openingWhatsApp: "Opening WhatsApp…"
  }
} as const;

const capturedPageEvents = new Set<string>();

function capturePageEvent(
  eventName: "store_view" | "product_view",
  storeSlug: string,
  productSlug: string | null
) {
  if (!apiBaseUrl) return;
  const key = [eventName, storeSlug, productSlug || ""].join(":");
  if (capturedPageEvents.has(key)) return;

  try {
    if (window.sessionStorage.getItem("cf:event:" + key)) return;
    window.sessionStorage.setItem("cf:event:" + key, "1");
  } catch {
    // Session storage can be unavailable in strict privacy contexts.
  }
  capturedPageEvents.add(key);

  void fetch(apiBaseUrl + "/v1/public/events", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      eventId: crypto.randomUUID(),
      eventName,
      storeSlug,
      productSlug
    }),
    keepalive: true
  }).catch(() => undefined);
}

function currentLanguage(): Language {
  return navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
}

function parseRoute() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts[0] !== "store" || !parts[1]) return null;
  return {
    storeSlug: decodeURIComponent(parts[1]),
    productSlug:
      parts[2] === "p" && parts[3] ? decodeURIComponent(parts[3]) : null
  };
}

function setMeta(
  selector: string,
  attribute: "name" | "property",
  value: string
) {
  let meta = document.head.querySelector<HTMLMetaElement>(selector);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attribute, selector.includes("property=")
      ? selector.match(/property="([^"]+)"/)?.[1] || ""
      : selector.match(/name="([^"]+)"/)?.[1] || "");
    document.head.appendChild(meta);
  }
  meta.content = value;
}

function setCanonical(url: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = url;
}

function applyMetadata(
  storefront: PublicStorefront,
  product: PublicProduct | null
) {
  const title = product
    ? product.name + " — " + storefront.store.name
    : storefront.store.name + " — Commerce Factory";
  const description =
    product?.description ||
    storefront.store.description ||
    "Boutique en ligne " + storefront.store.name;
  const pageUrl = window.location.href;
  const image =
    product?.imageUrls[0] ||
    storefront.store.logoUrl ||
    "";

  document.title = title;
  setMeta('meta[name="description"]', "name", description);
  setMeta('meta[property="og:title"]', "property", title);
  setMeta('meta[property="og:description"]', "property", description);
  setMeta('meta[property="og:type"]', "property", product ? "product" : "website");
  setMeta('meta[property="og:url"]', "property", pageUrl);
  setMeta('meta[name="twitter:card"]', "name", image ? "summary_large_image" : "summary");
  setMeta('meta[name="twitter:title"]', "name", title);
  setMeta('meta[name="twitter:description"]', "name", description);
  if (image) {
    setMeta('meta[property="og:image"]', "property", image);
    setMeta('meta[name="twitter:image"]', "name", image);
  }
  setMeta('meta[name="robots"]', "name", "index,follow");
  setCanonical(pageUrl);
}

function StoreHeader({ storefront, homeHref }: { storefront: PublicStorefront; homeHref: string }) {
  const initials = storefront.store.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <header className="public-store-header">
      <a className="public-store-brand" href={homeHref}>
        {storefront.store.logoUrl ? (
          <img src={storefront.store.logoUrl} alt="" />
        ) : (
          <span>{initials || "CF"}</span>
        )}
        <div>
          <strong>{storefront.store.name}</strong>
          {storefront.store.businessLocation ? (
            <small>{storefront.store.businessLocation}</small>
          ) : null}
        </div>
      </a>
      <span className="public-currency">{storefront.store.currencyCode}</span>
    </header>
  );
}

function ProductCard({
  product,
  language,
  href
}: {
  product: PublicProduct;
  language: Language;
  href: string;
}) {
  return (
    <article className="public-product-card">
      <a
        className="public-product-image"
        href={href}
      >
        {product.imageUrls[0] ? (
          <img src={product.imageUrls[0]} alt={product.name} loading="lazy" />
        ) : (
          <span>CF</span>
        )}
      </a>
      <div className="public-product-copy">
        {product.category ? <small>{product.category}</small> : null}
        <a href={href}>
          <h3>{product.name}</h3>
        </a>
        <strong>{formatMoney(product.price, product.currencyCode, language)}</strong>
        {product.stockLabel ? <p>{product.stockLabel}</p> : null}
      </div>
    </article>
  );
}

function ProductDetail({
  storefront,
  product,
  language,
  homeHref,
  preview = false
}: {
  storefront: PublicStorefront;
  product: PublicProduct;
  language: Language;
  homeHref: string;
  preview?: boolean;
}) {
  const t = copy[language];
  const [selectedImage, setSelectedImage] = useState(product.imageUrls[0] || "");
  const variantGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const variant of product.variants) {
      const values = groups.get(variant.name) || [];
      if (!values.includes(variant.value)) values.push(variant.value);
      groups.set(variant.name, values);
    }
    return [...groups.entries()].map(([name, values]) => ({ name, values }));
  }, [product.variants]);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(
    () => Object.fromEntries(
      variantGroups.map((group) => [group.name, group.values[0] || ""])
    )
  );
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);

  async function openWhatsApp() {
    if (handoffBusy || preview) return;
    setHandoffBusy(true);
    setHandoffError(null);

    const variants = variantGroups.map((group) => ({
      name: group.name,
      value: selectedVariants[group.name] || group.values[0] || ""
    }));

    try {
      const response = await fetch(
        apiBaseUrl +
          "/v1/public/stores/" + encodeURIComponent(storefront.store.slug) +
          "/products/" + encodeURIComponent(product.slug) +
          "/whatsapp",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            eventId: crypto.randomUUID(),
            language,
            variants
          }),
          keepalive: true
        }
      );
      if (!response.ok) throw new Error("handoff failed");
      const body = await response.json() as {
        href?: unknown;
        eventName?: unknown;
      };
      if (
        typeof body.href !== "string" ||
        !body.href.startsWith("https://wa.me/") ||
        body.eventName !== "whatsapp_order_click"
      ) {
        throw new Error("invalid handoff");
      }
      window.location.assign(body.href);
    } catch {
      setHandoffError(t.handoffError);
      setHandoffBusy(false);
    }
  }

  return (
    <main className="product-detail-page">
      <a className="public-back" href={homeHref}>
        ← {t.back}
      </a>

      <div className="product-detail-grid">
        <section className="product-gallery" aria-label={product.name}>
          <div className="product-gallery-main">
            {selectedImage ? (
              <img src={selectedImage} alt={product.name} />
            ) : (
              <span>CF</span>
            )}
          </div>
          {product.imageUrls.length > 1 ? (
            <div className="product-gallery-thumbs">
              {product.imageUrls.map((url, index) => (
                <button
                  type="button"
                  key={url}
                  className={url === selectedImage ? "active" : ""}
                  onClick={() => setSelectedImage(url)}
                  aria-pressed={url === selectedImage}
                  aria-label={product.name + " " + (index + 1)}
                >
                  <img src={url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="product-detail-copy">
          {product.category ? <span className="public-overline">{product.category}</span> : null}
          <h1>{product.name}</h1>
          <strong className="product-detail-price">
            {formatMoney(product.price, product.currencyCode, language)}
          </strong>
          {product.stockLabel ? (
            <p className="product-stock"><b>{t.stock}:</b> {product.stockLabel}</p>
          ) : null}
          {product.description ? <p className="product-description">{product.description}</p> : null}

          {variantGroups.length ? (
            <div className="product-variants">
              <strong>{t.variants}</strong>
              {variantGroups.map((group) => (
                <div className="product-variant-group" key={group.name}>
                  <small>{group.name}</small>
                  <div>
                    {group.values.map((value) => (
                      <button
                        type="button"
                        key={value}
                        className={
                          selectedVariants[group.name] === value ? "active" : ""
                        }
                        onClick={() =>
                          setSelectedVariants({
                            ...selectedVariants,
                            [group.name]: value
                          })
                        }
                        aria-pressed={selectedVariants[group.name] === value}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {handoffError ? (
            <p className="public-handoff-error" role="alert">{handoffError}</p>
          ) : null}

          <button
            type="button"
            className="public-wa-button"
            onClick={openWhatsApp}
            disabled={handoffBusy || preview}
          >
            {preview ? (language === "fr" ? "Aperçu · commandes désactivées" : "Preview · ordering disabled") : "WA · " + (handoffBusy ? t.openingWhatsApp : t.buy)}
          </button>

          <button
            type="button"
            className="public-share-button"
            onClick={async () => {
              if (navigator.share) {
                await navigator.share({
                  title: product.name,
                  text: product.description || product.name,
                  url: window.location.href
                }).catch(() => undefined);
              } else {
                await navigator.clipboard?.writeText(window.location.href);
              }
            }}
          >
            {t.share}
          </button>
        </section>
      </div>
    </main>
  );
}

export default function StorefrontApp() {
  const route = parseRoute();
  const language = currentLanguage();
  const t = copy[language];
  const [storefront, setStorefront] = useState<PublicStorefront | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!route || !apiBaseUrl) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          apiBaseUrl + "/v1/public/stores/" + encodeURIComponent(route.storeSlug),
          { headers: { Accept: "application/json" } }
        );
        if (!response.ok) {
          if (!cancelled) setNotFound(true);
          return;
        }
        const body = await response.json() as PublicStorefront;
        if (!cancelled) setStorefront(body);
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const product = useMemo(() => {
    if (!storefront || !route?.productSlug) return null;
    return storefront.products.find(
      (candidate) => candidate.slug === route.productSlug
    ) || null;
  }, [storefront, route?.productSlug]);

  useEffect(() => {
    if (!storefront) return;
    if (route?.productSlug && !product) {
      document.title = t.productNotFound + " — Commerce Factory";
      setMeta('meta[name="robots"]', "name", "noindex,nofollow");
      return;
    }
    applyMetadata(storefront, product);

    if (route?.productSlug && product) {
      capturePageEvent("product_view", storefront.store.slug, product.slug);
    } else if (!route?.productSlug) {
      capturePageEvent("store_view", storefront.store.slug, null);
    }
  }, [storefront, product, route?.productSlug, language]);

  if (loading) {
    return (
      <div className="public-store-shell">
        <main className="public-state">
          <span className="public-spinner" />
          <p>{t.loading}</p>
        </main>
      </div>
    );
  }

  if (notFound || !storefront || !route) {
    return (
      <div className="public-store-shell">
        <main className="public-state">
          <h1>404</h1>
          <p>{t.notFound}</p>
          <a href="/">{t.back}</a>
        </main>
      </div>
    );
  }

  return <StorefrontView storefront={storefront} language={language} productSlug={route.productSlug} />;
}

export function StorefrontView({ storefront, language, productSlug = null, homeHref = "/store/" + storefront.store.slug, productHref = (item) => "/store/" + storefront.store.slug + "/p/" + item.slug, preview = false }: {
  storefront: PublicStorefront;
  language: Language;
  productSlug?: string | null;
  homeHref?: string;
  productHref?: (product: PublicProduct) => string;
  preview?: boolean;
}) {
  const t = copy[language];
  const [category, setCategory] = useState<string | null>(null);
  const product = storefront.products.find((item) => item.slug === productSlug) ?? null;
  const categories = useMemo(() => {
    if (!storefront) return [];
    return Array.from(new Set(
      storefront.products
        .map((item) => item.category)
        .filter((item): item is string => Boolean(item))
    ));
  }, [storefront]);

  const filteredProducts = useMemo(() => {
    if (!storefront) return [];
    return category
      ? storefront.products.filter((item) => item.category === category)
      : storefront.products;
  }, [storefront, category]);

  if (productSlug) {
    if (!product) {
      return (
        <div {...themeShellProps(storefront.store)}>
          <StoreHeader storefront={storefront} homeHref={homeHref} />
          <main className="public-state">
            <h1>404</h1>
            <p>{t.productNotFound}</p>
            <a href={homeHref}>← {t.back}</a>
          </main>
        </div>
      );
    }

    return (
      <div {...themeShellProps(storefront.store)}>
        <StoreHeader storefront={storefront} homeHref={homeHref} />
        <ProductDetail
          key={product.id}
          storefront={storefront}
          product={product}
          language={language}
          homeHref={homeHref}
          preview={preview}
        />
        <footer className="public-store-footer">{t.powered}</footer>
      </div>
    );
  }

  return (
    <div {...themeShellProps(storefront.store)}>
      <StoreHeader storefront={storefront} homeHref={homeHref} />

      <main>
        <ThemeHero storefront={storefront} language={language} productHref={productHref} />

        <section className="public-catalog-section" id="catalog">
          <div className="public-catalog-heading">
            <h2>{t.products}</h2>
            {categories.length ? (
              <div className="public-category-filter" aria-label={t.products}>
                <button
                  type="button"
                  className={category === null ? "active" : ""}
                  onClick={() => setCategory(null)}
                >
                  {t.all}
                </button>
                {categories.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={category === item ? "active" : ""}
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {filteredProducts.length ? (
            <div className="public-product-grid">
              {filteredProducts.map((item) => (
                <ProductCard
                  key={item.id}
                  href={productHref(item)}
                  product={item}
                  language={language}
                />
              ))}
            </div>
          ) : (
            <div className="public-empty-catalog">{t.noProducts}</div>
          )}
        </section>
      </main>

      <footer className="public-store-footer">{t.powered}</footer>
    </div>
  );
}
