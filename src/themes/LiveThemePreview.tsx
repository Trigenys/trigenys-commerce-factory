import { useState } from "react";
import { StorefrontView } from "../storefront/StorefrontApp";
import type { PublicStorefront, Language } from "../storefront/types";

export default function LiveThemePreview({ storefront, language }: { storefront: PublicStorefront; language: Language }) {
  const [mobile, setMobile] = useState(true);
  const [productSlug, setProductSlug] = useState<string | null>(null);
  const visibleSlug = storefront.products.some(product => product.slug === productSlug) ? productSlug : null;
  return <section className="theme-live-preview" aria-label={language === "fr" ? "Aperçu de votre boutique" : "Your storefront preview"}>
    <header><h2>{language === "fr" ? "Aperçu de votre boutique" : "Your storefront preview"}</h2><button type="button" aria-pressed={mobile} onClick={() => setMobile(!mobile)}>{mobile ? (language === "fr" ? "Voir sur ordinateur" : "Desktop view") : (language === "fr" ? "Voir sur mobile" : "Mobile view")}</button></header>
    <div className={"theme-preview-frame" + (mobile ? " mobile" : "")} onClickCapture={(event) => {
      const link = (event.target as Element).closest("a");
      if (!link) return;
      const href = link.getAttribute("href") ?? "";
      if (href === "#preview-home" || href.startsWith("#preview-product=")) {
        event.preventDefault();
        setProductSlug(href === "#preview-home" ? null : href.slice("#preview-product=".length));
        event.currentTarget.scrollTop = 0;
      } else if (href === "#catalog") {
        event.preventDefault();
        event.currentTarget.querySelector("#catalog")?.scrollIntoView({ block: "start" });
      }
    }}>
      <StorefrontView storefront={storefront} language={language} productSlug={visibleSlug} homeHref="#preview-home" productHref={(product) => "#preview-product=" + product.slug} preview />
    </div>
    <p className="theme-selected-description">{language === "fr" ? "Enregistrez vos modifications pour appliquer ce style. Vous pouvez ouvrir les fiches dans cet aperçu ; les commandes y sont désactivées." : "Save your changes to apply this style. Product pages work in this preview; ordering is disabled."}</p>
  </section>;
}
