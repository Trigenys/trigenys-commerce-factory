import type { Store, StoreInput } from "./api";
import { isStoreTheme, parseThemeSettings } from "../../shared/store-themes";

// Shared by guided setup and the existing settings form. Keep their validation
// and slug rules identical so a saved store can move between both experiences.
const copy = {
  fr: { required: "Champ requis.", invalidEmail: "Adresse email invalide.", invalidPhone: "Entrez un numéro WhatsApp camerounais valide ou un numéro international commençant par +.", invalidSlug: "Utilisez au moins 3 caractères avec lettres, chiffres et tirets." },
  en: { required: "Required field.", invalidEmail: "Invalid email address.", invalidPhone: "Enter a valid Cameroon WhatsApp number or an international number starting with +.", invalidSlug: "Use at least 3 characters with letters, numbers and hyphens." }
};

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 63);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "C") + (parts[1]?.[0] || "F");
}

export function emptyInput(email = ""): StoreInput {
  return {
    name: "",
    slug: "",
    whatsappNumber: "",
    countryCode: "CM",
    currencyCode: "XAF",
    description: "",
    businessLocation: "",
    contactEmail: email,
    theme: "clean",
    themeSettings: {}
  };
}

export function validStoreDraft(value: unknown): value is StoreInput {
  if (!value || typeof value !== "object") return false;
  const input = value as StoreInput;
  return [input.name, input.slug, input.whatsappNumber, input.countryCode, input.currencyCode, input.description, input.businessLocation, input.contactEmail].every(field => typeof field === "string" && field.length <= 280) && isStoreTheme(input.theme) && parseThemeSettings(input.themeSettings) !== null;
}

export function storeToInput(store: Store): StoreInput {
  return {
    name: store.name,
    slug: store.slug,
    whatsappNumber: store.whatsappNumber,
    countryCode: store.countryCode,
    currencyCode: store.currencyCode,
    description: store.description || "",
    businessLocation: store.businessLocation || "",
    contactEmail: store.contactEmail || "",
    theme: store.theme,
    themeSettings: store.themeSettings ?? {}
  };
}

export function fieldError(
  input: StoreInput,
  step: 0 | 1 | 2 | 3,
  language: "fr" | "en"
): Record<string, string> {
  const t = copy[language];
  const errors: Record<string, string> = {};

  if (step === 0 || step === 3) {
    if (input.name.trim().length < 2) errors.name = t.required;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) || input.slug.length < 3) {
      errors.slug = t.invalidSlug;
    }
    if (
      input.contactEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail)
    ) {
      errors.contactEmail = t.invalidEmail;
    }
  }

  if (step === 1 || step === 3) {
    const compact = input.whatsappNumber.replace(/\D/g, "");
    const international = input.whatsappNumber.trim().startsWith("+");
    const cmLocal = input.countryCode === "CM" && (
      /^6\d{8}$/.test(compact) || /^2376\d{8}$/.test(compact)
    );
    if (!cmLocal && !(international && /^[1-9]\d{7,14}$/.test(compact))) {
      errors.whatsappNumber = t.invalidPhone;
    }
  }

  return errors;
}
