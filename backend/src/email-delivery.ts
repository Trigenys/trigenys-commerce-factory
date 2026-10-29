import type { RenderedEmail } from "./auth-email-templates.ts";

export class EmailDeliveryError extends Error {
  readonly status?: number;
  constructor(status?: number) { super("EMAIL_DELIVERY_FAILED"); this.status = status; }
}

// Commerce owns its content. Trigenys Notify owns SMTP credentials and durable delivery receipts.
export async function sendTransactionalEmail(input: {
  baseUrl: string; ingestKey: string; recipient: string; idempotencyKey: string;
  occurredAt: string; expiresAt: string; message: RenderedEmail;
}, fetcher: typeof fetch = fetch): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  try {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.idempotencyKey)));
    const id = Array.from(digest, b => b.toString(16).padStart(2, "0")).join("");
    const response = await fetcher(new URL("/v1/dispatch/commerce-factory/email", input.baseUrl), {
      method: "POST", redirect: "manual", signal: controller.signal,
      headers: { "x-notify-auth": input.ingestKey, "Content-Type": "application/json" },
      body: JSON.stringify({ version: 1, project: "commerce-factory", id, occurredAt: input.occurredAt,
        expiresAt: input.expiresAt, recipient: input.recipient, message: input.message })
    });
    // Workers supports manual redirect handling. Never forward the ingest key to a redirect target.
    if (response.status !== 202) { await response.body?.cancel(); throw new EmailDeliveryError(response.status); }
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("accepted" in result) || result.accepted !== true ||
      !("project" in result) || result.project !== "commerce-factory" || !("channel" in result) || result.channel !== "email" ||
      !("eventId" in result) || result.eventId !== id) throw new EmailDeliveryError(response.status);
  } catch (error) {
    throw error instanceof EmailDeliveryError ? error : new EmailDeliveryError();
  } finally { clearTimeout(timer); }
}
