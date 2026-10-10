import type { StoreTheme, ThemeSettings } from "../../shared/store-themes.ts";
export type { StoreTheme } from "../../shared/store-themes.ts";

export interface MediaBucketObject {
  body: ReadableStream<Uint8Array> | null;
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
  };
  customMetadata?: Record<string, string>;
}

export interface MediaBucket {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | Blob | ReadableStream | string,
    options?: {
      httpMetadata?: {
        contentType?: string;
        cacheControl?: string;
      };
      customMetadata?: Record<string, string>;
    }
  ): Promise<unknown>;
  get(key: string): Promise<MediaBucketObject | null>;
  delete(key: string): Promise<void>;
}

export type WorkerBindings = {
  TRIGENYS_COMMERCE_FACTORY_DATABASE_URL?: string;
  TRIGENYS_COMMERCE_FACTORY_AUTH_BASE_URL?: string;
  TRIGENYS_COMMERCE_FACTORY_WEB_ORIGIN?: string;
  MEDIA_BUCKET?: MediaBucket;
};

export type Identity = { subject: string; email?: string; emailVerified?: boolean };

export type StoreSummary = {
  role?: "owner" | "staff";
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
  themeSettings?: ThemeSettings;
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
  themeSettings?: ThemeSettings;
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
    | "themeSettings"
    | "logoUrl"
  >
>;

export type StoreUpdateResult =
  | { kind: "updated"; store: StoreSummary }
  | { kind: "not_found" }
  | { kind: "slug_taken" };

export type StorePublishResult =
  | { kind: "published"; store: StoreSummary }
  | { kind: "not_found" }
  | { kind: "active_product_required" };

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
  variants: ProductVariant[];
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

export interface CommerceRepository {
  getStoreRole?(authSubject: string, storeId: string): Promise<"owner" | "staff" | null>;
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
  publishOwnedStore(
    authSubject: string,
    storeId: string
  ): Promise<StorePublishResult>;
  getPublicStorefront(slug: string): Promise<PublicStorefront | null>;
  listOwnedProducts(
    authSubject: string,
    storeId: string
  ): Promise<ProductSummary[]>;
  createOwnedProduct(
    authSubject: string,
    storeId: string,
    input: ProductInput
  ): Promise<ProductCreateResult>;
  updateOwnedProduct(
    authSubject: string,
    storeId: string,
    productId: string,
    input: ProductInput
  ): Promise<ProductUpdateResult>;
  archiveOwnedProduct(
    authSubject: string,
    storeId: string,
    productId: string
  ): Promise<boolean>;
  duplicateOwnedProduct(
    authSubject: string,
    storeId: string,
    productId: string
  ): Promise<ProductSummary | null>;
  recordPublicEvent(
    eventId: string,
    eventName: PublicEventName,
    storeSlug: string,
    productSlug: string | null,
    metadata: PublicEventMetadata
  ): Promise<boolean>;
  getOwnedStoreAnalytics(
    authSubject: string,
    storeId: string,
    days: number
  ): Promise<StoreAnalytics | null>;
  createOwnedMediaObject(
    authSubject: string,
    input: MediaCreateInput
  ): Promise<MediaObject | null>;
  getOwnedMediaObject(
    authSubject: string,
    storeId: string,
    mediaId: string
  ): Promise<MediaObject | null>;
  getOwnedMediaObjectByPublicId(
    authSubject: string,
    storeId: string,
    publicId: string
  ): Promise<MediaObject | null>;
  deleteOwnedMediaObject(
    authSubject: string,
    storeId: string,
    mediaId: string
  ): Promise<boolean>;
  deleteOwnedMediaObjectByPublicId(
    authSubject: string,
    storeId: string,
    publicId: string
  ): Promise<boolean>;
  getPublicMediaObject(
    publicId: string
  ): Promise<PublicMediaObject | null>;
}


export type ProductStatus = "draft" | "active" | "archived";

export type ProductVariant = {
  name: string;
  value: string;
};

export type ProductInput = {
  name: string;
  slug: string;
  description: string | null;
  price: string;
  currencyCode: string;
  category: string | null;
  stockLabel: string | null;
  status: Exclude<ProductStatus, "archived">;
  sortOrder: number;
  imageUrls: string[];
  variants: ProductVariant[];
};

export type ProductSummary = Omit<ProductInput, "status"> & {
  id: string;
  storeId: string;
  status: ProductStatus;
};

export type ProductCreateResult =
  | { kind: "created"; product: ProductSummary }
  | { kind: "slug_taken" }
  | { kind: "store_not_found" };

export type ProductUpdateResult =
  | { kind: "updated"; product: ProductSummary }
  | { kind: "not_found" }
  | { kind: "slug_taken" };


export type PublicEventName =
  | "store_view"
  | "product_view"
  | "whatsapp_order_click";

export type PublicEventMetadata = Record<
  string,
  string | number | boolean | null
>;


export type ProductAnalytics = {
  productId: string;
  name: string;
  views: number;
  whatsappClicks: number;
  clickThroughRate: number;
};

export type StoreAnalytics = {
  days: number;
  storeViews: number;
  productViews: number;
  whatsappClicks: number;
  clickThroughRate: number;
  topProducts: ProductAnalytics[];
};


export type MediaKind = "logo" | "product";

export type MediaObject = {
  id: string;
  publicId: string;
  storeId: string;
  productId: string | null;
  kind: MediaKind;
  objectKey: string;
  contentType: "image/webp";
  byteSize: number;
  publicUrl: string | null;
};

export type MediaCreateInput = {
  id: string;
  publicId: string;
  storeId: string;
  productId: string | null;
  kind: MediaKind;
  objectKey: string;
  contentType: "image/webp";
  byteSize: number;
};

export type PublicMediaObject = {
  objectKey: string;
  contentType: "image/webp";
  byteSize: number;
};
