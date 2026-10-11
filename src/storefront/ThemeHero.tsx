import { useState } from "react";
import { resolveStoreTheme, themeSectors } from "../../shared/store-themes";
import { formatMoney, type Language, type PublicProduct, type PublicStorefront } from "./types";
import "./themes.css";

function ProductImage({ product, priority = false }: { product: PublicProduct; priority?: boolean }) {
  return product.imageUrls[0]
    ? <img src={product.imageUrls[0]} alt={product.name} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} width="640" height="640" />
    : <span className="theme-image-empty" aria-hidden="true">{product.name.slice(0, 1)}</span>;
}

export default function ThemeHero({ storefront, language, productHref }: {
  storefront: PublicStorefront;
  language: Language;
  productHref: (product: PublicProduct) => string;
}) {
  const [active, setActive] = useState(0);
  const { store, products } = storefront;
  const theme = resolveStoreTheme(store.theme, store.themeSettings);
  const product = products[Math.min(active, products.length - 1)];
  const discover = language === "fr" ? "Découvrir" : "Discover";
  const selection = language === "fr" ? "Notre sélection" : "Our selection";
  const shop = language === "fr" ? "Explorer la collection" : "Explore the collection";
  const sector = themeSectors[theme.sector][language];
  const introduction = <div className="theme-introduction">
    <span className="theme-kicker">{sector}</span>
    <h1>{store.name}</h1>
    {store.description ? <p>{store.description}</p> : null}
    <a className="theme-cta" href="#catalog">{shop}<span aria-hidden="true">↗</span></a>
    {store.businessLocation ? <small>{store.businessLocation}</small> : null}
  </div>;

  if (theme.id === "clean" || !product) {
    return <section className="public-store-hero"><div>
      <span className="public-overline">{selection}</span><h1>{store.name}</h1>
      {store.description ? <p>{store.description}</p> : null}
      {store.businessLocation ? <small>{store.businessLocation}</small> : null}
    </div></section>;
  }

  if (theme.layout === "spotlight") {
    return <section className="theme-hero theme-spotlight" aria-label={selection}>
      <span className="theme-watermark" aria-hidden="true">{theme.name}</span>
      <div className="theme-spotlight-copy">
        <span className="theme-kicker">{store.name} · {product.category || sector}</span>
        <h1>{product.name}</h1>
        {store.description ? <p>{store.description}</p> : null}
        <a className="theme-cta" href={productHref(product)}>{discover}<span aria-hidden="true">↗</span></a>
      </div>
      <a className="theme-spotlight-image" aria-label={product.name} href={productHref(product)}><ProductImage product={product} priority /></a>
      <div className="theme-spotlight-price">
        <small>{selection}</small><strong>{formatMoney(product.price, product.currencyCode, language)}</strong>
        <span>{product.stockLabel || sector}</span>
        {products.length > 1 ? <div className="theme-product-switcher" aria-label={selection}>
          {products.slice(0, 4).map((item, index) => <button key={item.id} type="button" aria-label={item.name} aria-pressed={active === index} onClick={() => setActive(index)}>0{index + 1}</button>)}
        </div> : null}
      </div>
    </section>;
  }

  if (theme.layout === "panels") {
    return <section className="theme-hero theme-panels">
      <div className="theme-panel-heading"><span className="theme-kicker">{sector}</span><h1>{store.name}</h1>{store.description ? <p>{store.description}</p> : null}</div>
      <div className="theme-panel-grid">{products.slice(0, 4).map((item, index) => <a className="theme-panel" key={item.id} href={productHref(item)}>
        <ProductImage product={item} priority={index === 0} /><span className="theme-panel-number" aria-hidden="true">0{index + 1}</span>
        <div><small>{item.category || selection}</small><h2>{item.name}</h2><strong>{formatMoney(item.price, item.currencyCode, language)}</strong><span className="theme-panel-arrow" aria-hidden="true">↗</span></div>
      </a>)}</div>
    </section>;
  }

  if (theme.layout === "lookbook") {
    return <section className="theme-hero theme-lookbook">
      {introduction}
      <div className="theme-lookbook-grid">{products.slice(0, 3).map((item, index) => <a key={item.id} href={productHref(item)}>
        <ProductImage product={item} priority={index === 0} /><div><h2>{item.name}</h2><span>{formatMoney(item.price, item.currencyCode, language)} ↗</span></div>
      </a>)}</div>
    </section>;
  }

  if (theme.layout === "menu") {
    return <section className="theme-hero theme-menu-hero">
      {introduction}<a href={productHref(product)} className="theme-menu-feature"><ProductImage product={product} priority /><div><small>{product.category || selection}</small><h2>{product.name}</h2><strong>{formatMoney(product.price, product.currencyCode, language)} ↗</strong></div></a>
    </section>;
  }

  if (theme.layout === "catalog") {
    return <section className="theme-hero theme-catalog-hero">{introduction}
      <div className="theme-catalog-picks">{products.slice(0, 3).map((item, index) => <a key={item.id} href={productHref(item)}><ProductImage product={item} priority={index === 0} /><h2>{item.name}</h2><strong>{formatMoney(item.price, item.currencyCode, language)}</strong></a>)}</div>
    </section>;
  }

  return <section className="theme-hero theme-editorial">{introduction}
    <a className="theme-editorial-image" href={productHref(product)}><ProductImage product={product} priority /><div><small>{product.category || selection}</small><h2>{product.name}</h2><span>{formatMoney(product.price, product.currencyCode, language)} ↗</span></div></a>
  </section>;
}
