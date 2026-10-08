import { neon } from "@neondatabase/serverless";
import type {
  CommerceRepository,
  PublicStorefront,
  StorePatch,
  StoreSummary
} from "./types.ts";

type StoreRow = {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "published" | "archived";
  whatsapp_number: string;
  country_code: string;
  currency_code: string;
};

function mapStore(row: StoreRow): StoreSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    whatsappNumber: row.whatsapp_number,
    countryCode: row.country_code,
    currencyCode: row.currency_code
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
          s.currency_code
        FROM stores s
        INNER JOIN store_members sm ON sm.store_id = s.id
        WHERE sm.auth_subject = ${authSubject}
          AND sm.role = 'owner'
        ORDER BY s.created_at ASC
      ` as StoreRow[];
      return rows.map(mapStore);
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
          s.currency_code
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
      const whatsappNumber = patch.whatsappNumber ?? null;
      const countryCode = patch.countryCode ?? null;
      const currencyCode = patch.currencyCode ?? null;

      const rows = await sql`
        UPDATE stores s
        SET
          name = COALESCE(${name}, s.name),
          whatsapp_number = COALESCE(${whatsappNumber}, s.whatsapp_number),
          country_code = COALESCE(${countryCode}, s.country_code),
          currency_code = COALESCE(${currencyCode}, s.currency_code),
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
          s.currency_code
      ` as StoreRow[];
      return rows[0] ? mapStore(rows[0]) : null;
    },

    async getPublicStorefront(slug): Promise<PublicStorefront | null> {
      const stores = await sql`
        SELECT
          name,
          slug,
          whatsapp_number,
          country_code,
          currency_code
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
          currencyCode: store.currency_code
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
