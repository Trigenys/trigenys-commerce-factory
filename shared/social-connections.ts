export const socialProviders = ["facebook", "instagram", "tiktok"] as const;
export type SocialProvider = typeof socialProviders[number];
export const importFields = ["name", "description", "businessLocation", "contactEmail"] as const;
export type ImportField = typeof importFields[number];
export type ImportValues = Partial<Record<ImportField, string>>;

export type SocialAccount = {
  id: string; name: string; profileUrl: string | null;
  values: ImportValues; truncatedFields: ImportField[];
};
export type SocialConnection = {
  provider: SocialProvider; status: "connected" | "expired" | "disconnected" | "degraded";
  available: boolean; accountName: string | null;
  connectedAt: string | null; expiresAt: string | null; importedAt: string | null;
  lastError: "PERMISSION_REQUIRED" | "PROVIDER_UNAVAILABLE" | "TOKEN_EXPIRED" | null;
};
export type SocialPreview = {
  id: string; provider: SocialProvider; accountName: string; profileUrl: string | null;
  values: ImportValues; currentValues: ImportValues; truncatedFields: ImportField[];
  expiresAt: string; appliedFields: ImportField[] | null;
};

export function isSocialProvider(value: unknown): value is SocialProvider {
  return typeof value === "string" && (socialProviders as readonly string[]).includes(value);
}
export function parseImportFields(value: unknown): ImportField[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > importFields.length) return null;
  if (value.some(field => !importFields.includes(field)) || new Set(value).size !== value.length) return null;
  return [...value].sort() as ImportField[];
}
