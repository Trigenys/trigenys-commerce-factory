import { useEffect, useMemo, useState } from "react";
import { apiBaseUrl } from "../admin/runtime";
import "./storefront.css";

type Language = "fr" | "en";

type Variant = {
  name: string;
  value: string;
};

type PublicProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  currencyCode: string;
  category: string | null;
  stockLabel: string | null;
  imageUrls: string[];
  variants: Variant[];
};

type PublicStorefront = {
  store: {
    name: string;
    slug: string;
    whatsappNumber: string;
    countryCode: string;
    currencyCode: string;
    description: string | null;
    businessLocation: string | null;
    theme: "clean";
    logoUrl: string | null;
  };
  products: PublicProduct[];
};

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
    browse: "Découvrir les produits"
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
    browse: "Browse products"
  }
} as const;

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

function formatMoney(
  value: string,
  currency: string,
  language: Language
): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value + " " + currency;
  const noDecimals = currency === "XAF" || currency === "XOF";
  return new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: noDecimals ? 0 : 2,
    maximumFractionDigits: noDecimals ? 0 : 2
  }).format(amount);
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

function whatsappHref(
  storefront: PublicStorefront,
  product: PublicProduct,
  language: Language
): string {
  const phone = storefront.store.whatsappNumber.replace(/\D/g, "");
  const price = formatMoney(product.price, product.currencyCode, language);
  const message = language === "fr"
    ? `Bonjour, je suis intéressé(e) par ${product.name} — ${price}. ${window.location.href}`
    : `Hello, I'm interested in ${product.name} — ${price}. ${window.location.href}`;
  return "https://wa.me/" + phone + "?text=" + encodeURIComponent(message);
}

function StoreHeader({ storefront }: { storefront: PublicStorefront }) {
  const initials = storefront.store.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <header className="public-store-header">
      <a className="public-store-brand" href={"/store/" + storefront.store.slug}>
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
  storefront,
  product,
  language
}: {
  storefront: PublicStorefront;
  product: PublicProduct;
  language: Language;
}) {
  return (
    <article className="public-product-card">
      <a
        className="public-product-image"
        href={"/store/" + storefront.store.slug + "/p/" + product.slug}
      >
        {product.imageUrls[0] ? (
          <img src={product.imageUrls[0]} alt={product.name} loading="lazy" />
        ) : (
          <span>CF</span>
        )}
      </a>
      <div className="public-product-copy">
        {product.category ? <small>{product.category}</small> : null}
        <a href={"/store/" + storefront.store.slug + "/p/" + product.slug}>
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
  language
}: {
  storefront: PublicStorefront;
  product: PublicProduct;
  language: Language;
}) {
  const t = copy[language];
  const [selectedImage, setSelectedImage] = useState(product.imageUrls[0] || "");

  return (
    <main className="product-detail-page">
      <a className="public-back" href={"/store/" + storefront.store.slug}>
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

          {product.variants.length ? (
            <div className="product-variants">
              <strong>{t.variants}</strong>
              <div>
                {product.variants.map((variant, index) => (
                  <span key={variant.name + variant.value + index}>
                    {variant.name}: {variant.value}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <a
            className="public-wa-button"
            href={whatsappHref(storefront, product, language)}
            target="_blank"
            rel="noreferrer"
          >
            WA · {t.buy}
          </a>

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
  const [category, setCategory] = useState<string | null>(null);

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

  useEffect(() => {
    if (!storefront) return;
    if (route?.productSlug && !product) {
      document.title = t.productNotFound + " — Commerce Factory";
      setMeta('meta[name="robots"]', "name", "noindex,nofollow");
      return;
    }
    applyMetadata(storefront, product);
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

  if (route.productSlug) {
    if (!product) {
      return (
        <div className="public-store-shell">
          <StoreHeader storefront={storefront} />
          <main className="public-state">
            <h1>404</h1>
            <p>{t.productNotFound}</p>
            <a href={"/store/" + storefront.store.slug}>← {t.back}</a>
          </main>
        </div>
      );
    }

    return (
      <div className="public-store-shell">
        <StoreHeader storefront={storefront} />
        <ProductDetail
          storefront={storefront}
          product={product}
          language={language}
        />
        <footer className="public-store-footer">{t.powered}</footer>
      </div>
    );
  }

  return (
    <div className="public-store-shell">
      <StoreHeader storefront={storefront} />

      <main>
        <section className="public-store-hero">
          <div>
            <span className="public-overline">{t.browse}</span>
            <h1>{storefront.store.name}</h1>
            {storefront.store.description ? (
              <p>{storefront.store.description}</p>
            ) : null}
            {storefront.store.businessLocation ? (
              <small>{storefront.store.businessLocation}</small>
            ) : null}
          </div>
        </section>

        <section className="public-catalog-section">
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
                  storefront={storefront}
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
