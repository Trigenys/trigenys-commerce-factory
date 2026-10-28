import { useEffect, useRef, useState, type FormEvent } from "react";
import type { CommerceAuthClient } from "./auth";
import { getSessionSnapshot } from "./auth";
import { signInWithGoogle } from "./google-access";
import { sendEmailLink } from "./email-link-access";

type Mode = "signup" | "signin" | "forgot" | "reset" | "verify";
const texts = {
  fr: { title:"Construisez votre boutique.", body:"Créez un compte ou retrouvez votre espace marchand.", signup:"Créer un compte", signin:"Connexion", name:"Votre nom", email:"Email", password:"Mot de passe", confirm:"Confirmer le mot de passe", show:"Afficher le mot de passe", hide:"Masquer le mot de passe", hint:"8 caractères minimum", continue:"Continuer", busy:"Veuillez patienter…", forgot:"Mot de passe oublié ?", send:"Recevoir un code", reset:"Réinitialiser le mot de passe", code:"Code reçu par email", recoveryTitle:"Retrouvez votre compte", recoveryBody:"Si un compte correspond à cet email, un code de récupération sera envoyé. Vérifiez aussi les indésirables.", resetTitle:"Choisissez un nouveau mot de passe", resetBody:"Collez le code reçu et saisissez votre nouveau mot de passe.", error:"L’opération n’a pas abouti. Vérifiez vos informations et réessayez.", mismatch:"Les deux mots de passe doivent être identiques.", resetDone:"Mot de passe modifié. Connectez-vous pour reprendre.", created:"Compte créé. Connectez-vous pour continuer.", expired:"Ce code est invalide ou expiré. Demandez-en un nouveau.", resend:"Renvoyer un code", sent:"Si le compte existe, un nouveau code a été envoyé.", verifyTitle:"Vérifiez votre email", verifyBody:"Pour rejoindre une équipe, vérifiez cet email avec le code reçu.", verify:"Vérifier mon email", verified:"Email vérifié. Vous pouvez reprendre l’invitation.", terms:"J’accepte les conditions d’utilisation", privacy:"Politique de confidentialité", generic:"Réessayez dans quelques instants. Aucun brouillon n’est perdu." },
  en: { title:"Build your store.", body:"Create an account or return to your merchant workspace.", signup:"Create an account", signin:"Log in", name:"Your name", email:"Email", password:"Password", confirm:"Confirm password", show:"Show password", hide:"Hide password", hint:"At least 8 characters", continue:"Continue", busy:"Please wait…", forgot:"Forgot password?", send:"Send a code", reset:"Reset password", code:"Code received by email", recoveryTitle:"Recover your account", recoveryBody:"If an account matches this email, a recovery code will be sent. Check your spam folder too.", resetTitle:"Choose a new password", resetBody:"Paste the code you received and enter your new password.", error:"This did not complete. Check your information and try again.", mismatch:"Both passwords must match.", resetDone:"Password updated. Log in to resume.", created:"Account created. Log in to continue.", expired:"This code is invalid or expired. Request another code.", resend:"Send another code", sent:"If the account exists, a new code has been sent.", verifyTitle:"Verify your email", verifyBody:"Verify this email using the code before joining a team.", verify:"Verify my email", verified:"Email verified. You can resume the invitation.", terms:"I accept the terms of use", privacy:"Privacy policy", generic:"Try again in a moment. Your saved drafts are safe." }
};

const emailLinkTexts = {
  fr: { method:"Lien par email", password:"Mot de passe", methods:"Méthode de connexion par email", hint:"Recevez un lien de connexion par email, sans mot de passe.", send:"Recevoir mon lien de connexion", resend:"Renvoyer le lien", sent:"Si cette adresse peut se connecter, un lien va vous être envoyé. Vérifiez aussi les indésirables. Ce lien est personnel et valable pour une durée limitée.", change:"Modifier l’email", wait:"Nouveau lien dans ", error:"Impossible d’envoyer le lien pour le moment. Réessayez ou choisissez une autre méthode.", expired:"Ce lien a expiré, a déjà été utilisé ou n’a pas permis d’ouvrir une session. Demandez un nouveau lien.", legal:"Un compte sera créé si nécessaire. En demandant ce lien, vous acceptez nos " },
  en: { method:"Email link", password:"Password", methods:"Email sign-in method", hint:"Receive a sign-in link by email, without a password.", send:"Send my sign-in link", resend:"Resend link", sent:"If this address can sign in, a link will be sent to you. Check your spam folder too. This link is personal and valid for a limited time.", change:"Change email", wait:"New link in ", error:"We could not send the link right now. Try again or choose another method.", expired:"This link has expired, was already used or could not open a session. Request a new link.", legal:"An account will be created if needed. By requesting this link, you accept our " }
};

export default function AccountAccess({ client, language, onAuthenticated, verificationEmail, onVerified, googleEnabled = false, googleFeedback, emailLinkEnabled = false, emailLinkFeedback }: {
  client: CommerceAuthClient; language:"fr"|"en"; onAuthenticated: () => Promise<void>;
  verificationEmail?: string; onVerified?: () => Promise<void>;
  googleEnabled?: boolean; googleFeedback?: "failed" | "missing-session" | null;
  emailLinkEnabled?: boolean; emailLinkFeedback?: "failed" | "missing-session" | null;
}) {
  const t = texts[language];
  const linkText = emailLinkTexts[language];
  const [mode, setMode] = useState<Mode>(verificationEmail ? "verify" : window.location.pathname.endsWith("/login") ? "signin" : "signup");
  const [name,setName] = useState("");
  const [email,setEmail] = useState(verificationEmail || "");
  const [password,setPassword] = useState("");
  const [confirm,setConfirm] = useState("");
  const [otp,setOtp] = useState("");
  const [visible,setVisible] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");
  const [resendAt,setResendAt] = useState(0);
  const [seconds,setSeconds]=useState(0);
  const [consent,setConsent]=useState(false);
  const [googleBusy,setGoogleBusy]=useState(false);
  const [emailMethod,setEmailMethod]=useState<"password"|"link">(emailLinkFeedback && emailLinkEnabled ? "link" : "password");
  const [linkSent,setLinkSent]=useState(false);
  const linkNotice=useRef<HTMLParagraphElement>(null);
  useEffect(()=>{if(googleFeedback)setError(language === "fr" ? "La connexion Google n’a pas abouti. Réessayez ou utilisez votre email." : "Google sign-in did not complete. Try again or use your email.");},[googleFeedback,language]);
  useEffect(()=>{if(emailLinkFeedback)setError(linkText.expired);},[emailLinkFeedback,linkText.expired]);
  useEffect(()=>{if(linkSent)linkNotice.current?.focus();},[linkSent]);
  useEffect(()=>{const tick=()=>setSeconds(Math.max(0,Math.ceil((resendAt-Date.now())/1000)));tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);},[resendAt]);
  function change(next:Mode) { setMode(next);setError("");setMessage("");setPassword("");setConfirm("");setOtp("");setLinkSent(false); }
  async function sendCode() {
    if (Date.now() < resendAt) return;
    setBusy(true);setError("");
    try {
      const result = mode === "verify"
        ? await client.emailOtp.sendVerificationOtp({ email:email.trim(),type:"email-verification" })
        : await client.emailOtp.requestPasswordReset({ email:email.trim() });
      if (result.error) { setError(t.generic);return; }
      setResendAt(Date.now()+30000);
      if (mode === "forgot") change("reset");
      setMessage(mode === "verify" ? (language === "fr" ? "Un code a été envoyé à votre email." : "A code was sent to your email.") : t.sent);
    } catch { setError(t.generic); } finally { setBusy(false); }
  }
  async function submit(event:FormEvent) {
    event.preventDefault();
    if (busy || googleBusy) return;
    if (mode === "signup" && !consent) { setError(t.terms); return; }
    if ((mode === "signup" || mode === "signin") && emailMethod === "link" && emailLinkEnabled) {
      if (Date.now() < resendAt) return;
      setBusy(true);setError("");setMessage("");
      try {
        await sendEmailLink(client,email,mode === "signup" ? name : undefined,language);
        setResendAt(Date.now()+30000);setLinkSent(true);
      } catch { setError(linkText.error); } finally { setBusy(false); }
      return;
    }
    if (mode === "forgot") { await sendCode(); return; }
    if (mode === "reset" && password !== confirm) { setError(t.mismatch); return; }
    setBusy(true);setError("");setMessage("");
    try {
      if (mode === "reset") {
        const result = await client.emailOtp.resetPassword({email:email.trim(),otp:otp.trim(),password});
        if (result.error) {setError(t.expired);return;}
        change("signin");setMessage(t.resetDone);return;
      }
      if (mode === "verify") {
        const result = await client.emailOtp.verifyEmail({email:email.trim(),otp:otp.trim()});
        if (result.error) {setError(t.expired);return;}
        setMessage(t.verified);await onVerified?.();return;
      }
      const result = mode === "signup"
        ? await client.signUp.email({name:name.trim(),email:email.trim(),password})
        : await client.signIn.email({email:email.trim(),password});
      if (result.error) {setError(t.error);return;}
      const session = await getSessionSnapshot(client);
      if (!session.authenticated) {change("signin");setMessage(t.created);return;}
      await onAuthenticated();
    } catch {setError(t.generic);} finally {setBusy(false);}
  }
  const recovery = mode === "forgot" || mode === "reset" || mode === "verify";
  const useEmailLink = !recovery && emailMethod === "link" && emailLinkEnabled;
  function chooseEmailMethod(method:"password"|"link") {
    setEmailMethod(method);setError("");setMessage("");setPassword("");setLinkSent(false);
  }
  async function google() {
    if (busy || googleBusy) return;
    if (mode === "signup" && !consent) {
      setError(language === "fr" ? "Acceptez les conditions d’utilisation pour créer votre compte." : "Accept the terms of use to create your account.");
      document.getElementById("account-consent")?.focus(); return;
    }
    setGoogleBusy(true);setError("");setMessage("");
    try { await signInWithGoogle(client); }
    catch { setError(language === "fr" ? "La connexion Google a été interrompue ou n’a pas pu démarrer. Réessayez ou utilisez votre email." : "Google sign-in was interrupted or could not start. Try again or use your email."); }
    finally { setGoogleBusy(false); }
  }
  return <main className="auth-layout" id="merchant-main" tabIndex={-1}>
    <section className="auth-copy"><span className="admin-eyebrow">Commerce Factory</span>
      <h1>{mode === "forgot" ? t.recoveryTitle : mode === "reset" ? t.resetTitle : mode === "verify" ? t.verifyTitle : t.title}</h1>
      <p>{mode === "forgot" ? t.recoveryBody : mode === "reset" ? t.resetBody : mode === "verify" ? t.verifyBody : t.body}</p>
      <div className="auth-benefits"><span>✓ WhatsApp</span><span>✓ FCFA</span><span>✓ Mobile</span></div>
    </section>
    <section className="auth-card" aria-label={recovery ? t.recoveryTitle : t.signin}>
      {!recovery && <div className="auth-tabs" role="group" aria-label={language === "fr" ? "Accès au compte" : "Account access"}>
        <button type="button" disabled={busy || googleBusy} aria-pressed={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={()=>change("signup")}>{t.signup}</button>
        <button type="button" disabled={busy || googleBusy} aria-pressed={mode === "signin"} className={mode === "signin" ? "active" : ""} onClick={()=>change("signin")}>{t.signin}</button>
      </div>}
      {mode === "signup" && googleEnabled && <label className="consent-row"><input id="account-consent" form="commerce-account-form" type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required /><span>{t.terms} (<a href="/terms" target="_blank" rel="noreferrer">{language === "fr" ? "Lire" : "Read"}</a>). <a href="/privacy" target="_blank" rel="noreferrer">{t.privacy}</a></span></label>}
      {!recovery && googleEnabled && <div className="auth-social">
        <button className="auth-google" type="button" onClick={google} disabled={busy || googleBusy} aria-busy={googleBusy}>
          <svg aria-hidden="true" viewBox="0 0 48 48" width="22" height="22"><path fill="#4285f4" d="M43.6 24.5c0-1.5-.1-3-.4-4.5H24v8.5h11a9.5 9.5 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.9 6.1-15.2Z"/><path fill="#34a853" d="M24 44c5.5 0 10.2-1.8 13.5-4.9l-6.6-5A12.3 12.3 0 0 1 24 36c-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20.4 20.4 0 0 0 24 44Z"/><path fill="#fbbc05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.2H5.8a20 20 0 0 0 0 17.6l6.8-5.2Z"/><path fill="#ea4335" d="M24 12c3 0 5.6 1 7.7 3l5.8-5.8A19.7 19.7 0 0 0 24 4 20.4 20.4 0 0 0 5.8 15.2l6.8 5.2C14.2 15.6 18.7 12 24 12Z"/></svg>
          {googleBusy ? (language === "fr" ? "Ouverture de Google…" : "Opening Google…") : (language === "fr" ? "Continuer avec Google" : "Continue with Google")}
        </button>
        {mode === "signin" && <small>
          {language === "fr" ? "Si vous n’avez pas de compte, il sera créé. En continuant avec Google, vous acceptez nos " : "If you don’t have an account, one will be created. By continuing with Google, you accept our "}
          <a href="/terms" target="_blank" rel="noreferrer">{language === "fr" ? "conditions d’utilisation" : "terms of use"}</a>.
          {" "}<a href="/privacy" target="_blank" rel="noreferrer">{t.privacy}</a>.
        </small>}
        <div className="auth-divider"><span>{language === "fr" ? "ou avec votre email" : "or with your email"}</span></div>
      </div>}
      {!recovery && emailLinkEnabled && <div className="auth-tabs" role="group" aria-label={linkText.methods}>
        <button type="button" disabled={busy || googleBusy} aria-pressed={emailMethod === "link"} className={emailMethod === "link" ? "active" : ""} onClick={()=>chooseEmailMethod("link")}>{linkText.method}</button>
        <button type="button" disabled={busy || googleBusy} aria-pressed={emailMethod === "password"} className={emailMethod === "password" ? "active" : ""} onClick={()=>chooseEmailMethod("password")}>{linkText.password}</button>
      </div>}
      <form id="commerce-account-form" onSubmit={submit} className="admin-form" aria-busy={busy || googleBusy}>
        {mode === "signup" && <label><span>{t.name}</span><input autoComplete="name" value={name} onChange={e=>setName(e.target.value)} readOnly={useEmailLink && (busy || linkSent)} maxLength={120} required /></label>}
        <label><span>{t.email}</span><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} readOnly={Boolean(verificationEmail) || useEmailLink && (busy || linkSent)} maxLength={254} required /></label>
        {useEmailLink && <p className="draft-note">{linkText.hint}</p>}
        {(mode === "reset" || mode === "verify") && <label><span>{t.code}</span><input value={otp} onChange={e=>setOtp(e.target.value)} autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required /></label>}
        {mode !== "forgot" && mode !== "verify" && !useEmailLink && <label><span>{t.password}</span><input aria-label={t.password} type={visible ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={e=>setPassword(e.target.value)} minLength={8} maxLength={128} required aria-describedby="password-hint" /><small id="password-hint">{t.hint}</small></label>}
        {mode === "reset" && <label><span>{t.confirm}</span><input type={visible ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={8} maxLength={128} required /></label>}
        {mode !== "forgot" && mode !== "verify" && !useEmailLink && <button type="button" className="auth-switch" aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible ? t.hide : t.show}</button>}
        {mode === "signup" && !googleEnabled && <label className="consent-row"><input id="account-consent" type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required /><span>{t.terms} (<a href="/terms" target="_blank" rel="noreferrer">{language === "fr" ? "Lire" : "Read"}</a>). <a href="/privacy" target="_blank" rel="noreferrer">{t.privacy}</a></span></label>}
        {error && <p className="form-message error" role="alert">{error}</p>}
        {message && <p className="form-message success" role="status">{message}</p>}
        {useEmailLink && linkSent && <p ref={linkNotice} tabIndex={-1} className="form-message success" role="status">{linkText.sent}</p>}
        {useEmailLink && mode === "signin" && <small>{linkText.legal}<a href="/terms" target="_blank" rel="noreferrer">{language === "fr" ? "conditions d’utilisation" : "terms of use"}</a>. <a href="/privacy" target="_blank" rel="noreferrer">{t.privacy}</a>.</small>}
        <button className="admin-primary" type="submit" disabled={busy || googleBusy || useEmailLink && seconds>0}>{busy ? t.busy : useEmailLink ? (seconds>0 ? linkText.wait+seconds+" s" : linkSent ? linkText.resend : linkText.send) : mode === "forgot" ? t.send : mode === "reset" ? t.reset : mode === "verify" ? t.verify : t.continue}</button>
        {useEmailLink && linkSent && <button type="button" className="auth-switch" disabled={busy || googleBusy} onClick={()=>{setLinkSent(false);setError("");document.querySelector<HTMLInputElement>("#commerce-account-form input[type=email]")?.focus();}}>{linkText.change}</button>}
      </form>
      {mode === "signin" && !useEmailLink && <button type="button" className="auth-switch" onClick={()=>change("forgot")}>{t.forgot}</button>}
      {(mode === "reset" || mode === "verify") && <button type="button" className="auth-switch" onClick={sendCode} disabled={busy || seconds>0}>{seconds>0 ? (language === "fr" ? "Nouveau code dans " : "New code in ")+seconds+" s" : resendAt ? t.resend : t.send}</button>}
      {recovery && !verificationEmail && <button type="button" className="auth-switch" onClick={()=>change("signin")}>← {t.signin}</button>}
      <a className="auth-switch" href="/help">{language === "fr" ? "Besoin d’aide ?" : "Need help?"}</a>
    </section>
  </main>;
}
