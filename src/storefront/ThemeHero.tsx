import { useState } from "react";
import { resolveStoreTheme } from "../../shared/store-themes";
import { formatMoney, type Language, type PublicProduct, type PublicStorefront } from "./types";
import "./themes.css";

function ProductImage({ product, priority = false }: { product: PublicProduct; priority?: boolean }) {
  return product.imageUrls[0]
    ? <img src={product.imageUrls[0]} alt={product.name} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} width="640" height="640" />
    : <span className="theme-image-empty" aria-hidden="true">{product.name.slice(0, 1)}</span>;
}

function FeatureCard({ product, language, href, className, priority = false }: {
  product: PublicProduct; language: Language; href: string; className: string; priority?: boolean;
}) {
  return <a className={className + " theme-feature-card"} href={href}>
    <span className="theme-feature-visual"><ProductImage product={product} priority={priority} /></span>
    <div className="theme-feature-caption">
      {product.category ? <small>{product.category}</small> : null}
      <h2>{product.name}</h2>
      <strong>{formatMoney(product.price, product.currencyCode, language)}</strong>
      {product.stockLabel ? <span className="theme-feature-stock">{product.stockLabel}</span> : null}
      <span className="theme-card-link">{language === "fr" ? "Voir le produit" : "View product"}<span aria-hidden="true">↗</span></span>
    </div>
  </a>;
}

export default function ThemeHero({ storefront, language, productHref }: {
  storefront: PublicStorefront;
  language: Language;
  productHref: (product: PublicProduct) => string;
}) {
  const [active, setActive] = useState(0);
  const { store, products } = storefront;
  const theme = resolveStoreTheme(store.theme, store.themeSettings);
  const activeIndex = Math.min(active, Math.max(0, products.length - 1));
  const product = products[activeIndex];
  const discover = language === "fr" ? "Voir le produit" : "View product";
  const selection = language === "fr" ? "Notre sélection" : "Our selection";
  const shop = language === "fr" ? "Explorer la collection" : "Explore the collection";
  const category = product?.category || selection;
  const introduction = <div className="theme-introduction">
    <span className="theme-kicker">{category}</span>
    <h1>{store.name}</h1>
    {store.description ? <p>{store.description}</p> : null}
    {products.length > 0 ? <a className="theme-cta" href="#catalog">{shop}<span aria-hidden="true">↗</span></a> : null}
    {store.businessLocation ? <small>{store.businessLocation}</small> : null}
  </div>;

  if (!product) {
    return <section className="theme-hero theme-empty-hero">{introduction}</section>;
  }

  if (theme.layout === "spotlight") {
    return <section className="theme-hero theme-spotlight" data-products={products.length} aria-label={selection}>
      <span className="theme-watermark" aria-hidden="true">{theme.name}</span>
      <div className="theme-spotlight-copy">
        <span className="theme-kicker">{store.name} · {category}</span>
        <h1>{product.name}</h1>
        {product.description || store.description ? <p>{product.description || store.description}</p> : null}
        <a className="theme-cta" href={productHref(product)}>{discover}<span aria-hidden="true">↗</span></a>
      </div>
      <a className="theme-spotlight-image" aria-label={product.name} href={productHref(product)}><ProductImage product={product} priority /></a>
      <div className="theme-spotlight-price">
        <small>{selection}</small><strong>{formatMoney(product.price, product.currencyCode, language)}</strong>
        {product.stockLabel ? <span>{product.stockLabel}</span> : null}
        {products.length > 1 ? <div className="theme-product-switcher" aria-label={selection}>
          {products.slice(0, 4).map((item, index) => <button key={item.id} type="button" aria-label={item.name} aria-pressed={activeIndex === index} onClick={() => setActive(index)}>0{index + 1}</button>)}
        </div> : null}
      </div>
    </section>;
  }

  if (theme.layout === "panels") {
    return <section className="theme-hero theme-panels" data-products={products.length}>
      <div className="theme-panel-heading"><span className="theme-kicker">{category}</span><h1>{store.name}</h1>{store.description ? <p>{store.description}</p> : null}</div>
      <div className="theme-panel-grid">{products.slice(0, 4).map((item, index) => <a className="theme-panel" key={item.id} href={productHref(item)}>
        <ProductImage product={item} priority={index === 0} /><span className="theme-panel-number" aria-hidden="true">0{index + 1}</span>
        <div><small>{item.category || selection}</small><h2>{item.name}</h2><strong>{formatMoney(item.price, item.currencyCode, language)}</strong>{item.stockLabel ? <span className="theme-feature-stock">{item.stockLabel}</span> : null}<span className="theme-panel-arrow" aria-hidden="true">↗</span></div>
      </a>)}</div>
    </section>;
  }

  if (theme.layout === "lookbook") {
    return <section className="theme-hero theme-lookbook" data-products={products.length}>
      {introduction}
      <div className="theme-lookbook-grid">{products.slice(0, 3).map((item, index) => <FeatureCard key={item.id} className="theme-lookbook-card" product={item} language={language} href={productHref(item)} priority={index === 0} />)}</div>
    </section>;
  }

  if (theme.layout === "menu") {
    return <section className="theme-hero theme-menu-hero" data-products={products.length}>
      {introduction}<a href={productHref(product)} className="theme-menu-feature"><ProductImage product={product} priority /><div><small>{product.category || selection}</small><h2>{product.name}</h2><strong>{formatMoney(product.price, product.currencyCode, language)} ↗</strong></div></a>
    </section>;
  }

  if (theme.layout === "catalog") {
    return <section className="theme-hero theme-catalog-hero" data-products={products.length}>{introduction}
      <div className="theme-catalog-picks">{products.slice(0, 3).map((item, index) => <a key={item.id} href={productHref(item)}><ProductImage product={item} priority={index === 0} /><h2>{item.name}</h2><strong>{formatMoney(item.price, item.currencyCode, language)}</strong></a>)}</div>
    </section>;
  }

  return <section className="theme-hero theme-editorial" data-products={products.length}>{introduction}
    <FeatureCard className="theme-editorial-image" product={product} language={language} href={productHref(product)} priority />
  </section>;
}
