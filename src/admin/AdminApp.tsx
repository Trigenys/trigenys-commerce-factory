import { FormEvent, useEffect, useMemo, useState } from "react";
import type { CommerceAuthClient } from "./auth";
import { getAuthClient, getSessionSnapshot } from "./auth";
import {
  ApiError,
  createStore,
  deleteMediaByPublicId,
  listStores,
  managedMediaPublicId,
  publishStore,
  updateStore,
  updateStoreLogo,
  uploadMedia,
  type Store,
  type StoreInput,
  type Product
} from "./api";
import AnalyticsPanel from "./AnalyticsPanel";
import { MediaPreparationError, prepareImageForUpload } from "./media";
import ProductCatalog from "./ProductCatalog";
import "./admin.css";
import { resolveStoreTheme, themeFonts } from "../../shared/store-themes";
import { themeShellProps } from "../storefront/theme-style";
import ThemePicker from "../themes/ThemePicker";
import LiveThemePreview from "../themes/LiveThemePreview";

type Language = "fr" | "en";
type AuthMode = "signin" | "signup";
type OnboardingStep = 0 | 1 | 2 | 3;

const steps = {
  fr: ["Entreprise", "WhatsApp", "Apparence", "Vérification", "Premier produit", "Publier"],
  en: ["Business", "WhatsApp", "Appearance", "Review", "First product", "Publish"]
} as const;

const copy = {
  fr: {
    back: "Retour au site",
    signIn: "Connexion",
    signUp: "Créer un compte",
    authTitle: "Construisez votre boutique.",
    authBody: "Un compte suffit pour créer votre boutique Commerce Factory et commencer votre catalogue.",
    name: "Votre nom",
    email: "Email",
    password: "Mot de passe",
    passwordHint: "8 caractères minimum",
    continue: "Continuer",
    creatingAccount: "Création du compte…",
    signingIn: "Connexion…",
    haveAccount: "J’ai déjà un compte",
    needAccount: "Créer un compte",
    authError: "Impossible de vous authentifier. Vérifiez vos informations.",
    accountCreated: "Compte créé. Connectez-vous pour continuer.",
    loading: "Chargement de votre espace…",
    signOut: "Se déconnecter",
    onboardingEyebrow: "Configuration de la boutique",
    onboardingTitle: "Votre boutique, sans labyrinthe.",
    onboardingBody: "Renseignez l’essentiel maintenant. Le catalogue et la publication arrivent juste après.",
    businessTitle: "Parlez-nous de votre activité",
    businessBody: "Ces informations deviennent la base de votre boutique publique.",
    storeName: "Nom de la boutique",
    slug: "Adresse de la boutique",
    description: "Courte description",
    location: "Localisation",
    contactEmail: "Email de contact",
    country: "Pays",
    currency: "Devise",
    whatsappTitle: "Où vos clients vous écrivent-ils ?",
    whatsappBody: "Nous normalisons le numéro au format international avant de l’enregistrer.",
    whatsapp: "Numéro WhatsApp",
    whatsappHint: "Ex. 670 00 00 01 ou +237 670 00 00 01",
    appearanceTitle: "Un univers pour votre boutique",
    appearanceBody: "Choisissez une présentation adaptée à votre activité, puis personnalisez son style. Vous pourrez ajouter votre logo après la création.",
    theme: "Thème",
    logoSoon: "Logo",
    logoSoonBody: "Créez d’abord la boutique, puis ajoutez un logo optimisé depuis les paramètres.",
    reviewTitle: "Vérifiez avant de créer",
    reviewBody: "La boutique sera créée en brouillon. Rien n’est publié sans votre action.",
    previous: "Retour",
    next: "Suivant",
    create: "Créer ma boutique",
    creating: "Création…",
    slugTaken: "Cette adresse de boutique est déjà utilisée. Choisissez-en une autre.",
    storeExists: "Votre compte possède déjà une boutique.",
    invalidStore: "Certains champs sont invalides. Vérifiez le formulaire.",
    genericError: "Une erreur est survenue. Réessayez.",
    required: "Champ requis.",
    invalidEmail: "Adresse email invalide.",
    invalidPhone: "Entrez un numéro WhatsApp camerounais valide ou un numéro international commençant par +.",
    invalidSlug: "Utilisez au moins 3 caractères avec lettres, chiffres et tirets.",
    settingsEyebrow: "Ma boutique",
    settingsTitle: "Paramètres de la boutique",
    settingsBody: "Modifiez les informations de base. Les changements sont enregistrés côté serveur dans votre tenant.",
    save: "Enregistrer",
    saving: "Enregistrement…",
    saved: "Modifications enregistrées.",
    draft: "Brouillon",
    published: "Publiée",
    publish: "Publier la boutique",
    publishing: "Publication…",
    publishNeedsProduct: "Activez au moins un produit avant de publier la boutique.",
    openStore: "Ouvrir la boutique",
    publicUrl: "URL publique",
    nextProduct: "Étape suivante : premier produit",
    nextProductBody: "La boutique existe. La prochaine issue branche la création du catalogue, puis le bouton Publier.",
    comingNext: "Bientôt avec #5",
    preview: "Aperçu",
    noDescription: "Votre description apparaîtra ici.",
    noLocation: "Votre localisation apparaîtra ici.",
    fcfaReady: "FCFA prêt",
    secure: "Données isolées par boutique",
    logoUpload: "Logo de la boutique",
    logoUploadHint: "JPEG, PNG ou WebP. Optimisé automatiquement avant l’envoi.",
    chooseLogo: "Choisir un logo",
    removeLogo: "Retirer le logo",
    logoUploading: "Optimisation et envoi…",
    logoSaved: "Logo mis à jour.",
    mediaUnsupported: "Format non pris en charge. Utilisez JPEG, PNG ou WebP.",
    mediaTooLarge: "Image trop lourde. Utilisez une image source de moins de 12 Mo.",
    mediaUploadFailed: "Impossible d’envoyer l’image pour le moment."
  },
  en: {
    back: "Back to site",
    signIn: "Sign in",
    signUp: "Create account",
    authTitle: "Build your store.",
    authBody: "One account is enough to create your Commerce Factory store and start your catalog.",
    name: "Your name",
    email: "Email",
    password: "Password",
    passwordHint: "8 characters minimum",
    continue: "Continue",
    creatingAccount: "Creating account…",
    signingIn: "Signing in…",
    haveAccount: "I already have an account",
    needAccount: "Create an account",
    authError: "Unable to authenticate. Check your details.",
    accountCreated: "Account created. Sign in to continue.",
    loading: "Loading your workspace…",
    signOut: "Sign out",
    onboardingEyebrow: "Store setup",
    onboardingTitle: "Your store, without the dashboard maze.",
    onboardingBody: "Set the essentials now. Catalog and publishing come immediately after.",
    businessTitle: "Tell us about your business",
    businessBody: "These details become the foundation of your public storefront.",
    storeName: "Store name",
    slug: "Store address",
    description: "Short description",
    location: "Business location",
    contactEmail: "Contact email",
    country: "Country",
    currency: "Currency",
    whatsappTitle: "Where should customers message you?",
    whatsappBody: "We normalize the number to international format before saving it.",
    whatsapp: "WhatsApp number",
    whatsappHint: "E.g. 670 00 00 01 or +237 670 00 00 01",
    appearanceTitle: "A style for your storefront",
    appearanceBody: "Choose a presentation for your business and customize its style. You can add your logo after creating the store.",
    theme: "Theme",
    logoSoon: "Logo",
    logoSoonBody: "Create the store first, then add an optimized logo from store settings.",
    reviewTitle: "Review before creation",
    reviewBody: "The store is created as a draft. Nothing is published without your action.",
    previous: "Back",
    next: "Next",
    create: "Create my store",
    creating: "Creating…",
    slugTaken: "That store address is already taken. Choose another one.",
    storeExists: "Your account already owns a store.",
    invalidStore: "Some fields are invalid. Check the form.",
    genericError: "Something went wrong. Try again.",
    required: "Required field.",
    invalidEmail: "Invalid email address.",
    invalidPhone: "Enter a valid Cameroon WhatsApp number or an international number starting with +.",
    invalidSlug: "Use at least 3 characters with letters, numbers and hyphens.",
    settingsEyebrow: "My store",
    settingsTitle: "Store settings",
    settingsBody: "Edit the essentials. Changes are persisted server-side inside your tenant.",
    save: "Save changes",
    saving: "Saving…",
    saved: "Changes saved.",
    draft: "Draft",
    published: "Published",
    publish: "Publish store",
    publishing: "Publishing…",
    publishNeedsProduct: "Activate at least one product before publishing the store.",
    openStore: "Open storefront",
    publicUrl: "Public URL",
    nextProduct: "Next step: first product",
    nextProductBody: "Your store exists. The next issue wires catalog creation, then the Publish action.",
    comingNext: "Coming with #5",
    preview: "Preview",
    noDescription: "Your description will appear here.",
    noLocation: "Your location will appear here.",
    fcfaReady: "FCFA-ready",
    secure: "Store-isolated data",
    logoUpload: "Store logo",
    logoUploadHint: "JPEG, PNG or WebP. Automatically optimized before upload.",
    chooseLogo: "Choose logo",
    removeLogo: "Remove logo",
    logoUploading: "Optimizing and uploading…",
    logoSaved: "Logo updated.",
    mediaUnsupported: "Unsupported format. Use JPEG, PNG or WebP.",
    mediaTooLarge: "Image is too large. Use a source image under 12 MB.",
    mediaUploadFailed: "Unable to upload the image right now."
  }
} as const;

function languageFromPreference(): Language {
  const saved = window.localStorage.getItem("commerce-factory-language");
  if (saved === "fr" || saved === "en") return saved;
  return window.navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 63);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] || "C") + (parts[1]?.[0] || "F");
}

function emptyInput(email = ""): StoreInput {
  return {
    name: "",
    slug: "",
    whatsappNumber: "",
    countryCode: "CM",
    currencyCode: "XAF",
    description: "",
    businessLocation: "",
    contactEmail: email,
    theme: "clean",
    themeSettings: {}
  };
}

function storeToInput(store: Store): StoreInput {
  return {
    name: store.name,
    slug: store.slug,
    whatsappNumber: store.whatsappNumber,
    countryCode: store.countryCode,
    currencyCode: store.currencyCode,
    description: store.description || "",
    businessLocation: store.businessLocation || "",
    contactEmail: store.contactEmail || "",
    theme: store.theme,
    themeSettings: store.themeSettings ?? {}
  };
}

function fieldError(
  input: StoreInput,
  step: OnboardingStep,
  language: Language
): Record<string, string> {
  const t = copy[language];
  const errors: Record<string, string> = {};

  if (step === 0 || step === 3) {
    if (input.name.trim().length < 2) errors.name = t.required;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) || input.slug.length < 3) {
      errors.slug = t.invalidSlug;
    }
    if (
      input.contactEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail)
    ) {
      errors.contactEmail = t.invalidEmail;
    }
  }

  if (step === 1 || step === 3) {
    const compact = input.whatsappNumber.replace(/\D/g, "");
    const international = input.whatsappNumber.trim().startsWith("+");
    const cmLocal = input.countryCode === "CM" && (
      /^6\d{8}$/.test(compact) || /^2376\d{8}$/.test(compact)
    );
    if (!cmLocal && !(international && /^[1-9]\d{7,14}$/.test(compact))) {
      errors.whatsappNumber = t.invalidPhone;
    }
  }

  return errors;
}

function BrandPreview({
  input,
  language
}: {
  input: StoreInput;
  language: Language;
}) {
  const t = copy[language];
  const theme = resolveStoreTheme(input.theme, input.themeSettings);
  return (
    <aside className="merchant-preview" aria-label={t.preview}>
      <span className="merchant-preview-label">{t.preview}</span>
      <div className="merchant-preview-phone" style={{ ...themeShellProps(input).style, background: theme.tokens.background, color: theme.tokens.ink }}>
        <div className="merchant-preview-top">
          <span className="merchant-preview-logo">{initials(input.name).toUpperCase()}</span>
          <div>
            <strong>{input.name || "Commerce Store"}</strong>
            <small>{input.businessLocation || t.noLocation}</small>
          </div>
          <b>{input.currencyCode}</b>
        </div>
        <div className="merchant-preview-hero" style={{ background: theme.tokens.scene, color: theme.tokens.sceneInk }}>
          <span style={{ color: theme.tokens.sceneMuted }}>{t.fcfaReady}</span>
          <h3 style={{ fontFamily: themeFonts[theme.font] }}>{input.name || "Commerce Store"}</h3>
          <p style={{ color: theme.tokens.sceneMuted }}>{input.description || t.noDescription}</p>
        </div>
        <div className="merchant-preview-product">
          <i />
          <div><strong>Votre premier produit</strong><small>Prix • {input.currencyCode}</small></div>
        </div>
        <div className="merchant-preview-wa">WA · WhatsApp</div>
      </div>
      <small className="merchant-secure-note">✓ {t.secure}</small>
    </aside>
  );
}

function AuthScreen({
  client,
  language,
  onAuthenticated
}: {
  client: CommerceAuthClient;
  language: Language;
  onAuthenticated: () => Promise<void>;
}) {
  const t = copy[language];
  const [mode, setMode] = useState<AuthMode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = mode === "signup"
        ? await client.signUp.email({
            name: name.trim() || email.split("@")[0] || "Merchant",
            email: email.trim(),
            password
          })
        : await client.signIn.email({
            email: email.trim(),
            password
          });

      if (result.error) {
        setError(result.error.message || t.authError);
        return;
      }

      const session = await getSessionSnapshot(client);
      if (!session.authenticated) {
        setMode("signin");
        setMessage(t.accountCreated);
        return;
      }

      await onAuthenticated();
    } catch {
      setError(t.authError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-copy">
        <span className="admin-eyebrow">Commerce Factory</span>
        <h1>{t.authTitle}</h1>
        <p>{t.authBody}</p>
        <div className="auth-benefits">
          <span>✓ WhatsApp-first</span>
          <span>✓ XAF / FCFA</span>
          <span>✓ Mobile-first</span>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            className={mode === "signup" ? "active" : ""}
            onClick={() => { setMode("signup"); setError(null); }}
          >
            {t.signUp}
          </button>
          <button
            type="button"
            className={mode === "signin" ? "active" : ""}
            onClick={() => { setMode("signin"); setError(null); }}
          >
            {t.signIn}
          </button>
        </div>

        <form onSubmit={submit} className="admin-form">
          {mode === "signup" ? (
            <label>
              <span>{t.name}</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                required
              />
            </label>
          ) : null}

          <label>
            <span>{t.email}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label>
            <span>{t.password}</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={8}
              required
            />
            <small>{t.passwordHint}</small>
          </label>

          {error ? <p className="form-message error" role="alert">{error}</p> : null}
          {message ? <p className="form-message success">{message}</p> : null}

          <button className="admin-primary" type="submit" disabled={busy}>
            {busy
              ? mode === "signup" ? t.creatingAccount : t.signingIn
              : t.continue}
          </button>
        </form>

        <button
          type="button"
          className="auth-switch"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        >
          {mode === "signup" ? t.haveAccount : t.needAccount}
        </button>
      </section>
    </main>
  );
}

function BusinessFields({
  input,
  setInput,
  errors,
  t,
  slugTouched,
  setSlugTouched
}: {
  input: StoreInput;
  setInput: (input: StoreInput) => void;
  errors: Record<string, string>;
  t: typeof copy.fr | typeof copy.en;
  slugTouched: boolean;
  setSlugTouched: (value: boolean) => void;
}) {
  return (
    <div className="admin-form admin-form-grid">
      <label className="span-2">
        <span>{t.storeName}</span>
        <input
          value={input.name}
          onChange={(event) => {
            const name = event.target.value;
            setInput({
              ...input,
              name,
              slug: slugTouched ? input.slug : slugify(name)
            });
          }}
          aria-invalid={Boolean(errors.name)}
        />
        {errors.name ? <small className="field-error">{errors.name}</small> : null}
      </label>

      <label className="span-2">
        <span>{t.slug}</span>
        <div className="slug-field">
          <small>commercefactory.shop/</small>
          <input
            value={input.slug}
            onChange={(event) => {
              setSlugTouched(true);
              setInput({ ...input, slug: slugify(event.target.value) });
            }}
            aria-invalid={Boolean(errors.slug)}
          />
        </div>
        {errors.slug ? <small className="field-error">{errors.slug}</small> : null}
      </label>

      <label className="span-2">
        <span>{t.description}</span>
        <textarea
          value={input.description}
          maxLength={280}
          rows={3}
          onChange={(event) => setInput({ ...input, description: event.target.value })}
        />
        <small>{input.description.length}/280</small>
      </label>

      <label>
        <span>{t.location}</span>
        <input
          value={input.businessLocation}
          onChange={(event) => setInput({ ...input, businessLocation: event.target.value })}
          placeholder="Douala, Bonapriso"
        />
      </label>

      <label>
        <span>{t.contactEmail}</span>
        <input
          type="email"
          value={input.contactEmail}
          onChange={(event) => setInput({ ...input, contactEmail: event.target.value })}
          aria-invalid={Boolean(errors.contactEmail)}
        />
        {errors.contactEmail ? <small className="field-error">{errors.contactEmail}</small> : null}
      </label>

      <label>
        <span>{t.country}</span>
        <select
          value={input.countryCode}
          onChange={(event) => setInput({ ...input, countryCode: event.target.value })}
        >
          <option value="CM">Cameroun</option>
          <option value="CI">Côte d’Ivoire</option>
          <option value="SN">Sénégal</option>
          <option value="GA">Gabon</option>
          <option value="CG">Congo</option>
        </select>
      </label>

      <label>
        <span>{t.currency}</span>
        <select
          value={input.currencyCode}
          onChange={(event) => setInput({ ...input, currencyCode: event.target.value })}
        >
          <option value="XAF">XAF — FCFA CEMAC</option>
          <option value="XOF">XOF — FCFA UEMOA</option>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
        </select>
      </label>
    </div>
  );
}

function Onboarding({
  client,
  language,
  email,
  onCreated
}: {
  client: CommerceAuthClient;
  language: Language;
  email: string;
  onCreated: (store: Store) => void;
}) {
  const t = copy[language];
  const [step, setStep] = useState<OnboardingStep>(0);
  const [input, setInput] = useState<StoreInput>(() => emptyInput(email));
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function next() {
    const found = fieldError(input, step, language);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setServerError(null);
    setStep((Math.min(3, step + 1)) as OnboardingStep);
  }

  async function submit() {
    const found = fieldError(input, 3, language);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setServerError(null);
    try {
      const store = await createStore(client, input);
      onCreated(store);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === "SLUG_TAKEN") setServerError(t.slugTaken);
        else if (error.code === "STORE_ALREADY_EXISTS") setServerError(t.storeExists);
        else if (error.code === "INVALID_STORE_INPUT") setServerError(t.invalidStore);
        else setServerError(t.genericError);
      } else {
        setServerError(t.genericError);
      }
    } finally {
      setBusy(false);
    }
  }

  const title = [
    t.businessTitle,
    t.whatsappTitle,
    t.appearanceTitle,
    t.reviewTitle
  ][step];
  const body = [
    t.businessBody,
    t.whatsappBody,
    t.appearanceBody,
    t.reviewBody
  ][step];

  return (
    <main className="merchant-layout">
      <aside className="merchant-progress">
        <span className="admin-eyebrow">{t.onboardingEyebrow}</span>
        <h1>{t.onboardingTitle}</h1>
        <p>{t.onboardingBody}</p>
        <ol>
          {steps[language].map((label, index) => (
            <li
              key={label}
              className={
                index === step ? "active" :
                index < step ? "done" :
                index > 3 ? "future" : ""
              }
            >
              <span>{index < step ? "✓" : index + 1}</span>
              <b>{label}</b>
            </li>
          ))}
        </ol>
      </aside>

      <section className="merchant-workspace">
        <div className="merchant-form-card">
          <div className="merchant-form-head">
            <span>0{step + 1}</span>
            <div>
              <h2>{title}</h2>
              <p>{body}</p>
            </div>
          </div>

          {step === 0 ? (
            <BusinessFields
              input={input}
              setInput={setInput}
              errors={errors}
              t={t}
              slugTouched={slugTouched}
              setSlugTouched={setSlugTouched}
            />
          ) : null}

          {step === 1 ? (
            <div className="admin-form">
              <label>
                <span>{t.whatsapp}</span>
                <div className="whatsapp-field">
                  <b>WA</b>
                  <input
                    value={input.whatsappNumber}
                    onChange={(event) =>
                      setInput({ ...input, whatsappNumber: event.target.value })
                    }
                    placeholder="670 00 00 01"
                    inputMode="tel"
                    aria-invalid={Boolean(errors.whatsappNumber)}
                  />
                </div>
                <small>{t.whatsappHint}</small>
                {errors.whatsappNumber ? (
                  <small className="field-error">{errors.whatsappNumber}</small>
                ) : null}
              </label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="appearance-grid">
              <div className="admin-form">
                <ThemePicker value={input.theme} settings={input.themeSettings} language={language} onChange={(theme, themeSettings) => setInput({ ...input, theme, themeSettings })} />
                <div className="logo-pending">
                  <span className="merchant-preview-logo">{initials(input.name).toUpperCase()}</span>
                  <div>
                    <strong>{t.logoSoon}</strong>
                    <p>{t.logoSoonBody}</p>
                  </div>
                </div>
              </div>
              <BrandPreview input={input} language={language} />
            </div>
          ) : null}

          {step === 3 ? (
            <div className="review-grid">
              <div className="review-list">
                <div><span>{t.storeName}</span><strong>{input.name}</strong></div>
                <div><span>{t.slug}</span><strong>/{input.slug}</strong></div>
                <div><span>{t.whatsapp}</span><strong>{input.whatsappNumber}</strong></div>
                <div><span>{t.location}</span><strong>{input.businessLocation || "—"}</strong></div>
                <div><span>{t.currency}</span><strong>{input.currencyCode}</strong></div>
                <div><span>{t.theme}</span><strong>{resolveStoreTheme(input.theme).name}</strong></div>
              </div>
              <BrandPreview input={input} language={language} />
            </div>
          ) : null}

          {serverError ? <p className="form-message error" role="alert">{serverError}</p> : null}

          <div className="wizard-actions">
            <button
              type="button"
              className="admin-secondary"
              onClick={() => setStep((Math.max(0, step - 1)) as OnboardingStep)}
              disabled={step === 0 || busy}
            >
              {t.previous}
            </button>
            {step < 3 ? (
              <button type="button" className="admin-primary" onClick={next}>
                {t.next} →
              </button>
            ) : (
              <button type="button" className="admin-primary" onClick={submit} disabled={busy}>
                {busy ? t.creating : t.create}
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function StoreSettings({
  client,
  store,
  language,
  onUpdated
}: {
  client: CommerceAuthClient;
  store: Store;
  language: Language;
  onUpdated: (store: Store) => void;
}) {
  const t = copy[language];
  const [input, setInput] = useState<StoreInput>(() => storeToInput(store));
  const [slugTouched, setSlugTouched] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [previewProducts, setPreviewProducts] = useState<Product[]>([]);

  async function publishCurrentStore() {
    setPublishBusy(true);
    setMessage(null);
    setServerError(null);
    try {
      const published = await publishStore(client, store.id);
      onUpdated(published);
      setMessage(t.published);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "ACTIVE_PRODUCT_REQUIRED"
      ) {
        setServerError(t.publishNeedsProduct);
      } else {
        setServerError(t.genericError);
      }
    } finally {
      setPublishBusy(false);
    }
  }

  async function uploadLogo(file: File | null) {
    if (!file) return;
    setLogoBusy(true);
    setMessage(null);
    setServerError(null);

    try {
      const prepared = await prepareImageForUpload(file);
      const media = await uploadMedia(client, store.id, prepared, "logo");
      const previousPublicId = store.logoUrl
        ? managedMediaPublicId(store.logoUrl)
        : null;
      const updated = await updateStoreLogo(client, store.id, media.publicUrl);
      onUpdated(updated);
      setMessage(t.logoSaved);

      if (previousPublicId && previousPublicId !== media.publicId) {
        try {
          await deleteMediaByPublicId(client, store.id, previousPublicId);
        } catch {
          // Best-effort cleanup; the documented orphan sweep is the fallback.
        }
      }
    } catch (error) {
      if (error instanceof MediaPreparationError) {
        setServerError(
          error.code === "UNSUPPORTED_MEDIA_TYPE"
            ? t.mediaUnsupported
            : error.code.includes("TOO_LARGE")
              ? t.mediaTooLarge
              : t.mediaUploadFailed
        );
      } else {
        setServerError(t.mediaUploadFailed);
      }
    } finally {
      setLogoBusy(false);
    }
  }

  async function removeLogo() {
    if (!store.logoUrl) return;
    setLogoBusy(true);
    setMessage(null);
    setServerError(null);
    const publicId = managedMediaPublicId(store.logoUrl);

    try {
      const updated = await updateStoreLogo(client, store.id, null);
      onUpdated(updated);
      if (publicId) {
        try {
          await deleteMediaByPublicId(client, store.id, publicId);
        } catch {
          // Best-effort cleanup; the documented orphan sweep is the fallback.
        }
      }
      setMessage(t.logoSaved);
    } catch {
      setServerError(t.mediaUploadFailed);
    } finally {
      setLogoBusy(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const found = {
      ...fieldError(input, 0, language),
      ...fieldError(input, 1, language)
    };
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setMessage(null);
    setServerError(null);
    try {
      const updated = await updateStore(client, store.id, input);
      onUpdated(updated);
      setMessage(t.saved);
    } catch (error) {
      if (error instanceof ApiError && error.code === "SLUG_TAKEN") {
        setServerError(t.slugTaken);
      } else {
        setServerError(t.genericError);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="settings-layout">
      <section className="settings-main">
        <span className="admin-eyebrow">{t.settingsEyebrow}</span>
        <div className="settings-title-row">
          <div>
            <h1>{t.settingsTitle}</h1>
            <p>{t.settingsBody}</p>
          </div>
          <div className="store-status-actions">
            <span className={"draft-pill " + store.status}>
              {store.status === "published" ? t.published : t.draft}
            </span>
            {store.status === "published" ? (
              <a
                className="admin-secondary storefront-link"
                href={"/store/" + encodeURIComponent(store.slug)}
                target="_blank"
                rel="noreferrer"
              >
                {t.openStore}
              </a>
            ) : (
              <button
                type="button"
                className="admin-primary publish-button"
                onClick={publishCurrentStore}
                disabled={publishBusy}
              >
                {publishBusy ? t.publishing : t.publish}
              </button>
            )}
          </div>
        </div>

        <form className="merchant-form-card settings-card" onSubmit={save}>
          <BusinessFields
            input={input}
            setInput={setInput}
            errors={errors}
            t={t}
            slugTouched={slugTouched}
            setSlugTouched={setSlugTouched}
          />

          <div className="settings-divider" />

          <div className="admin-form admin-form-grid">
            <label>
              <span>{t.whatsapp}</span>
              <input
                value={input.whatsappNumber}
                onChange={(event) => setInput({ ...input, whatsappNumber: event.target.value })}
                aria-invalid={Boolean(errors.whatsappNumber)}
              />
              {errors.whatsappNumber ? <small className="field-error">{errors.whatsappNumber}</small> : null}
            </label>
            <div className="span-2 store-logo-field">
              <span>{t.logoUpload}</span>
              <div className="store-logo-row">
                <div className="store-logo-preview">
                  {store.logoUrl ? (
                    <img src={store.logoUrl} alt="" />
                  ) : (
                    <span>{initials(store.name).toUpperCase()}</span>
                  )}
                </div>
                <div className="store-logo-actions">
                  <label className="admin-secondary store-logo-upload">
                    <span>{logoBusy ? t.logoUploading : t.chooseLogo}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={logoBusy}
                      onChange={(event) => {
                        void uploadLogo(event.currentTarget.files?.[0] || null);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {store.logoUrl ? (
                    <button
                      type="button"
                      className="admin-secondary"
                      onClick={() => void removeLogo()}
                      disabled={logoBusy}
                    >
                      {t.removeLogo}
                    </button>
                  ) : null}
                  <small>{t.logoUploadHint}</small>
                </div>
              </div>
            </div>
          </div>

          <div className="settings-divider" />
          <ThemePicker value={input.theme} settings={input.themeSettings} language={language} imageUrl={previewProducts.find((product) => product.status === "active")?.imageUrls[0]} onChange={(theme, themeSettings) => setInput({ ...input, theme, themeSettings })} />

          {serverError ? <p className="form-message error">{serverError}</p> : null}
          {message ? <p className="form-message success">{message}</p> : null}

          <div className="settings-actions">
            <span>
              <small>{t.publicUrl}</small>
              <strong>/store/{input.slug}</strong>
            </span>
            <button className="admin-primary" type="submit" disabled={busy}>
              {busy ? t.saving : t.save}
            </button>
          </div>
        </form>

        <LiveThemePreview language={language} storefront={{
          store: { ...store, ...input, logoUrl: store.logoUrl },
          products: previewProducts.filter((product) => product.status === "active").sort((a, b) => a.sortOrder - b.sortOrder)
        }} />

        <ProductCatalog
          client={client}
          store={store}
          language={language}
          onProductsChange={setPreviewProducts}
        />

        <AnalyticsPanel
          client={client}
          store={store}
          language={language}
        />
      </section>

      <BrandPreview input={input} language={language} />
    </main>
  );
}

export default function AdminApp() {
  const [language, setLanguage] = useState<Language>(languageFromPreference);
  const [client, setClient] = useState<CommerceAuthClient | null>(null);
  const [sessionEmail, setSessionEmail] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const t = copy[language];

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = "Commerce Factory — Merchant";
    window.localStorage.setItem("commerce-factory-language", language);
  }, [language]);

  async function hydrate(nextClient: CommerceAuthClient) {
    const session = await getSessionSnapshot(nextClient);
    setAuthenticated(session.authenticated);
    setSessionEmail(session.email);
    if (!session.authenticated) {
      setStore(null);
      return;
    }

    const stores = await listStores(nextClient);
    setStore(stores[0] || null);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const nextClient = await getAuthClient();
        if (cancelled) return;
        setClient(nextClient);
        await hydrate(nextClient);
      } catch {
        if (!cancelled) {
          setFatalError(
            language === "fr"
              ? "Impossible de charger la configuration Commerce Factory."
              : "Unable to load Commerce Factory configuration."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const header = useMemo(() => (
    <header className="admin-header">
      <a href="/" className="admin-brand">
        <img src="/commerce-factory-logo-v3.png?v=3" alt="Commerce Factory" />
      </a>
      <div className="admin-header-actions">
        <div className="admin-language">
          <button
            type="button"
            className={language === "fr" ? "active" : ""}
            onClick={() => setLanguage("fr")}
          >FR</button>
          <button
            type="button"
            className={language === "en" ? "active" : ""}
            onClick={() => setLanguage("en")}
          >EN</button>
        </div>
        {authenticated && client ? (
          <button
            type="button"
            className="admin-signout"
            onClick={async () => {
              await client.signOut();
              setAuthenticated(false);
              setStore(null);
              setSessionEmail("");
            }}
          >
            {t.signOut}
          </button>
        ) : (
          <a href="/" className="admin-back">{t.back}</a>
        )}
      </div>
    </header>
  ), [authenticated, client, language, t]);

  if (loading) {
    return (
      <div className="admin-shell">
        {header}
        <main className="admin-loading">
          <span className="admin-loader" />
          <p>{t.loading}</p>
        </main>
      </div>
    );
  }

  if (fatalError || !client) {
    return (
      <div className="admin-shell">
        {header}
        <main className="admin-loading">
          <p className="form-message error">{fatalError || t.genericError}</p>
          <a className="admin-primary" href="/">{t.back}</a>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      {header}
      {!authenticated ? (
        <AuthScreen
          client={client}
          language={language}
          onAuthenticated={async () => {
            await hydrate(client);
          }}
        />
      ) : store ? (
        <StoreSettings
          client={client}
          store={store}
          language={language}
          onUpdated={setStore}
        />
      ) : (
        <Onboarding
          client={client}
          language={language}
          email={sessionEmail}
          onCreated={setStore}
        />
      )}
    </div>
  );
}
