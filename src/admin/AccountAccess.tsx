import { useEffect, useState, type FormEvent } from "react";
import type { CommerceAuthClient } from "./auth";
import { getSessionSnapshot } from "./auth";

type Mode = "signup" | "signin" | "forgot" | "reset" | "verify";
const texts = {
  fr: { title:"Construisez votre boutique.", body:"Créez un compte ou retrouvez votre espace marchand.", signup:"Créer un compte", signin:"Connexion", name:"Votre nom", email:"Email", password:"Mot de passe", confirm:"Confirmer le mot de passe", show:"Afficher le mot de passe", hide:"Masquer le mot de passe", hint:"8 caractères minimum", continue:"Continuer", busy:"Veuillez patienter…", forgot:"Mot de passe oublié ?", send:"Recevoir un code", reset:"Réinitialiser le mot de passe", code:"Code reçu par email", recoveryTitle:"Retrouvez votre compte", recoveryBody:"Si un compte correspond à cet email, un code de récupération sera envoyé. Vérifiez aussi les indésirables.", resetTitle:"Choisissez un nouveau mot de passe", resetBody:"Collez le code reçu et saisissez votre nouveau mot de passe.", error:"L’opération n’a pas abouti. Vérifiez vos informations et réessayez.", mismatch:"Les deux mots de passe doivent être identiques.", resetDone:"Mot de passe modifié. Connectez-vous pour reprendre.", created:"Compte créé. Connectez-vous pour continuer.", expired:"Ce code est invalide ou expiré. Demandez-en un nouveau.", resend:"Renvoyer un code", sent:"Si le compte existe, un nouveau code a été envoyé.", verifyTitle:"Vérifiez votre email", verifyBody:"Pour rejoindre une équipe, vérifiez cet email avec le code reçu.", verify:"Vérifier mon email", verified:"Email vérifié. Vous pouvez reprendre l’invitation.", terms:"J’accepte les conditions d’utilisation", privacy:"Politique de confidentialité", generic:"Réessayez dans quelques instants. Aucun brouillon n’est perdu." },
  en: { title:"Build your store.", body:"Create an account or return to your merchant workspace.", signup:"Create an account", signin:"Log in", name:"Your name", email:"Email", password:"Password", confirm:"Confirm password", show:"Show password", hide:"Hide password", hint:"At least 8 characters", continue:"Continue", busy:"Please wait…", forgot:"Forgot password?", send:"Send a code", reset:"Reset password", code:"Code received by email", recoveryTitle:"Recover your account", recoveryBody:"If an account matches this email, a recovery code will be sent. Check your spam folder too.", resetTitle:"Choose a new password", resetBody:"Paste the code you received and enter your new password.", error:"This did not complete. Check your information and try again.", mismatch:"Both passwords must match.", resetDone:"Password updated. Log in to resume.", created:"Account created. Log in to continue.", expired:"This code is invalid or expired. Request another code.", resend:"Send another code", sent:"If the account exists, a new code has been sent.", verifyTitle:"Verify your email", verifyBody:"Verify this email using the code before joining a team.", verify:"Verify my email", verified:"Email verified. You can resume the invitation.", terms:"I accept the terms of use", privacy:"Privacy policy", generic:"Try again in a moment. Your saved drafts are safe." }
};

export default function AccountAccess({ client, language, onAuthenticated, verificationEmail, onVerified }: {
  client: CommerceAuthClient; language:"fr"|"en"; onAuthenticated: () => Promise<void>;
  verificationEmail?: string; onVerified?: () => Promise<void>;
}) {
  const t = texts[language];
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
  useEffect(()=>{const tick=()=>setSeconds(Math.max(0,Math.ceil((resendAt-Date.now())/1000)));tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);},[resendAt]);
  function change(next:Mode) { setMode(next);setError("");setMessage("");setPassword("");setConfirm("");setOtp(""); }
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
  return <main className="auth-layout" id="merchant-main" tabIndex={-1}>
    <section className="auth-copy"><span className="admin-eyebrow">Commerce Factory</span>
      <h1>{mode === "forgot" ? t.recoveryTitle : mode === "reset" ? t.resetTitle : mode === "verify" ? t.verifyTitle : t.title}</h1>
      <p>{mode === "forgot" ? t.recoveryBody : mode === "reset" ? t.resetBody : mode === "verify" ? t.verifyBody : t.body}</p>
      <div className="auth-benefits"><span>✓ WhatsApp</span><span>✓ FCFA</span><span>✓ Mobile</span></div>
    </section>
    <section className="auth-card" aria-label={recovery ? t.recoveryTitle : t.signin}>
      {!recovery && <div className="auth-tabs" role="group" aria-label={language === "fr" ? "Accès au compte" : "Account access"}>
        <button type="button" aria-pressed={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={()=>change("signup")}>{t.signup}</button>
        <button type="button" aria-pressed={mode === "signin"} className={mode === "signin" ? "active" : ""} onClick={()=>change("signin")}>{t.signin}</button>
      </div>}
      <form onSubmit={submit} className="admin-form" aria-busy={busy}>
        {mode === "signup" && <label><span>{t.name}</span><input autoComplete="name" value={name} onChange={e=>setName(e.target.value)} maxLength={120} required /></label>}
        <label><span>{t.email}</span><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} readOnly={Boolean(verificationEmail)} maxLength={254} required /></label>
        {(mode === "reset" || mode === "verify") && <label><span>{t.code}</span><input value={otp} onChange={e=>setOtp(e.target.value)} autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required /></label>}
        {mode !== "forgot" && mode !== "verify" && <label><span>{t.password}</span><input aria-label={t.password} type={visible ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={e=>setPassword(e.target.value)} minLength={8} maxLength={128} required aria-describedby="password-hint" /><small id="password-hint">{t.hint}</small></label>}
        {mode === "reset" && <label><span>{t.confirm}</span><input type={visible ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={8} maxLength={128} required /></label>}
        {mode !== "forgot" && mode !== "verify" && <button type="button" className="auth-switch" aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible ? t.hide : t.show}</button>}
        {mode === "signup" && <label className="consent-row"><input type="checkbox" required /><span>{t.terms} (<a href="/terms" target="_blank" rel="noreferrer">{language === "fr" ? "Lire" : "Read"}</a>). <a href="/privacy" target="_blank" rel="noreferrer">{t.privacy}</a></span></label>}
        {error && <p className="form-message error" role="alert">{error}</p>}
        {message && <p className="form-message success" role="status">{message}</p>}
        <button className="admin-primary" type="submit" disabled={busy}>{busy ? t.busy : mode === "forgot" ? t.send : mode === "reset" ? t.reset : mode === "verify" ? t.verify : t.continue}</button>
      </form>
      {mode === "signin" && <button type="button" className="auth-switch" onClick={()=>change("forgot")}>{t.forgot}</button>}
      {(mode === "reset" || mode === "verify") && <button type="button" className="auth-switch" onClick={sendCode} disabled={busy || seconds>0}>{seconds>0 ? (language === "fr" ? "Nouveau code dans " : "New code in ")+seconds+" s" : resendAt ? t.resend : t.send}</button>}
      {recovery && !verificationEmail && <button type="button" className="auth-switch" onClick={()=>change("signin")}>← {t.signin}</button>}
      <a className="auth-switch" href="/help">{language === "fr" ? "Besoin d’aide ?" : "Need help?"}</a>
    </section>
  </main>;
}
