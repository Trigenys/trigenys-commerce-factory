import { useEffect, useId, useRef } from "react";
import type { CommerceAuthClient } from "./auth";
import type { Product, Store, StoreInput } from "./api";
import type { PublicStorefront } from "../storefront/types";
import { themeSampleStorefront } from "../themes/sample-catalog";
import LiveThemePreview from "../themes/LiveThemePreview";
import { useMerchantMedia } from "./use-merchant-media";
import { setupCopy } from "./setup-copy";

// Preview uses the same storefront renderer as published stores. Illustrative
// products exist only in this view; no sample is sent to the merchant API.
export default function OnboardingPreview({ client, input, store, products, productDraft, language, open, onClose }: {
  client: CommerceAuthClient; input: StoreInput; store: Store | null;
  products: Product[]; productDraft: Product | null; language: "fr" | "en";
  open: boolean; onClose: () => void;
}) {
  const t = setupCopy[language], dialog = useRef<HTMLDialogElement>(null), id = useId();
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    else if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  const saved = products.filter(product => product.status !== "archived");
  const actual = productDraft ? [productDraft, ...saved.filter(product => product.id !== productDraft.id)] : saved;
  const example = actual.length === 0;
  const sample = themeSampleStorefront(input.theme, input.themeSettings);
  const shown = example ? sample.products.slice(0, 1) : actual;
  const urls = [store?.logoUrl || "", ...shown.flatMap(product => product.imageUrls)];
  const { sources, failed, retry } = useMerchantMedia(client, store?.id || "", urls);
  const preview: PublicStorefront = {
    store: {
      name: input.name.trim() || (language === "fr" ? "Votre boutique" : "Your store"),
      slug: input.slug || "votre-boutique", description: input.description || null,
      businessLocation: input.businessLocation || null, countryCode: input.countryCode, currencyCode: input.currencyCode,
      whatsappNumber: input.whatsappNumber, theme: input.theme, themeSettings: input.themeSettings,
      logoUrl: store?.logoUrl ? sources[store.logoUrl] || null : null
    },
    products: shown.map(product => ({ ...product, imageUrls: product.imageUrls.flatMap(url => sources[url] ? [sources[url]] : []) }))
  };
  const content = <div className="setup-preview-content">
    <p className="setup-preview-note">{example ? t.example : productDraft ? t.unsavedProduct : t.realPreview} {language === "fr" ? "Commandes désactivées dans l’aperçu." : "Ordering is disabled in the preview."}</p>
    {failed.length > 0 && <p role="status">{language === "fr" ? "Certaines images n’ont pas pu être chargées." : "Some images could not be loaded."} <button type="button" className="setup-text-button" onClick={retry}>{t.retry}</button></p>}
    <LiveThemePreview storefront={preview} language={language} compact />
  </div>;
  return <aside className="setup-preview" aria-label={t.previewTitle}>
    {!open && <div className="setup-preview-desktop">{content}</div>}
    <dialog className="setup-preview-dialog" id={id} ref={dialog} aria-label={t.previewTitle} onClose={onClose}>
      <button className="admin-secondary setup-preview-close" type="button" onClick={() => dialog.current?.close()}>{t.closePreview} <span aria-hidden="true">×</span></button>
      {open && content}
    </dialog>
  </aside>;
}
