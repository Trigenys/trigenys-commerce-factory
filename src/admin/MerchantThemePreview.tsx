import type { CommerceAuthClient } from "./auth";
import type { PublicStorefront, Language } from "../storefront/types";
import LiveThemePreview from "../themes/LiveThemePreview";
import { useMerchantMedia } from "./use-merchant-media";

export default function MerchantThemePreview({ client, storeId, storefront, language }: {
  client: CommerceAuthClient;
  storeId: string;
  storefront: PublicStorefront;
  language: Language;
}) {
  const urls = [storefront.store.logoUrl || "", ...storefront.products.flatMap(product => product.imageUrls)];
  const { sources, failed, retry } = useMerchantMedia(client, storeId, urls);
  const preview = {
    ...storefront,
    store: { ...storefront.store, logoUrl: storefront.store.logoUrl ? sources[storefront.store.logoUrl] || null : null },
    products: storefront.products.map(product => ({ ...product, imageUrls: product.imageUrls.flatMap(url => sources[url] ? [sources[url]] : []) }))
  };
  return <>
    {failed.length > 0 && <p className="merchant-media-warning" role="status">
      {language === "fr" ? "Certaines images n’ont pas pu être chargées." : "Some images could not be loaded."}{" "}
      <button type="button" className="admin-secondary" onClick={retry}>{language === "fr" ? "Réessayer" : "Retry"}</button>
    </p>}
    <LiveThemePreview storefront={preview} language={language} />
  </>;
}
