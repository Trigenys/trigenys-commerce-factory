import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { SocialPreview } from "../../shared/social-connections.ts";
import type { OAuthAttempt, SocialRepository } from "./social-types.ts";

function attempt(row: any): OAuthAttempt {
  return {id:row.id,storeId:row.store_id,subject:row.auth_subject,provider:row.provider,redirectUri:row.redirect_uri};
}
function preview(row: any): SocialPreview {
  return {id:row.id,provider:row.provider,accountName:row.account_name,profileUrl:row.profile_url,
    values:row.proposed_values,currentValues:row.baseline_values,truncatedFields:row.truncated_fields,
    expiresAt:new Date(row.expires_at).toISOString(),appliedFields:row.applied_fields};
}

export function createSocialRepository(connectionString: string, client?: ReturnType<typeof neon>): SocialRepository {
  const sql = (client || neon(connectionString)) as NeonQueryFunction<false,false>;
  async function owner(subject: string, storeId: string) {
    return (await sql`SELECT 1 FROM store_members WHERE store_id=${storeId}::uuid AND auth_subject=${subject} AND role='owner'`).length > 0;
  }
  return {
    async cleanupExpired() {
      await sql`WITH attempts AS (DELETE FROM social_oauth_attempts WHERE expires_at < now()),
        previews AS (DELETE FROM store_social_previews WHERE expires_at < now() - interval '1 day')
        UPDATE store_social_connections SET encrypted_token=NULL,status='degraded',last_error='TOKEN_EXPIRED'
        WHERE encrypted_token IS NOT NULL AND expires_at<=now()`;
    },
    async listConnections(subject,storeId) {
      if (!await owner(subject,storeId)) return null;
      const rows=await sql`SELECT c.provider,c.status,c.account_name,c.connected_at,c.expires_at,c.imported_at,c.last_error
        FROM store_social_connections c JOIN store_members sm ON sm.store_id=c.store_id
        WHERE c.store_id=${storeId}::uuid AND sm.auth_subject=${subject} AND sm.role='owner'`;
      return rows.map(row=>({provider:row.provider,status:row.status!=='disconnected' && row.expires_at && new Date(row.expires_at)<=new Date() ? 'expired' : row.status,
        accountName:row.account_name,connectedAt:row.connected_at ? new Date(row.connected_at).toISOString() : null,
        expiresAt:row.expires_at ? new Date(row.expires_at).toISOString() : null,
        importedAt:row.imported_at ? new Date(row.imported_at).toISOString() : null,lastError:row.last_error}));
    },
    async createAttempt(a,startHash) {
      const rows=await sql`WITH owned AS MATERIALIZED (
        SELECT s.id FROM stores s JOIN store_members sm ON sm.store_id=s.id
        WHERE s.id=${a.storeId}::uuid AND sm.auth_subject=${a.subject} AND sm.role='owner' FOR UPDATE OF s,sm
      ) INSERT INTO social_oauth_attempts(id,store_id,auth_subject,provider,start_hash,redirect_uri,expires_at)
        SELECT ${a.id}::uuid,id,${a.subject},${a.provider},${startHash},${a.redirectUri},now()+interval '10 minutes' FROM owned
        ON CONFLICT(store_id,provider) DO UPDATE SET id=EXCLUDED.id,auth_subject=EXCLUDED.auth_subject,start_hash=EXCLUDED.start_hash,
          state_hash=NULL,browser_hash=NULL,result_hash=NULL,phase='created',redirect_uri=EXCLUDED.redirect_uri,
          encrypted_token=NULL,token_expires_at=NULL,created_at=now(),expires_at=EXCLUDED.expires_at
        RETURNING id`;
      return rows.length>0;
    },
    async startAttempt(startHash,stateHash,browserHash) {
      const rows=await sql`UPDATE social_oauth_attempts a SET phase='started',state_hash=${stateHash},browser_hash=${browserHash}
        WHERE a.start_hash=${startHash} AND a.phase='created' AND a.expires_at>now()
        AND EXISTS(SELECT 1 FROM store_members sm WHERE sm.store_id=a.store_id AND sm.auth_subject=a.auth_subject AND sm.role='owner') RETURNING a.*`;
      return rows[0] ? attempt(rows[0]) : null;
    },
    async claimCallback(provider,stateHash,browserHash) {
      const rows=await sql`UPDATE social_oauth_attempts a SET phase='exchanging'
        WHERE a.provider=${provider} AND a.state_hash=${stateHash} AND a.browser_hash=${browserHash} AND a.phase='started' AND a.expires_at>now()
        AND EXISTS(SELECT 1 FROM store_members sm WHERE sm.store_id=a.store_id AND sm.auth_subject=a.auth_subject AND sm.role='owner') RETURNING a.*`;
      return rows[0] ? attempt(rows[0]) : null;
    },
    async readyAttempt(id,encryptedToken,expiresAt,resultHash) {
      const rows=await sql`UPDATE social_oauth_attempts a SET encrypted_token=${encryptedToken},token_expires_at=${expiresAt}::timestamptz,result_hash=${resultHash},phase='ready'
        WHERE id=${id}::uuid AND phase='exchanging' AND expires_at>now()
        AND EXISTS(SELECT 1 FROM store_members sm WHERE sm.store_id=a.store_id AND sm.auth_subject=a.auth_subject AND sm.role='owner') RETURNING id`;
      return rows.length>0;
    },
    async failAttempt(id) {
      await sql`UPDATE social_oauth_attempts SET phase='failed',encrypted_token=NULL,result_hash=NULL WHERE id=${id}::uuid AND phase<>'finished'`;
    },
    async finishAttempt(subject,storeId,id,resultHash) {
      const rows=await sql`WITH owned AS MATERIALIZED (
        SELECT s.id FROM stores s JOIN store_members sm ON sm.store_id=s.id
        WHERE s.id=${storeId}::uuid AND sm.auth_subject=${subject} AND sm.role='owner' FOR UPDATE OF s,sm
      ), permitted AS MATERIALIZED (
        SELECT a.* FROM social_oauth_attempts a JOIN owned o ON o.id=a.store_id
        WHERE a.id=${id}::uuid AND a.store_id=${storeId}::uuid AND a.auth_subject=${subject}
          AND a.result_hash=${resultHash} AND a.phase IN ('ready','finished') AND a.expires_at>now() AND a.token_expires_at>now()
        FOR UPDATE OF a
      ), connected AS (
        INSERT INTO store_social_connections(store_id,provider,revision,encrypted_token,status,connected_at,expires_at)
        SELECT store_id,provider,id,encrypted_token,'connected',now(),token_expires_at FROM permitted WHERE phase='ready' AND encrypted_token IS NOT NULL
        ON CONFLICT(store_id,provider) DO UPDATE SET revision=EXCLUDED.revision,encrypted_token=EXCLUDED.encrypted_token,status='connected',
          connected_at=now(),expires_at=EXCLUDED.expires_at,account_name=NULL,last_error=NULL
        RETURNING revision
      ), finished AS (
        UPDATE social_oauth_attempts a SET phase='finished',encrypted_token=NULL FROM permitted p
        WHERE a.id=p.id AND p.phase='ready' AND EXISTS(SELECT 1 FROM connected) RETURNING a.id
      ) SELECT EXISTS(SELECT 1 FROM finished) OR EXISTS(
        SELECT 1 FROM permitted p JOIN store_social_connections c ON c.store_id=p.store_id AND c.provider=p.provider
        WHERE p.phase='finished' AND c.revision=p.id AND c.status<>'disconnected'
      ) AS ok`;
      return Boolean(rows[0]?.ok);
    },
    async getConnection(subject,storeId,provider) {
      const rows=await sql`SELECT c.provider,c.revision,c.encrypted_token,c.expires_at FROM store_social_connections c JOIN store_members sm ON sm.store_id=c.store_id
        WHERE c.store_id=${storeId}::uuid AND c.provider=${provider} AND sm.auth_subject=${subject} AND sm.role='owner'
        AND c.status IN ('connected','degraded') AND c.encrypted_token IS NOT NULL AND c.expires_at>now()`;
      return rows[0] ? {provider:rows[0].provider,revision:rows[0].revision,encryptedToken:rows[0].encrypted_token,expiresAt:new Date(rows[0].expires_at).toISOString()} : null;
    },
    async markError(subject,storeId,provider,revision,error) {
      await sql`UPDATE store_social_connections c SET status='degraded',last_error=${error}
        WHERE c.store_id=${storeId}::uuid AND c.provider=${provider} AND c.revision=${revision} AND c.status<>'disconnected'
        AND EXISTS(SELECT 1 FROM store_members sm WHERE sm.store_id=c.store_id AND sm.auth_subject=${subject} AND sm.role='owner')`;
    },
    async disconnect(subject,storeId,provider) {
      const rows=await sql`WITH owned AS MATERIALIZED (
        SELECT s.id FROM stores s JOIN store_members sm ON sm.store_id=s.id
        WHERE s.id=${storeId}::uuid AND sm.auth_subject=${subject} AND sm.role='owner' FOR UPDATE OF s,sm
      ), attempts AS (DELETE FROM social_oauth_attempts WHERE store_id IN (SELECT id FROM owned) AND provider=${provider}),
      previews AS (DELETE FROM store_social_previews WHERE store_id IN (SELECT id FROM owned) AND provider=${provider})
      INSERT INTO store_social_connections(store_id,provider,revision,status) SELECT id,${provider},${crypto.randomUUID()}::uuid,'disconnected' FROM owned
      ON CONFLICT(store_id,provider) DO UPDATE SET revision=EXCLUDED.revision,status='disconnected',encrypted_token=NULL,account_name=NULL,
        expires_at=NULL,connected_at=NULL,last_error=NULL RETURNING store_id`;
      return rows.length>0;
    },
    async createPreview(subject,storeId,provider,revision,account) {
      const rows=await sql`INSERT INTO store_social_previews(id,store_id,provider,connection_revision,auth_subject,account_name,profile_url,proposed_values,baseline_values,truncated_fields,expires_at)
        SELECT ${crypto.randomUUID()}::uuid,s.id,${provider},c.revision,${subject},${account.name},${account.profileUrl},${JSON.stringify(account.values)}::jsonb,
          jsonb_build_object('name',s.name,'description',COALESCE(s.description,''),'businessLocation',COALESCE(s.business_location,''),'contactEmail',COALESCE(s.contact_email,'')),
          ${JSON.stringify(account.truncatedFields)}::jsonb,now()+interval '10 minutes'
        FROM stores s JOIN store_members sm ON sm.store_id=s.id JOIN store_social_connections c ON c.store_id=s.id AND c.provider=${provider}
        WHERE s.id=${storeId}::uuid AND sm.auth_subject=${subject} AND sm.role='owner' AND c.revision=${revision}::uuid
          AND c.status IN ('connected','degraded') AND c.encrypted_token IS NOT NULL AND c.expires_at>now()
        RETURNING *`;
      return rows[0] ? preview(rows[0]) : null;
    },
    async getPreview(subject,storeId,id) {
      const rows=await sql`SELECT p.* FROM store_social_previews p JOIN store_members sm ON sm.store_id=p.store_id
        WHERE p.id=${id}::uuid AND p.store_id=${storeId}::uuid AND p.auth_subject=${subject} AND sm.auth_subject=${subject} AND sm.role='owner'`;
      return rows[0] ? preview(rows[0]) : null;
    },
    async applyPreview(subject,storeId,id,fields) {
      const selected=JSON.stringify(fields);
      const rows=await sql`WITH owned AS MATERIALIZED (
        SELECT s.* FROM stores s JOIN store_members sm ON sm.store_id=s.id
        WHERE s.id=${storeId}::uuid AND sm.auth_subject=${subject} AND sm.role='owner' FOR UPDATE OF s,sm
      ), locked AS MATERIALIZED (
        SELECT p.*,c.revision,c.status,c.expires_at AS connection_expiry,
          jsonb_build_object('name',s.name,'description',COALESCE(s.description,''),'businessLocation',COALESCE(s.business_location,''),'contactEmail',COALESCE(s.contact_email,'')) AS current_values
        FROM store_social_previews p JOIN owned s ON s.id=p.store_id
        JOIN store_social_connections c ON c.store_id=s.id AND c.provider=p.provider
        WHERE p.id=${id}::uuid AND p.store_id=${storeId}::uuid AND p.auth_subject=${subject}
        FOR UPDATE OF p,c
      ), decision AS MATERIALIZED (
        SELECT l.*,CASE
          WHEN applied_fields IS NOT NULL THEN CASE WHEN applied_fields=${selected}::jsonb THEN 'already_applied' ELSE 'used' END
          WHEN expires_at<=now() OR connection_expiry<=now() THEN 'expired'
          WHEN status='disconnected' OR connection_revision<>revision THEN 'changed'
          WHEN EXISTS(SELECT 1 FROM jsonb_array_elements_text(${selected}::jsonb) f WHERE NOT proposed_values ? f OR (current_values->>f) IS DISTINCT FROM (baseline_values->>f)) THEN 'changed'
          ELSE 'applied' END AS outcome FROM locked l
      ), saved AS (
        UPDATE stores s SET name=CASE WHEN ${selected}::jsonb ? 'name' THEN d.proposed_values->>'name' ELSE s.name END,
          description=CASE WHEN ${selected}::jsonb ? 'description' THEN d.proposed_values->>'description' ELSE s.description END,
          business_location=CASE WHEN ${selected}::jsonb ? 'businessLocation' THEN d.proposed_values->>'businessLocation' ELSE s.business_location END,
          contact_email=CASE WHEN ${selected}::jsonb ? 'contactEmail' THEN d.proposed_values->>'contactEmail' ELSE s.contact_email END,updated_at=now()
        FROM decision d WHERE s.id=d.store_id AND d.outcome='applied' RETURNING s.id
      ), consumed AS (
        UPDATE store_social_previews p SET applied_fields=${selected}::jsonb,applied_at=now() FROM decision d
        WHERE p.id=d.id AND EXISTS(SELECT 1 FROM saved) RETURNING p.id
      ), marked AS (
        UPDATE store_social_connections c SET account_name=d.account_name,imported_at=now(),last_error=NULL,status='connected'
        FROM decision d WHERE c.store_id=d.store_id AND c.provider=d.provider AND c.revision=d.revision AND EXISTS(SELECT 1 FROM consumed) RETURNING c.store_id
      ) SELECT outcome FROM decision`;
      return rows[0]?.outcome || "not_found";
    }
  };
}
