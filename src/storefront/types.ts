import type { StoreTheme, ThemeSettings } from "../../shared/store-themes";

export type Language = "fr" | "en";
export type PublicProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  currencyCode: string;
  category: string | null;
  stockLabel: string | null;
  imageUrls: string[];
  variants: { name: string; value: string }[];
};

export type PublicStorefront = {
  store: {
    name: string;
    slug: string;
    whatsappNumber: string;
    countryCode: string;
    currencyCode: string;
    description: string | null;
    businessLocation: string | null;
    theme: StoreTheme;
    themeSettings?: ThemeSettings;
    logoUrl: string | null;
  };
  products: PublicProduct[];
};

export function formatMoney(value: string, currency: string, language: Language): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value + " " + currency;
  const decimals = currency === "XAF" || currency === "XOF" ? 0 : 2;
  try {
    return new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US", {
      style: "currency", currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals
    }).format(amount);
  } catch {
    return value + " " + currency;
  }
}
