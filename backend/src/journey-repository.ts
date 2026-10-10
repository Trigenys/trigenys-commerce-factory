import { neon } from "@neondatabase/serverless";
import { canTransitionOrder, type Invitation, type MerchantOrder, type PublicOrder, type PublicSupportTicket, type SupportTicket } from "../../shared/commerce-journeys.ts";
import type { JourneyRepository } from "./journey-types.ts";

type Row = Record<string, any>;
function iso(value:unknown):string { return new Date(String(value)).toISOString(); }
function publicOrder(row:Row):PublicOrder {
  return {id:row.id,storeSlug:row.store_slug,storeName:row.store_name,reference:"CF-"+row.id.slice(0,8).toUpperCase(),status:row.status,paymentMethod:row.payment_method,paymentStatus:row.payment_status,currencyCode:row.currency_code,total:String(row.total),lines:row.lines,createdAt:iso(row.created_at),updatedAt:iso(row.updated_at),version:row.version,history:(row.history || []).map((event:Row)=>({at:event.at,status:event.status,paymentStatus:event.paymentStatus}))};
}
function merchantOrder(row:Row):MerchantOrder {return {...publicOrder(row),customerName:row.customer_name,customerPhone:row.customer_phone,note:row.note};}
function invitation(row:Row):Invitation {return {id:row.id,email:row.email,expiresAt:iso(row.expires_at),revokedAt:row.revoked_at ? iso(row.revoked_at) : null,acceptedAt:row.accepted_at ? iso(row.accepted_at) : null};}
function publicTicket(row:Row):PublicSupportTicket {return {id:row.id,status:row.status,createdAt:iso(row.created_at),updatedAt:iso(row.updated_at),reply:row.reply};}
function ticket(row:Row):SupportTicket {return {...publicTicket(row),name:row.name,email:row.email,message:row.message,storeSlug:row.store_slug};}

export function createJourneyRepository(connectionString:string, client?:ReturnType<typeof neon>):JourneyRepository {
  const sql = (client || neon(connectionString)) as (strings:TemplateStringsArray,...values:unknown[])=>Promise<Row[]>;
  async function existingOrder(slug:string,key:string) {
    const rows = await sql`SELECT o.*,s.slug AS store_slug,s.name AS store_name FROM commerce_orders o JOIN stores s ON s.id=o.store_id WHERE s.slug=${slug} AND o.idempotency_key=${key}::uuid`;
    return rows[0] as Row|undefined;
  }
  async function role(subject:string,storeId:string) {
    const rows = await sql`SELECT role FROM store_members WHERE auth_subject=${subject} AND store_id=${storeId}::uuid`;
    return rows[0]?.role;
  }
  async function platform(subject:string) {
    const rows = await sql`SELECT auth_subject FROM platform_members WHERE auth_subject=${subject} AND role='support'`;
    return rows.length > 0;
  }
  return {
    async createOrder(slug,quote) {
      const previous = await existingOrder(slug,quote.input.idempotencyKey);
      if (previous) return previous.payload_hash===quote.payloadHash && previous.tracking_hash===quote.trackingHash ? {kind:"existing",order:publicOrder(previous)} : {kind:"conflict"};
      const lines = JSON.stringify(quote.lines);
      const rows = await sql`
        WITH selected_store AS (SELECT id,name,slug FROM stores WHERE slug=${slug} AND status='published'),
        requested AS (SELECT * FROM jsonb_to_recordset(${lines}::jsonb) AS x("productId" uuid,"unitPrice" numeric,variants jsonb)),
        valid AS (
          SELECT r.* FROM requested r JOIN products p ON p.id=r."productId" JOIN selected_store s ON p.store_id=s.id
          WHERE p.status='active' AND p.price=r."unitPrice" AND p.currency_code=${quote.currencyCode}
          AND NOT EXISTS (SELECT 1 FROM jsonb_each_text(r.variants) v WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p.variants) pv WHERE pv->>'name'=v.key AND pv->>'value'=v.value))
          AND (SELECT count(DISTINCT pv->>'name') FROM jsonb_array_elements(p.variants) pv)=(SELECT count(*) FROM jsonb_object_keys(r.variants))
        ),
        inserted AS (
          INSERT INTO commerce_orders(id,store_id,idempotency_key,payload_hash,tracking_hash,lines,total,currency_code,payment_method,customer_name,customer_phone,note,history)
          SELECT ${quote.id}::uuid,s.id,${quote.input.idempotencyKey}::uuid,${quote.payloadHash},${quote.trackingHash},${lines}::jsonb,${quote.total}::numeric,${quote.currencyCode},${quote.input.paymentMethod},${quote.input.customerName},${quote.input.customerPhone},${quote.input.note},jsonb_build_array(jsonb_build_object('at',now(),'status','requested','paymentStatus','pending'))
          FROM selected_store s WHERE (SELECT count(*) FROM valid)=${quote.lines.length}
          ON CONFLICT(store_id,idempotency_key) DO NOTHING RETURNING *
        ) SELECT inserted.*,s.slug AS store_slug,s.name AS store_name FROM inserted JOIN selected_store s ON s.id=inserted.store_id
      `;
      if (rows[0]) return {kind:"created",order:publicOrder(rows[0])};
      const concurrent = await existingOrder(slug,quote.input.idempotencyKey);
      if (concurrent) return concurrent.payload_hash===quote.payloadHash && concurrent.tracking_hash===quote.trackingHash ? {kind:"existing",order:publicOrder(concurrent)} : {kind:"conflict"};
      return {kind:"catalog_changed"};
    },
    async getOrderRequest(slug,key,trackingHash) {
      const rows=await sql`SELECT o.*,s.slug AS store_slug,s.name AS store_name,s.whatsapp_number FROM commerce_orders o JOIN stores s ON s.id=o.store_id WHERE s.slug=${slug} AND o.idempotency_key=${key}::uuid AND o.tracking_hash=${trackingHash}`;
      return rows[0] ? {order:publicOrder(rows[0]),payloadHash:rows[0].payload_hash,whatsappNumber:rows[0].whatsapp_number} : null;
    },
    async getPublicOrder(id,trackingHash) {
      const rows = await sql`SELECT o.*,s.slug AS store_slug,s.name AS store_name FROM commerce_orders o JOIN stores s ON s.id=o.store_id WHERE o.id=${id}::uuid AND o.tracking_hash=${trackingHash}`;
      return rows[0] ? publicOrder(rows[0]) : null;
    },
    async listOrders(subject,storeId) {
      if (!await role(subject,storeId)) return null;
      const rows = await sql`SELECT o.*,s.slug AS store_slug,s.name AS store_name FROM commerce_orders o JOIN stores s ON s.id=o.store_id WHERE o.store_id=${storeId}::uuid AND EXISTS(SELECT 1 FROM store_members sm WHERE sm.store_id=o.store_id AND sm.auth_subject=${subject} AND sm.role IN ('owner','staff')) ORDER BY o.created_at DESC LIMIT 100`;
      return rows.map(merchantOrder);
    },
    async updateOrder(subject,storeId,id,patch) {
      const memberRole = await role(subject,storeId);
      if (!memberRole) return {kind:"not_found"};
      if (patch.paymentStatus && memberRole!=="owner") return {kind:"forbidden"};
      const previous = await sql`SELECT * FROM commerce_orders WHERE id=${id}::uuid AND store_id=${storeId}::uuid`;
      const current = previous[0];
      if (!current) return {kind:"not_found"};
      if (current.version!==patch.expectedVersion) return {kind:"conflict"};
      const nextStatus = patch.status || current.status;
      const nextPayment = patch.paymentStatus || current.payment_status;
      if (!canTransitionOrder(current.status,nextStatus) || (nextStatus==="completed" && nextPayment!=="paid") || (nextPayment==="refunded" && (nextStatus!=="cancelled" || !["paid","refunded"].includes(current.payment_status))) || (current.payment_status!=="pending" && nextPayment==="pending") || (current.payment_status==="refunded" && nextPayment!=="refunded") || (nextPayment==="paid" && current.payment_status!=="paid" && nextStatus==="cancelled")) return {kind:"invalid_transition"};
      const rows = await sql`
        WITH updated AS (
          UPDATE commerce_orders o SET status=${nextStatus},payment_status=${nextPayment},version=version+1,updated_at=now(),history=history || jsonb_build_array(jsonb_build_object('at',now(),'status',${nextStatus}::text,'paymentStatus',${nextPayment}::text,'actor',${subject}::text))
          WHERE o.id=${id}::uuid AND o.store_id=${storeId}::uuid AND o.version=${patch.expectedVersion}
          AND EXISTS(SELECT 1 FROM store_members sm WHERE sm.store_id=o.store_id AND sm.auth_subject=${subject} AND (sm.role='owner' OR (sm.role='staff' AND ${Boolean(patch.paymentStatus)}=false)))
          RETURNING *
        ) SELECT u.*,s.slug AS store_slug,s.name AS store_name FROM updated u JOIN stores s ON s.id=u.store_id
      `;
      return rows[0] ? {kind:"updated",order:merchantOrder(rows[0])} : {kind:"conflict"};
    },
    async listTeam(subject,storeId) {
      if (await role(subject,storeId)!=="owner") return null;
      const members = await sql`SELECT m.id,m.auth_subject AS subject,m.role,m.created_at,(SELECT i.email FROM store_invitations i WHERE i.store_id=m.store_id AND i.accepted_by=m.auth_subject ORDER BY i.accepted_at DESC LIMIT 1) AS email FROM store_members m WHERE m.store_id=${storeId}::uuid ORDER BY m.created_at`;
      const invitations = await sql`SELECT * FROM store_invitations WHERE store_id=${storeId}::uuid ORDER BY created_at DESC LIMIT 50`;
      return {members:members.map(r=>({id:r.id,email:r.email||undefined,subject:r.subject,role:r.role,createdAt:iso(r.created_at)})),invitations:invitations.map(invitation)};
    },
    async createInvitation(subject,storeId,id,email,tokenHash) {
      const rows = await sql`INSERT INTO store_invitations(id,store_id,email,token_hash,created_by,expires_at) SELECT ${id}::uuid,store_id,${email},${tokenHash},${subject},now()+interval '2 days' FROM store_members WHERE store_id=${storeId}::uuid AND auth_subject=${subject} AND role='owner' RETURNING *`;
      return rows[0] ? invitation(rows[0]) : null;
    },
    async revokeInvitation(subject,storeId,id) {
      const rows = await sql`UPDATE store_invitations i SET revoked_at=now() WHERE i.id=${id}::uuid AND i.store_id=${storeId}::uuid AND i.accepted_at IS NULL AND i.revoked_at IS NULL AND EXISTS(SELECT 1 FROM store_members sm WHERE sm.store_id=i.store_id AND sm.auth_subject=${subject} AND sm.role='owner') RETURNING id`;
      return rows.length>0;
    },
    async removeMember(subject,storeId,id) {
      const rows = await sql`DELETE FROM store_members m WHERE m.id=${id}::uuid AND m.store_id=${storeId}::uuid AND m.role='staff' AND EXISTS(SELECT 1 FROM store_members sm WHERE sm.store_id=m.store_id AND sm.auth_subject=${subject} AND sm.role='owner') RETURNING id`;
      return rows.length>0;
    },
    async acceptInvitation(subject,email,tokenHash) {
      const rows = await sql`
        WITH valid AS (SELECT * FROM store_invitations WHERE token_hash=${tokenHash} AND email=${email.toLowerCase()} AND expires_at>now() AND revoked_at IS NULL AND accepted_at IS NULL FOR UPDATE),
        member AS (INSERT INTO store_members(id,store_id,auth_subject,role) SELECT gen_random_uuid(),store_id,${subject},'staff' FROM valid ON CONFLICT(store_id,auth_subject) DO NOTHING RETURNING store_id),
        accepted AS (UPDATE store_invitations i SET accepted_at=now(),accepted_by=${subject} FROM valid v WHERE i.id=v.id AND (EXISTS(SELECT 1 FROM member m WHERE m.store_id=v.store_id) OR EXISTS(SELECT 1 FROM store_members sm WHERE sm.store_id=v.store_id AND sm.auth_subject=${subject})) RETURNING i.store_id)
        SELECT store_id FROM accepted
      `;
      return rows[0] ? {storeId:rows[0].store_id} : null;
    },
    hasPlatformAccess:platform,
    async listPlatformStores(subject,query) {
      if (!await platform(subject)) return null;
      const rows = await sql`SELECT s.id,s.name,s.slug,s.status,s.created_at,(SELECT count(*)::int FROM products p WHERE p.store_id=s.id AND p.status!='archived') AS product_count FROM stores s WHERE (s.name ILIKE ${"%"+query+"%"} OR s.slug ILIKE ${"%"+query+"%"}) AND EXISTS(SELECT 1 FROM platform_members pm WHERE pm.auth_subject=${subject} AND pm.role='support') ORDER BY s.created_at DESC LIMIT 100`;
      return rows.map(r=>({id:r.id,name:r.name,slug:r.slug,status:r.status,createdAt:iso(r.created_at),productCount:r.product_count}));
    },
    async createSupport(input) {
      const rows = await sql`INSERT INTO support_requests(id,tracking_hash,name,email,message,store_slug) VALUES(${input.id}::uuid,${input.trackingHash},${input.name},${input.email},${input.message},${input.storeSlug}) ON CONFLICT(id) DO NOTHING RETURNING *`;
      if (rows[0]) return publicTicket(rows[0]);
      const prior = await sql`SELECT * FROM support_requests WHERE id=${input.id}::uuid AND tracking_hash=${input.trackingHash} AND name=${input.name} AND email=${input.email} AND message=${input.message} AND store_slug IS NOT DISTINCT FROM ${input.storeSlug}`;
      if (!prior[0]) throw new Error("SUPPORT_CONFLICT");
      return publicTicket(prior[0]);
    },
    async getPublicSupport(id,trackingHash) {
      const rows = await sql`SELECT * FROM support_requests WHERE id=${id}::uuid AND tracking_hash=${trackingHash}`;
      return rows[0] ? publicTicket(rows[0]) : null;
    },
    async listSupport(subject) {
      if (!await platform(subject)) return null;
      const rows = await sql`SELECT * FROM support_requests WHERE EXISTS(SELECT 1 FROM platform_members pm WHERE pm.auth_subject=${subject} AND pm.role='support') ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,created_at DESC LIMIT 100`;
      return rows.map(ticket);
    },
    async updateSupport(subject,id,status,reply) {
      const rows = await sql`
        WITH updated AS (UPDATE support_requests SET status=${status},reply=${reply || null},updated_at=now() WHERE id=${id}::uuid AND EXISTS(SELECT 1 FROM platform_members pm WHERE pm.auth_subject=${subject} AND pm.role='support') RETURNING *),
        audit AS (INSERT INTO support_audit(ticket_id,actor_subject,status) SELECT id,${subject},${status} FROM updated RETURNING ticket_id)
        SELECT updated.* FROM updated JOIN audit ON audit.ticket_id=updated.id
      `;
      return rows[0] ? ticket(rows[0]) : null;
    }
  };
}
