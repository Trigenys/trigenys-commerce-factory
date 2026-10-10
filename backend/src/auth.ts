import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Identity } from "./types.ts";

export type IdentityVerifier = (
  token: string,
  authBaseUrl: string
) => Promise<Identity>;

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function normalizedAuthUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("Auth base URL must use HTTPS.");
  }
  return url;
}

export const verifyNeonIdentity: IdentityVerifier = async (
  token,
  authBaseUrl
) => {
  const authUrl = normalizedAuthUrl(authBaseUrl);
  const cacheKey = authUrl.toString().replace(/\/$/, "");
  let jwks = jwksCache.get(cacheKey);

  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(cacheKey + "/.well-known/jwks.json"),
      { cooldownDuration: 30_000, cacheMaxAge: 10 * 60_000 }
    );
    jwksCache.set(cacheKey, jwks);
  }

  const issuer = authUrl.origin;
  const { payload } = await jwtVerify(token, jwks, {
    algorithms: ["EdDSA"],
    issuer,
    audience: issuer
  });

  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new Error("Authenticated token has no subject.");
  }

  return {
    subject: payload.sub,
    emailVerified: payload.emailVerified === true || payload.email_verified === true,
    ...(typeof payload.email === "string" ? { email: payload.email } : {})
  };
};

export function bearerToken(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1] || null;
}
