import type { ImportField, SocialAccount, SocialConnection, SocialPreview, SocialProvider } from "../../shared/social-connections.ts";
import type { WorkerBindings } from "./types.ts";

export type ProviderToken = { accessToken: string; scopes: string[]; expiresAt: string };
export type SocialProviderAdapter = {
  authorizationUrl(state: string, redirectUri: string): string;
  exchange(code: string, redirectUri: string): Promise<ProviderToken>;
  accounts(token: ProviderToken, selectedId?: string): Promise<SocialAccount[]>;
};
export type SocialAdapterFactory = (provider: SocialProvider, env: WorkerBindings) => SocialProviderAdapter | null;
export type OAuthAttempt = {
  id: string; storeId: string; subject: string; provider: SocialProvider; redirectUri: string;
};
export type PrivateConnection = {
  provider: SocialProvider; revision: string; encryptedToken: string; expiresAt: string;
};
export type SocialRepository = {
  cleanupExpired(): Promise<void>;
  listConnections(subject: string, storeId: string): Promise<Omit<SocialConnection,"available">[] | null>;
  createAttempt(attempt: OAuthAttempt, startHash: string): Promise<boolean>;
  startAttempt(startHash: string, stateHash: string, browserHash: string): Promise<OAuthAttempt | null>;
  claimCallback(provider: SocialProvider, stateHash: string, browserHash: string): Promise<OAuthAttempt | null>;
  readyAttempt(id: string, encryptedToken: string, expiresAt: string, resultHash: string): Promise<boolean>;
  failAttempt(id: string): Promise<void>;
  finishAttempt(subject: string, storeId: string, id: string, resultHash: string): Promise<boolean>;
  getConnection(subject: string, storeId: string, provider: SocialProvider): Promise<PrivateConnection | null>;
  markError(subject: string, storeId: string, provider: SocialProvider, revision: string, error: SocialConnection["lastError"]): Promise<void>;
  disconnect(subject: string, storeId: string, provider: SocialProvider): Promise<boolean>;
  createPreview(subject: string, storeId: string, provider: SocialProvider, revision: string, account: SocialAccount): Promise<SocialPreview | null>;
  getPreview(subject: string, storeId: string, id: string): Promise<SocialPreview | null>;
  applyPreview(subject: string, storeId: string, id: string, fields: ImportField[]): Promise<"applied" | "already_applied" | "expired" | "changed" | "not_found" | "used">;
};
