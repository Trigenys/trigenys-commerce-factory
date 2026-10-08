import { neon } from "@neondatabase/serverless";
import type {
  CommerceRepository,
  PublicStorefront,
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

function databaseConstraint(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const constraint = (error as { constraint?: unknown }).constraint;
  return typeof constraint === "string" ? constraint : null;
}

function uniqueConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return (error as { code?: unknown }).code === "23505";
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
          p.currency_code
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
          currencyCode: product.currency_code
        }))
      };
    }
  };
}
