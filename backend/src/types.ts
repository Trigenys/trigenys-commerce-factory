export type WorkerBindings = {
  TRIGENYS_COMMERCE_FACTORY_DATABASE_URL?: string;
  TRIGENYS_COMMERCE_FACTORY_AUTH_BASE_URL?: string;
  TRIGENYS_COMMERCE_FACTORY_WEB_ORIGIN?: string;
};

export type Identity = { subject: string; email?: string };

export type StoreTheme = "clean";

export type StoreSummary = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "published" | "archived";
  whatsappNumber: string;
  countryCode: string;
  currencyCode: string;
  description: string | null;
  businessLocation: string | null;
  contactEmail: string | null;
  theme: StoreTheme;
  logoUrl: string | null;
};

export type StoreCreateInput = {
  name: string;
  slug: string;
  whatsappNumber: string;
  countryCode: string;
  currencyCode: string;
  description: string | null;
  businessLocation: string | null;
  contactEmail: string | null;
  theme: StoreTheme;
  logoUrl: string | null;
};

export type StoreCreateResult =
  | { kind: "created"; store: StoreSummary }
  | { kind: "slug_taken" }
  | { kind: "owner_exists" };

export type StorePatch = Partial<
  Pick<
    StoreSummary,
    | "name"
    | "slug"
    | "whatsappNumber"
    | "countryCode"
    | "currencyCode"
    | "description"
    | "businessLocation"
    | "contactEmail"
    | "theme"
    | "logoUrl"
  >
>;

export type StoreUpdateResult =
  | { kind: "updated"; store: StoreSummary }
  | { kind: "not_found" }
  | { kind: "slug_taken" };

export type PublicProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  currencyCode: string;
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
    logoUrl: string | null;
  };
  products: PublicProduct[];
};

export interface CommerceRepository {
  listOwnedStores(authSubject: string): Promise<StoreSummary[]>;
  createOwnedStore(
    authSubject: string,
    input: StoreCreateInput
  ): Promise<StoreCreateResult>;
  getOwnedStore(
    authSubject: string,
    storeId: string
  ): Promise<StoreSummary | null>;
  updateOwnedStore(
    authSubject: string,
    storeId: string,
    patch: StorePatch
  ): Promise<StoreUpdateResult>;
  getPublicStorefront(slug: string): Promise<PublicStorefront | null>;
}
