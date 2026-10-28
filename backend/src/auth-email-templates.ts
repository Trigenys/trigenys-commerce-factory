import { escapeHtml, renderBrandedEmail, renderButton, type EmailLanguage } from "./email-layout.ts";

export type AuthEmailPurpose = "sign-in" | "email-verification" | "forget-password";
export type AuthEmailMessage = {
  recipient: string; name?: string; language: EmailLanguage; appOrigin: string;
  purpose: AuthEmailPurpose; issuedAt: string; expiresAt: string;
} & ({ kind: "link"; url: string } | { kind: "otp"; code: string });

export type RenderedEmail = { subject: string; html: string; text: string };

// The rendering depends only on the signed event, never on the delivery attempt or current clock.
// Resend requires identical payloads when retrying the same idempotency key.
export function buildAuthEmail(input: AuthEmailMessage): RenderedEmail {
  const fr = input.language === "fr", link = input.kind === "link";
  const copy = fr ? {
    "sign-in": { subject: link ? "Votre lien de connexion" : "Votre code de connexion", title: "Retrouvez votre espace.", action: "Me connecter", intro: link ? "Cliquez sur le bouton pour vous connecter à Commerce Factory." : "Saisissez ce code dans Commerce Factory pour vous connecter." },
    "email-verification": { subject: "Confirmez votre adresse email", title: "Bienvenue chez vous.", action: "Confirmer mon email", intro: link ? "Confirmez votre adresse email pour poursuivre la configuration de votre compte." : "Saisissez ce code dans Commerce Factory pour confirmer votre adresse email." },
    "forget-password": { subject: "Réinitialisez votre mot de passe", title: "Retrouvez votre accès.", action: "Choisir un mot de passe", intro: link ? "Vous avez demandé à changer votre mot de passe. Le bouton ci-dessous vous permet d’en choisir un nouveau." : "Saisissez ce code dans Commerce Factory pour choisir un nouveau mot de passe." }
  } : {
    "sign-in": { subject: link ? "Your sign-in link" : "Your sign-in code", title: "Back to your workspace.", action: "Sign in", intro: link ? "Click the button to sign in to Commerce Factory." : "Enter this code in Commerce Factory to sign in." },
    "email-verification": { subject: "Confirm your email address", title: "Welcome to your space.", action: "Confirm my email", intro: link ? "Confirm your email address to continue setting up your account." : "Enter this code in Commerce Factory to confirm your email address." },
    "forget-password": { subject: "Reset your password", title: "Get back into your account.", action: "Choose a password", intro: link ? "You requested a password change. Use the button below to choose a new password." : "Enter this code in Commerce Factory to choose a new password." }
  };
  const c = copy[input.purpose], subject = c.subject + " · Commerce Factory";
  const expiry = new Intl.DateTimeFormat(fr ? "fr-FR" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(input.expiresAt)) + " UTC";
  const validity = fr ? `Expire le ${expiry}. À usage unique, ne le partagez pas.` : `Expires on ${expiry}. Single use; do not share it.`;
  const security = fr ? "Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer cet email." : "If you did not request this email, you can safely ignore it.";
  const greeting = (fr ? "Bonjour" : "Hello") + (input.name ? " " + input.name : "") + ",";
  const fallback = fr ? "Si le bouton ne fonctionne pas, ouvrez ce lien sécurisé." : "If the button does not work, open this secure link.";
  const valueHtml = input.kind === "link"
    ? renderButton(input.url, c.action) + `<p style="font-size:13px;margin:0 0 24px"><a href="${escapeHtml(input.url)}" style="color:#142d25;text-decoration:underline">${fallback}</a></p>`
    : `<div style="margin:28px 0;padding:24px 12px;background:#eee7d7;border:1px solid #d8d5c5;border-radius:12px;text-align:center"><p style="margin:0 0 8px;font-size:12px;color:#4a6155">${fr ? "Votre code de sécurité" : "Your security code"}</p><p style="margin:0;font-family:monospace;font-size:32px;font-weight:700;letter-spacing:7px;color:#142d25">${escapeHtml(input.code)}</p></div>`;
  const html = renderBrandedEmail({
    language: input.language, appOrigin: input.appOrigin, subject,
    preheader: c.subject + ". " + validity, title: c.title, subtitle: c.subject,
    recipient: input.recipient, year: new Date(input.issuedAt).getUTCFullYear(),
    bodyHtml: `<p style="margin:0 0 16px;font-size:16px">${escapeHtml(greeting)}</p><p style="margin:0;font-size:16px">${c.intro}</p>${valueHtml}<p style="margin:0 0 24px;font-size:13px;color:#4a6155">${escapeHtml(validity)}</p><p style="margin:0;padding:16px;background:#f1e9dc;border-left:3px solid #b34729;font-size:13px;color:#142d25">${security}</p>`
  });
  const text = ["Commerce Factory by Trigenys", c.subject, "", greeting, c.intro, "", input.kind === "link" ? c.action + ": " + input.url : (fr ? "Votre code : " : "Your code: ") + input.code, "", validity, security, "", fr ? "L’équipe Commerce Factory" : "The Commerce Factory team", (fr ? "Aide : " : "Help: ") + input.appOrigin + "/help", (fr ? "Confidentialité : " : "Privacy: ") + input.appOrigin + "/privacy"].join("\n");
  return { subject, html, text };
}
