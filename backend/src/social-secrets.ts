const encoder = new TextEncoder();
const bytes = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0));
const base64 = (value: Uint8Array) => btoa(String.fromCharCode(...value));

export function validEncryptionKey(value: string | undefined): boolean {
  try { return Boolean(value && /^[A-Za-z0-9+/]{43}=$/.test(value) && bytes(value).length === 32); }
  catch { return false; }
}
async function key(value: string) {
  if (!validEncryptionKey(value)) throw new Error("SOCIAL_ENCRYPTION_NOT_CONFIGURED");
  return crypto.subtle.importKey("raw", bytes(value), "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function hashSecret(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))), b => b.toString(16).padStart(2, "0")).join("");
}
export function randomSecret(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
}
export async function encryptToken(value: unknown, encryptionKey: string, context: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:encoder.encode(context)}, await key(encryptionKey), encoder.encode(JSON.stringify(value)));
  return "v1." + base64(iv) + "." + base64(new Uint8Array(encrypted));
}
export async function decryptToken(value: string, encryptionKey: string, context: string): Promise<unknown> {
  const [version,iv,cipher,...extra] = value.split(".");
  if (version !== "v1" || !iv || !cipher || extra.length || value.length > 32768) throw new Error("INVALID_SOCIAL_CIPHERTEXT");
  const plain = await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(iv),additionalData:encoder.encode(context)}, await key(encryptionKey), bytes(cipher));
  return JSON.parse(new TextDecoder().decode(plain));
}
