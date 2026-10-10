import { useState } from "react";
import { StorefrontView } from "../storefront/StorefrontApp";
import type { PublicStorefront, Language } from "../storefront/types";

export default function LiveThemePreview({ storefront, language }: { storefront: PublicStorefront; language: Language }) {
  const [mobile, setMobile] = useState(true);
  const [productSlug, setProductSlug] = useState<string | null>(null);
  return <section className="theme-live-preview" aria-label={language === "fr" ? "Aperçu de votre boutique" : "Your storefront preview"}>
    <header><h2>{language === "fr" ? "Votre boutique en direct" : "Your live storefront preview"}</h2><button type="button" aria-pressed={mobile} onClick={() => setMobile(!mobile)}>{mobile ? (language === "fr" ? "Voir sur ordinateur" : "Desktop view") : (language === "fr" ? "Voir sur mobile" : "Mobile view")}</button></header>
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
      <StorefrontView storefront={storefront} language={language} productSlug={productSlug} homeHref="#preview-home" productHref={(product) => "#preview-product=" + product.slug} preview />
    </div>
    <p className="theme-selected-description">{language === "fr" ? "L’aperçu utilise les produits actifs de votre catalogue. Enregistrez les paramètres pour appliquer ce style à la boutique." : "This preview uses your active catalog products. Save settings to apply this style to your storefront."}</p>
  </section>;
}
