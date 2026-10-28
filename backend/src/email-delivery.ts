import type { RenderedEmail } from "./auth-email-templates.ts";

// Same Resend delivery contract as RoadmapMentor's EmailService, over the native Workers HTTP API.
// No SMTP credentials, extra SDK, recipient logs, tokens, or provider error bodies leave this module.
export async function sendTransactionalEmail(input: {
  apiKey: string; from: string; recipient: string; idempotencyKey: string; message: RenderedEmail;
}, fetcher: typeof fetch = fetch): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST", redirect: "error", signal: controller.signal,
      headers: { Authorization: "Bearer " + input.apiKey, "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey },
      body: JSON.stringify({ from: input.from, to: [input.recipient], ...input.message })
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("EMAIL_DELIVERY_FAILED");
    }
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("id" in result) || typeof result.id !== "string" || !result.id) {
      throw new Error("EMAIL_DELIVERY_FAILED");
    }
  } catch {
    // Includes provider 429/5xx, idempotency conflicts, redirects, timeouts and ambiguous responses.
    // Let Neon retry the same event; never acknowledge an email that was not accepted.
    throw new Error("EMAIL_DELIVERY_FAILED");
  } finally {
    clearTimeout(timer);
  }
}
