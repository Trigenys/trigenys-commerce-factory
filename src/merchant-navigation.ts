const pagesDomain = "trigenys-commerce-factory.pages.dev";

export const productionMerchantAppUrl = "https://" + pagesDomain + "/app";

// PR previews share the public gallery, but merchant authentication and
// production API access belong to the canonical, trusted application origin.
export function merchantAppHref(hostname = window.location.hostname): string {
  return hostname.endsWith("." + pagesDomain)
    ? productionMerchantAppUrl
    : "/app";
}
