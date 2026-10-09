import { neon } from "@neondatabase/serverless";
import type {
  CommerceRepository,
  ProductInput,
  ProductSummary,
  ProductVariant,
  ProductAnalytics,
  PublicEventMetadata,
  PublicEventName,
  PublicStorefront,
  StoreAnalytics,
  StoreCreateInput,
  StorePatch,
  StoreSummary,
  StoreTheme
} from "./types.ts";

type StoreRow = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "published" | "archived";
  whatsapp_number: string;
  country_code: string;
  currency_code: string;
  description: string | null;
  business_location: string | null;
  contact_email: string | null;
  theme: StoreTheme;
  logo_url: string | null;
};

type ProductRow = {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  currency_code: string;
  category: string | null;
  stock_label: string | null;
  status: "draft" | "active" | "archived";
  sort_order: number;
  image_urls: unknown;
  variants: unknown;
};

function mapStore(row: StoreRow): StoreSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    whatsappNumber: row.whatsapp_number,
    countryCode: row.country_code,
    currencyCode: row.currency_code,
    description: row.description,
    businessLocation: row.business_location,
    contactEmail: row.contact_email,
    theme: row.theme,
    logoUrl: row.logo_url
  };
}

function productImages(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function productVariants(value: unknown): ProductVariant[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    return typeof record.name === "string" && typeof record.value === "string"
      ? [{ name: record.name, value: record.value }]
      : [];
  });
}

function mapProduct(row: ProductRow): ProductSummary {
  return {
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: row.price,
    currencyCode: row.currency_code,
    category: row.category,
    stockLabel: row.stock_label,
    status: row.status,
    sortOrder: row.sort_order,
    imageUrls: productImages(row.image_urls),
    variants: productVariants(row.variants)
  };
}

function databaseConstraint(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const constraint = (error as { constraint?: unknown }).constraint;
  return typeof constraint === "string" ? constraint : null;
}

function uniqueConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return (error as { code?: unknown }).code === "23505";
}

function productJson(input: ProductInput) {
  return {
    imageUrls: JSON.stringify(input.imageUrls),
    variants: JSON.stringify(input.variants)
  };
}

export function createNeonRepository(connectionString: string): CommerceRepository {
  const sql = neon(connectionString);

  return {
    async listOwnedStores(authSubject) {
      const rows = await sql`
        SELECT
          s.id,
          s.name,
          s.slug,
          s.status,
          s.whatsapp_number,
          s.country_code,
          s.currency_code,
          s.description,
          s.business_location,
          s.contact_email,
          s.theme,
          s.logo_url
        FROM stores s
        INNER JOIN store_members sm ON sm.store_id = s.id
        WHERE sm.auth_subject = ${authSubject}
          AND sm.role = 'owner'
        ORDER BY s.created_at ASC
      ` as StoreRow[];
      return rows.map(mapStore);
    },

    async createOwnedStore(authSubject, input: StoreCreateInput) {
      const merchantId = crypto.randomUUID();
      const storeId = crypto.randomUUID();
      const membershipId = crypto.randomUUID();

      try {
        const rows = await sql`
          WITH new_merchant AS (
            INSERT INTO merchants (id, display_name)
            VALUES (${merchantId}, ${input.name})
            RETURNING id
          ),
          new_store AS (
            INSERT INTO stores (
              id,
              merchant_id,
              name,
              slug,
              whatsapp_number,
              country_code,
              currency_code,
              description,
              business_location,
              contact_email,
              theme,
              logo_url
            )
            SELECT
              ${storeId},
              new_merchant.id,
              ${input.name},
              ${input.slug},
              ${input.whatsappNumber},
              ${input.countryCode},
              ${input.currencyCode},
              ${input.description},
              ${input.businessLocation},
              ${input.contactEmail},
              ${input.theme},
              ${input.logoUrl}
            FROM new_merchant
            RETURNING
              id,
              name,
              slug,
              status,
              whatsapp_number,
              country_code,
              currency_code,
              description,
              business_location,
              contact_email,
              theme,
              logo_url
          ),
          new_membership AS (
            INSERT INTO store_members (id, store_id, auth_subject, role)
            SELECT ${membershipId}, new_store.id, ${authSubject}, 'owner'
            FROM new_store
            RETURNING store_id
          )
          SELECT new_store.*
          FROM new_store
          INNER JOIN new_membership
            ON new_membership.store_id = new_store.id
        ` as StoreRow[];

        const store = rows[0];
        if (!store) throw new Error("Store creation returned no row.");
        return { kind: "created" as const, store: mapStore(store) };
      } catch (error) {
        if (!uniqueConflict(error)) throw error;
        const constraint = databaseConstraint(error);
        if (constraint === "stores_slug_key") {
          return { kind: "slug_taken" as const };
        }
        if (constraint === "store_members_one_owner_store_idx") {
          return { kind: "owner_exists" as const };
        }
        throw error;
      }
    },

    async getOwnedStore(authSubject, storeId) {
      const rows = await sql`
        SELECT
          s.id,
          s.name,
          s.slug,
          s.status,
          s.whatsapp_number,
          s.country_code,
          s.currency_code,
          s.description,
          s.business_location,
          s.contact_email,
          s.theme,
          s.logo_url
        FROM stores s
        INNER JOIN store_members sm ON sm.store_id = s.id
        WHERE s.id = ${storeId}
          AND sm.auth_subject = ${authSubject}
          AND sm.role = 'owner'
        LIMIT 1
      ` as StoreRow[];
      return rows[0] ? mapStore(rows[0]) : null;
    },

    async updateOwnedStore(authSubject, storeId, patch: StorePatch) {
      const name = patch.name ?? null;
      const slug = patch.slug ?? null;
      const whatsappNumber = patch.whatsappNumber ?? null;
      const countryCode = patch.countryCode ?? null;
      const currencyCode = patch.currencyCode ?? null;
      const description = patch.description === undefined ? null : patch.description;
      const businessLocation =
        patch.businessLocation === undefined ? null : patch.businessLocation;
      const contactEmail =
        patch.contactEmail === undefined ? null : patch.contactEmail;
      const theme = patch.theme ?? null;
      const logoUrl = patch.logoUrl === undefined ? null : patch.logoUrl;

      try {
        const rows = await sql`
          UPDATE stores s
          SET
            name = COALESCE(${name}, s.name),
            slug = COALESCE(${slug}, s.slug),
            whatsapp_number = COALESCE(${whatsappNumber}, s.whatsapp_number),
            country_code = COALESCE(${countryCode}, s.country_code),
            currency_code = COALESCE(${currencyCode}, s.currency_code),
            description = CASE
              WHEN ${patch.description !== undefined} THEN ${description}
              ELSE s.description
            END,
            business_location = CASE
              WHEN ${patch.businessLocation !== undefined} THEN ${businessLocation}
              ELSE s.business_location
            END,
            contact_email = CASE
              WHEN ${patch.contactEmail !== undefined} THEN ${contactEmail}
              ELSE s.contact_email
            END,
            theme = COALESCE(${theme}, s.theme),
            logo_url = CASE
              WHEN ${patch.logoUrl !== undefined} THEN ${logoUrl}
              ELSE s.logo_url
            END,
            updated_at = now()
          FROM store_members sm
          WHERE s.id = ${storeId}
            AND sm.store_id = s.id
            AND sm.auth_subject = ${authSubject}
            AND sm.role = 'owner'
          RETURNING
            s.id,
            s.name,
            s.slug,
            s.status,
            s.whatsapp_number,
            s.country_code,
            s.currency_code,
            s.description,
            s.business_location,
            s.contact_email,
            s.theme,
            s.logo_url
        ` as StoreRow[];
        return rows[0]
          ? { kind: "updated" as const, store: mapStore(rows[0]) }
          : { kind: "not_found" as const };
      } catch (error) {
        if (
          uniqueConflict(error) &&
          databaseConstraint(error) === "stores_slug_key"
        ) {
          return { kind: "slug_taken" as const };
        }
        throw error;
      }
    },

    async publishOwnedStore(authSubject, storeId) {
      const owned = await sql`
        SELECT
          s.id,
          s.name,
          s.slug,
          s.status,
          s.whatsapp_number,
          s.country_code,
          s.currency_code,
          s.description,
          s.business_location,
          s.contact_email,
          s.theme,
          s.logo_url
        FROM stores s
        INNER JOIN store_members sm ON sm.store_id = s.id
        WHERE s.id = ${storeId}
          AND sm.auth_subject = ${authSubject}
          AND sm.role = 'owner'
        LIMIT 1
      ` as StoreRow[];

      if (!owned[0]) return { kind: "not_found" as const };

      const active = await sql`
        SELECT EXISTS (
          SELECT 1
          FROM products
          WHERE store_id = ${storeId}
            AND status = 'active'
        ) AS exists
      ` as Array<{ exists: boolean }>;

      if (!active[0]?.exists) {
        return { kind: "active_product_required" as const };
      }

      const rows = await sql`
        UPDATE stores
        SET status = 'published', updated_at = now()
        WHERE id = ${storeId}
        RETURNING
          id,
          name,
          slug,
          status,
          whatsapp_number,
          country_code,
          currency_code,
          description,
          business_location,
          contact_email,
          theme,
          logo_url
      ` as StoreRow[];

      return rows[0]
        ? { kind: "published" as const, store: mapStore(rows[0]) }
        : { kind: "not_found" as const };
    },

    async getPublicStorefront(slug): Promise<PublicStorefront | null> {
      const stores = await sql`
        SELECT
          name,
          slug,
          whatsapp_number,
          country_code,
          currency_code,
          description,
          business_location,
          theme,
          logo_url
        FROM stores
        WHERE slug = ${slug}
          AND status = 'published'
        LIMIT 1
      ` as Array<{
        name: string;
        slug: string;
        whatsapp_number: string;
        country_code: string;
        currency_code: string;
        description: string | null;
        business_location: string | null;
        theme: StoreTheme;
        logo_url: string | null;
      }>;

      const store = stores[0];
      if (!store) return null;

      const products = await sql`
        SELECT
          p.id,
          p.name,
          p.slug,
          p.description,
          p.price::text AS price,
          p.currency_code,
          p.category,
          p.stock_label,
          p.image_urls,
          p.variants
        FROM products p
        INNER JOIN stores s ON s.id = p.store_id
        WHERE s.slug = ${slug}
          AND s.status = 'published'
          AND p.status = 'active'
        ORDER BY p.sort_order ASC, p.created_at ASC
      ` as Array<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        price: string;
        currency_code: string;
        category: string | null;
        stock_label: string | null;
        image_urls: unknown;
        variants: unknown;
      }>;

      return {
        store: {
          name: store.name,
          slug: store.slug,
          whatsappNumber: store.whatsapp_number,
          countryCode: store.country_code,
          currencyCode: store.currency_code,
          description: store.description,
          businessLocation: store.business_location,
          theme: store.theme,
          logoUrl: store.logo_url
        },
        products: products.map((product) => ({
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description,
          price: product.price,
          currencyCode: product.currency_code,
          category: product.category,
          stockLabel: product.stock_label,
          imageUrls: productImages(product.image_urls),
          variants: productVariants(product.variants)
        }))
      };
    },

    async listOwnedProducts(authSubject, storeId) {
      const rows = await sql`
        SELECT
          p.id,
          p.store_id,
          p.name,
          p.slug,
          p.description,
          p.price::text AS price,
          p.currency_code,
          p.category,
          p.stock_label,
          p.status,
          p.sort_order,
          p.image_urls,
          p.variants
        FROM products p
        INNER JOIN store_members sm ON sm.store_id = p.store_id
        WHERE p.store_id = ${storeId}
          AND sm.auth_subject = ${authSubject}
          AND sm.role = 'owner'
        ORDER BY
          CASE WHEN p.status = 'archived' THEN 1 ELSE 0 END,
          p.sort_order ASC,
          p.created_at ASC
      ` as ProductRow[];
      return rows.map(mapProduct);
    },

    async createOwnedProduct(authSubject, storeId, input: ProductInput) {
      const productId = crypto.randomUUID();
      const json = productJson(input);

      try {
        const rows = await sql`
          INSERT INTO products (
            id,
            store_id,
            name,
            slug,
            description,
            price,
            currency_code,
            category,
            stock_label,
            status,
            sort_order,
            image_urls,
            variants
          )
          SELECT
            ${productId},
            s.id,
            ${input.name},
            ${input.slug},
            ${input.description},
            ${input.price},
            ${input.currencyCode},
            ${input.category},
            ${input.stockLabel},
            ${input.status},
            ${input.sortOrder},
            ${json.imageUrls}::jsonb,
            ${json.variants}::jsonb
          FROM stores s
          INNER JOIN store_members sm ON sm.store_id = s.id
          WHERE s.id = ${storeId}
            AND sm.auth_subject = ${authSubject}
            AND sm.role = 'owner'
          RETURNING
            id,
            store_id,
            name,
            slug,
            description,
            price::text AS price,
            currency_code,
            category,
            stock_label,
            status,
            sort_order,
            image_urls,
            variants
        ` as ProductRow[];

        return rows[0]
          ? { kind: "created" as const, product: mapProduct(rows[0]) }
          : { kind: "store_not_found" as const };
      } catch (error) {
        if (
          uniqueConflict(error) &&
          databaseConstraint(error) === "products_store_id_slug_key"
        ) {
          return { kind: "slug_taken" as const };
        }
        throw error;
      }
    },

    async updateOwnedProduct(authSubject, storeId, productId, input: ProductInput) {
      const json = productJson(input);
      try {
        const rows = await sql`
          UPDATE products p
          SET
            name = ${input.name},
            slug = ${input.slug},
            description = ${input.description},
            price = ${input.price},
            currency_code = ${input.currencyCode},
            category = ${input.category},
            stock_label = ${input.stockLabel},
            status = ${input.status},
            sort_order = ${input.sortOrder},
            image_urls = ${json.imageUrls}::jsonb,
            variants = ${json.variants}::jsonb,
            updated_at = now()
          FROM store_members sm
          WHERE p.id = ${productId}
            AND p.store_id = ${storeId}
            AND sm.store_id = p.store_id
            AND sm.auth_subject = ${authSubject}
            AND sm.role = 'owner'
            AND p.status <> 'archived'
          RETURNING
            p.id,
            p.store_id,
            p.name,
            p.slug,
            p.description,
            p.price::text AS price,
            p.currency_code,
            p.category,
            p.stock_label,
            p.status,
            p.sort_order,
            p.image_urls,
            p.variants
        ` as ProductRow[];
        return rows[0]
          ? { kind: "updated" as const, product: mapProduct(rows[0]) }
          : { kind: "not_found" as const };
      } catch (error) {
        if (
          uniqueConflict(error) &&
          databaseConstraint(error) === "products_store_id_slug_key"
        ) {
          return { kind: "slug_taken" as const };
        }
        throw error;
      }
    },

    async archiveOwnedProduct(authSubject, storeId, productId) {
      const rows = await sql`
        UPDATE products p
        SET status = 'archived', updated_at = now()
        FROM store_members sm
        WHERE p.id = ${productId}
          AND p.store_id = ${storeId}
          AND sm.store_id = p.store_id
          AND sm.auth_subject = ${authSubject}
          AND sm.role = 'owner'
        RETURNING p.id
      ` as Array<{ id: string }>;
      return Boolean(rows[0]);
    },

    async duplicateOwnedProduct(authSubject, storeId, productId) {
      const rows = await sql`
        INSERT INTO products (
          id,
          store_id,
          name,
          slug,
          description,
          price,
          currency_code,
          category,
          stock_label,
          status,
          sort_order,
          image_urls,
          variants
        )
        SELECT
          gen_random_uuid(),
          p.store_id,
          left(p.name || ' copy', 180),
          left(
            p.slug || '-copy-' ||
            left(replace(gen_random_uuid()::text, '-', ''), 6),
            63
          ),
          p.description,
          p.price,
          p.currency_code,
          p.category,
          p.stock_label,
          'draft',
          p.sort_order + 1,
          p.image_urls,
          p.variants
        FROM products p
        INNER JOIN store_members sm ON sm.store_id = p.store_id
        WHERE p.id = ${productId}
          AND p.store_id = ${storeId}
          AND sm.auth_subject = ${authSubject}
          AND sm.role = 'owner'
          AND p.status <> 'archived'
        RETURNING
          id,
          store_id,
          name,
          slug,
          description,
          price::text AS price,
          currency_code,
          category,
          stock_label,
          status,
          sort_order,
          image_urls,
          variants
      ` as ProductRow[];
      return rows[0] ? mapProduct(rows[0]) : null;
    },

    async recordPublicEvent(
      eventId: string,
      eventName: PublicEventName,
      storeSlug: string,
      productSlug: string | null,
      metadata: PublicEventMetadata
    ) {
      const metadataJson = JSON.stringify(metadata);
      const rows = await sql`
        WITH target AS (
          SELECT
            s.id AS store_id,
            p.id AS product_id
          FROM stores s
          LEFT JOIN products p
            ON p.store_id = s.id
           AND p.slug = ${productSlug}
           AND p.status = 'active'
          WHERE s.slug = ${storeSlug}
            AND s.status = 'published'
            AND (${productSlug}::text IS NULL OR p.id IS NOT NULL)
          LIMIT 1
        ),
        inserted AS (
          INSERT INTO commerce_events (
            id,
            event_name,
            store_id,
            product_id,
            metadata
          )
          SELECT
            ${eventId}::uuid,
            ${eventName},
            target.store_id,
            target.product_id,
            ${metadataJson}::jsonb
          FROM target
          ON CONFLICT (id) DO NOTHING
          RETURNING id
        )
        SELECT EXISTS (SELECT 1 FROM target) AS target_exists
      ` as Array<{ target_exists: boolean }>;

      return Boolean(rows[0]?.target_exists);
    },

    async getOwnedStoreAnalytics(
      authSubject: string,
      storeId: string,
      days: number
    ): Promise<StoreAnalytics | null> {
      const ownership = await sql`
        SELECT 1 AS owned
        FROM store_members
        WHERE store_id = ${storeId}
          AND auth_subject = ${authSubject}
          AND role = 'owner'
        LIMIT 1
      ` as Array<{ owned: number }>;
      if (!ownership[0]) return null;

      const summaryRows = await sql`
        SELECT
          count(*) FILTER (WHERE event_name = 'store_view')::text AS store_views,
          count(*) FILTER (WHERE event_name = 'product_view')::text AS product_views,
          count(*) FILTER (WHERE event_name = 'whatsapp_order_click')::text AS whatsapp_clicks
        FROM commerce_events
        WHERE store_id = ${storeId}
          AND created_at >= now() - (${days}::text || ' days')::interval
      ` as Array<{
        store_views: string;
        product_views: string;
        whatsapp_clicks: string;
      }>;

      const topRows = await sql`
        SELECT
          p.id AS product_id,
          p.name,
          count(e.id) FILTER (
            WHERE e.event_name = 'product_view'
          )::text AS views,
          count(e.id) FILTER (
            WHERE e.event_name = 'whatsapp_order_click'
          )::text AS whatsapp_clicks
        FROM products p
        LEFT JOIN commerce_events e
          ON e.product_id = p.id
         AND e.created_at >= now() - (${days}::text || ' days')::interval
        WHERE p.store_id = ${storeId}
        GROUP BY p.id, p.name
        ORDER BY
          count(e.id) FILTER (
            WHERE e.event_name = 'whatsapp_order_click'
          ) DESC,
          count(e.id) FILTER (
            WHERE e.event_name = 'product_view'
          ) DESC,
          p.name ASC
        LIMIT 5
      ` as Array<{
        product_id: string;
        name: string;
        views: string;
        whatsapp_clicks: string;
      }>;

      const summary = summaryRows[0] || {
        store_views: "0",
        product_views: "0",
        whatsapp_clicks: "0"
      };
      const storeViews = Number(summary.store_views) || 0;
      const productViews = Number(summary.product_views) || 0;
      const whatsappClicks = Number(summary.whatsapp_clicks) || 0;

      const topProducts: ProductAnalytics[] = topRows.map((row) => {
        const views = Number(row.views) || 0;
        const clicks = Number(row.whatsapp_clicks) || 0;
        return {
          productId: row.product_id,
          name: row.name,
          views,
          whatsappClicks: clicks,
          clickThroughRate: views > 0 ? clicks / views : 0
        };
      });

      return {
        days,
        storeViews,
        productViews,
        whatsappClicks,
        clickThroughRate:
          productViews > 0 ? whatsappClicks / productViews : 0,
        topProducts
      };
    }
  };
}
