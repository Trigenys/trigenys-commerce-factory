import { useState } from "react";
import type { CommerceAuthClient } from "./auth";
import { useMerchantMedia } from "./use-merchant-media";

export default function MerchantImage({ client, storeId, url, language, alt = "" }: {
  client: CommerceAuthClient;
  storeId: string;
  url: string;
  language: "fr" | "en";
  alt?: string;
}) {
  const { sources, failed, retry } = useMerchantMedia(client, storeId, [url]);
  const [brokenSource, setBrokenSource] = useState<string | null>(null);
  const source = sources[url];
  if (failed.includes(url) || (source && brokenSource === source)) {
    return <span className="merchant-media-state" role="status">
      {language === "fr" ? "Aperçu indisponible" : "Preview unavailable"}
      <button type="button" onClick={() => { setBrokenSource(null); retry(); }}>
        {language === "fr" ? "Réessayer" : "Retry"}
      </button>
    </span>;
  }
  if (!source) return <span className="merchant-media-state" role="status">
    {language === "fr" ? "Chargement de l’image…" : "Loading image…"}
  </span>;
  return <img src={source} alt={alt} loading="lazy" onError={() => setBrokenSource(source)} />;
}
