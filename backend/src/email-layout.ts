// Adapted from RoadmapMentor/server/services/emailLayout.ts at 03ab038d8ccd1d2085add92657beb7bd3931b076.
// Pure rendering, escaped user values, and a button that survives email clients stripping <style>.
export type EmailLanguage = "fr" | "en";

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function renderButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0"><tr><td bgcolor="#142d25" style="border-radius:10px;text-align:center"><a href="${escapeHtml(href)}" style="display:inline-block;padding:16px 28px;border:1px solid #142d25;border-radius:10px;color:#ffffff;background:#142d25;font-size:16px;font-weight:700;text-decoration:none">${escapeHtml(label)}</a></td></tr></table>`;
}

export function renderBrandedEmail(input: {
  language: EmailLanguage; appOrigin: string; subject: string; preheader: string;
  title: string; subtitle: string; bodyHtml: string; recipient: string; year: number;
}): string {
  const fr = input.language === "fr";
  const origin = escapeHtml(input.appOrigin);
  return `<!DOCTYPE html>
<html lang="${input.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(input.subject)}</title></head>
<body style="margin:0;padding:0;background:#fbf5eb;color:#142d25;font-family:Arial,Helvetica,sans-serif;line-height:1.6;-webkit-text-size-adjust:100%">
<div aria-hidden="true" style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#fbf5eb" style="background-color:#fbf5eb;color:#142d25"><tr><td align="center" style="padding:32px 16px;color:#142d25">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px">
<tr><td style="padding:0 8px 24px;color:#142d25"><a href="${origin}" aria-label="Commerce Factory by Trigenys" style="display:inline-block;text-decoration:none;color:#142d25;line-height:1.2"><span style="font-size:25px;font-weight:700;color:#142d25">Commerce <span style="color:#8a0b37">Factory</span></span><br><span style="font-size:11px;letter-spacing:1px;color:#4a6155">by Trigenys</span></a></td></tr>
<tr><td bgcolor="#fffdf8" style="color:#142d25;background-color:#fffdf8;border:1px solid #d8d5c5;border-top:4px solid #b34729;border-radius:14px;padding:28px 24px">
<p style="margin:0 0 12px;color:#4a6155;font-size:13px;font-weight:700">${escapeHtml(input.subtitle)}</p>
<h1 style="margin:0 0 24px;font-size:28px;line-height:1.25;letter-spacing:-.5px;color:#142d25">${escapeHtml(input.title)}</h1>
${input.bodyHtml}
<p style="margin:28px 0 0;font-size:14px;color:#142d25">${fr ? "À bientôt," : "See you soon,"}<br><strong style="color:#142d25">${fr ? "L’équipe Commerce Factory" : "The Commerce Factory team"}</strong></p>
</td></tr>
<tr><td style="padding:24px 8px 0;font-size:12px;color:#4a6155">
<p style="margin:0 0 12px;color:#4a6155"><a href="${origin}/help" style="color:#142d25">${fr ? "Besoin d’aide ?" : "Need help?"}</a> &nbsp;·&nbsp; <a href="${origin}/privacy" style="color:#142d25">${fr ? "Confidentialité" : "Privacy"}</a></p>
<p style="margin:0 0 8px;overflow-wrap:anywhere;word-break:break-word;color:#4a6155">${fr ? "Email envoyé à" : "Email sent to"} ${escapeHtml(input.recipient)}.</p>
<p style="margin:0;color:#4a6155">© ${input.year} Commerce Factory by Trigenys</p>
</td></tr></table></td></tr></table></body></html>`;
}
