export type WorkerBindings = {
  TRIGENYS_COMMERCE_FACTORY_DATABASE_URL?: string;
  TRIGENYS_COMMERCE_FACTORY_AUTH_BASE_URL?: string;
  TRIGENYS_COMMERCE_FACTORY_WEB_ORIGIN?: string;
};

export type Identity = { subject: string; email?: string };

export type StoreSummary = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "published" | "archived";
  whatsappNumber: string;
  countryCode: string;
  currencyCode: string;
};

export type StorePatch = Partial<
  Pick<StoreSummary, "name" | "whatsappNumber" | "countryCode" | "currencyCode">
>;

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
  };
  products: PublicProduct[];
};

export interface CommerceRepository {
  listOwnedStores(authSubject: string): Promise<StoreSummary[]>;
  getOwnedStore(authSubject: string, storeId: string): Promise<StoreSummary | null>;
  updateOwnedStore(authSubject: string, storeId: string, patch: StorePatch): Promise<StoreSummary | null>;
  getPublicStorefront(slug: string): Promise<PublicStorefront | null>;
}
