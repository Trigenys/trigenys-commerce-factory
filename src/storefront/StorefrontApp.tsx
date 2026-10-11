import { useEffect, useMemo, useState } from "react";
import { apiBaseUrl } from "../admin/runtime";
import "./storefront.css";

import { formatMoney, type Language, type PublicProduct, type PublicStorefront } from "./types";
import { themeShellProps } from "./theme-style";
import ThemeHero from "./ThemeHero";
import { useStoreCart, type StoreCart } from "./cart";
import CartCheckout from "./CartCheckout";
import { timedFetch } from "../lib/requests";
import { preferredLanguage, rememberLanguage } from "../lib/language";
import RecoveryState from "../components/RecoveryState";

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

export function parseStoreRoute(pathname = window.location.pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "store" || !parts[1]) return null;
  if (!(parts.length === 2 || (parts.length === 3 && parts[2] === "cart") || (parts.length === 4 && parts[2] === "p"))) return null;
  try {
    return { storeSlug: decodeURIComponent(parts[1]), productSlug: parts[2] === "p" ? decodeURIComponent(parts[3]) : null, cart: parts[2] === "cart" };
  } catch { return null; }
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
  const pageUrl = window.location.origin + window.location.pathname;
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

function StoreHeader({ storefront, homeHref, language, cart, preview }: { storefront: PublicStorefront; homeHref: string; language:Language; cart:StoreCart; preview:boolean }) {
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
      <div className="store-header-actions"><span className="public-currency">{storefront.store.currencyCode}</span>
        {!preview && <a className="store-cart-link" href={homeHref + "/cart"}>{language === "fr" ? "Panier" : "Cart"} ({cart.lines.reduce((n,l)=>n+l.quantity,0)})</a>}
        {!preview && <div className="store-language" role="group" aria-label={language === "fr" ? "Langue" : "Language"}>{(["fr","en"] as const).map(value=><button key={value} type="button" aria-pressed={value===language} onClick={()=>{rememberLanguage(value);window.location.reload();}}>{value.toUpperCase()}</button>)}</div>}
      </div>
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
  preview = false,
  cart
}: {
  storefront: PublicStorefront;
  product: PublicProduct;
  language: Language;
  homeHref: string;
  preview?: boolean;
  cart:StoreCart;
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
  const [cartMessage, setCartMessage] = useState("");
  const [quantity, setQuantity] = useState(1);
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
      const response = await timedFetch(
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

  const Content=preview ? "div" : "main";
  return (
    <Content className="product-detail-page" id={preview ? undefined : "store-main"} tabIndex={-1}>
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

          {!preview && <div className="product-cart-actions"><label>{language === "fr" ? "Quantité" : "Quantity"}<input type="number" min={1} max={99} value={quantity} onChange={e=>setQuantity(Math.max(1,Math.min(99,Number(e.target.value)||1)))} /></label><button type="button" className="cart-primary" onClick={()=>{
            const added=cart.add({productId:product.id,quantity,variants:selectedVariants});
            setCartMessage(added ? (language === "fr" ? "Ajouté à votre panier." : "Added to your cart.") : (language === "fr" ? "Votre panier contient déjà 50 choix. Retirez un article pour continuer." : "Your cart already contains 50 choices. Remove an item to continue."));
          }}>{language === "fr" ? "Ajouter au panier" : "Add to cart"}</button></div>}
          {cartMessage && <p role="status">{cartMessage} <a href={homeHref+"/cart"}>{language === "fr" ? "Voir le panier" : "View cart"}</a></p>}
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
                await navigator.clipboard?.writeText(window.location.href).then(()=>setCartMessage(language === "fr" ? "Lien copié." : "Link copied.")).catch(()=>setCartMessage(language === "fr" ? "Copiez le lien dans la barre d’adresse." : "Copy the link from the address bar."));
              }
            }}
          >
            {t.share}
          </button>
        </section>
      </div>
    </Content>
  );
}

export default function StorefrontApp() {
  const route = parseStoreRoute();
  const language = preferredLanguage();
  const t = copy[language];
  const [storefront, setStorefront] = useState<PublicStorefront | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!route || !apiBaseUrl) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);setFailed(false);setNotFound(false);
    (async () => {
      try {
        const response = await timedFetch(
          apiBaseUrl + "/v1/public/stores/" + encodeURIComponent(route.storeSlug),
          { headers: { Accept: "application/json" } }
        );
        if (!response.ok) {
          if (!cancelled) { if(response.status === 404) setNotFound(true); else setFailed(true); }
          return;
        }
        const body = await response.json() as PublicStorefront;
        if (!cancelled) setStorefront(body);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [attempt]);

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
    document.documentElement.lang=language;
    if(route?.cart) {document.title=(language === "fr" ? "Panier" : "Cart")+" — "+storefront.store.name;setMeta('meta[name="robots"]',"name","noindex,nofollow");return;}

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

  if (failed) return <RecoveryState language={language} title={language === "fr" ? "La boutique attend votre retour" : "Let’s reconnect to the store"} message={language === "fr" ? "Le chargement a été interrompu. Réessayez pour retrouver le catalogue." : "Loading was interrupted. Retry to return to the catalog."} retry={()=>setAttempt(v=>v+1)} />;

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

  return <StorefrontView storefront={storefront} language={language} productSlug={route.productSlug} cartPage={route.cart} />;
}

export function StorefrontView({ storefront, language, productSlug = null, homeHref = "/store/" + storefront.store.slug, productHref = (item) => "/store/" + storefront.store.slug + "/p/" + item.slug, preview = false, cartPage = false }: {
  storefront: PublicStorefront;
  language: Language;
  productSlug?: string | null;
  homeHref?: string;
  productHref?: (product: PublicProduct) => string;
  preview?: boolean;
  cartPage?: boolean;
}) {
  const Content=preview ? "div" : "main";
  const t = copy[language];
  const cart = useStoreCart(storefront.store.slug,!preview);
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

  const footer = <footer className="public-store-footer"><span>{t.powered}</span><nav aria-label={language === "fr" ? "Aide et informations" : "Help and information"}><a href="/help">{language === "fr" ? "Aide" : "Help"}</a><a href="/contact">Contact</a><a href="/privacy">{language === "fr" ? "Confidentialité" : "Privacy"}</a><a href="/terms">{language === "fr" ? "Conditions" : "Terms"}</a></nav></footer>;
  const skip = !preview && <a className="skip-link" href="#store-main">{language === "fr" ? "Aller au contenu" : "Skip to content"}</a>;
  if (cartPage && !preview) return <div {...themeShellProps(storefront.store)}>{skip}<StoreHeader storefront={storefront} homeHref={homeHref} language={language} cart={cart} preview={preview} /><Content id={preview ? undefined : "store-main"} tabIndex={-1}><CartCheckout storefront={storefront} language={language} cart={cart} /></Content>{footer}</div>;
  if (productSlug) {
    if (!product) {
      return (
        <div {...themeShellProps(storefront.store)}>
        {skip}
          <StoreHeader storefront={storefront} homeHref={homeHref} language={language} cart={cart} preview={preview} />
          <Content className="public-state">
            <h1>404</h1>
            <p>{t.productNotFound}</p>
            <a href={homeHref}>← {t.back}</a>
          </Content>
        </div>
      );
    }

    return (
      <div {...themeShellProps(storefront.store)}>
        {skip}
        <StoreHeader storefront={storefront} homeHref={homeHref} language={language} cart={cart} preview={preview} />
        <ProductDetail
          key={product.id}
          storefront={storefront}
          product={product}
          language={language}
          homeHref={homeHref}
          preview={preview}
          cart={cart}
        />
        {footer}
      </div>
    );
  }

  return (
    <div {...themeShellProps(storefront.store)}>
        {skip}
      <StoreHeader storefront={storefront} homeHref={homeHref} language={language} cart={cart} preview={preview} />

      <Content id={preview ? undefined : "store-main"} tabIndex={-1}>
        <ThemeHero storefront={storefront} language={language} productHref={productHref} />

        <section className="public-catalog-section" id="catalog">
          <div className="public-catalog-heading">
            <h2>{t.products}</h2>
            {categories.length ? (
              <div className="public-category-filter" aria-label={t.products}>
                <button
                  type="button"
                  className={category === null ? "active" : ""}
                  aria-pressed={category === null}
                  onClick={() => setCategory(null)}
                >
                  {t.all}
                </button>
                {categories.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={category === item ? "active" : ""}
                    aria-pressed={category === item}
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
      </Content>

      {footer}
    </div>
  );
}
